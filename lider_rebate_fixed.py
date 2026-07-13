from __future__ import annotations

import json
import os
import shutil
import sys
import unittest
from datetime import date
from pathlib import Path
from typing import Optional

import pandas as pd

from lider_rebate_core import (
    _norm_key,
    add_months,
    add_purchase,
    credit_balance,
    export_excel_and_json,
    load_from_excel,
    lookup_credits,
    lookup_transactions,
    make_ledgers,
)
from lider_rebate_simulation import (
    build_synthetic_500_excel,
    build_synthetic_credit_usage_excel,
    build_synthetic_excel,
)


def _parse_date(s: str) -> date:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return pd.to_datetime(s, format=fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Bad date: '{s}'")


def cli_demo():
    txns, redemptions = make_ledgers()
    names: dict[str, str] = {}

    print("═" * 55)
    print("  LIDER Rebate Tester")
    print("  Enter purchases one at a time.  Type q to quit.")
    print("  Balances are evaluated as of each purchase's date,")
    print("  so out-of-order dates settle correctly.")
    print("═" * 55)

    while True:
        print()
        raw = input("Email/Customer (or q): ").strip()
        if raw.lower() == "q":
            break
        try:
            key = _norm_key(raw)
        except ValueError as e:
            print(f"  ✘ {e}")
            continue

        if key in names:
            name = names[key]
            print(f"  Customer: {name}")
        else:
            name = input("  Customer name: ").strip()
            if not name:
                print("  ✘ Customer name cannot be empty.")
                continue
            names[key] = name

        try:
            amount = float(input("  Purchase amount ($): ").strip())
            dt = _parse_date(input("  Purchase date (YYYY-MM-DD): ").strip())
        except ValueError as e:
            print(f"  ✘ {e}")
            continue

        avail = credit_balance(txns, redemptions, key, dt)
        credit = 0.0
        print(f"\n  Credit available as of {dt}: ${avail:.2f}")
        if avail > 0:
            c = input(f"  Apply credit? Amount (0–{avail:.2f}) [0]: ").strip()
            if c:
                credit = float(c)
        else:
            print("  No credit available to apply.")

        try:
            r = add_purchase(txns, redemptions, key, name, amount, dt, credit)
        except ValueError as e:
            print(f"  ✘ {e}")
            continue
        txns, redemptions = r["_txns"], r["_redemptions"]

        print(f"\n  ┌─ Purchase Recorded ──────────────────────")
        print(f"  │ Customer    : {r['customer_name']}")
        print(f"  │ Txn ID      : {r['txn_id'][:8]}")
        print(f"  │ Gross       : ${r['gross_amount']:>10,.2f}")
        if r["credit_used"] > 0:
            print(f"  │ Credit used : −${r['credit_used']:>9,.2f}")
        print(f"  │ Net billed  : ${r['net_billed']:>10,.2f}")
        print(f"  │ Expires     : {add_months(dt, 12)}")
        print(f"  │ Tier (now)  : {r['tier_after']}")
        print(f"  │ Credit bal  : ${r['credit_balance']:>10,.2f}")
        print(f"  └─────────────────────────────────────────")

        # Active purchases evaluated as of THIS purchase date
        cust = lookup_transactions(txns, key, dt)
        purchases = cust[cust["txn_type"] == "purchase"]
        if not purchases.empty:
            print(f"\n  Purchases for {name} (as of {dt}):")
            print(f"  {'Txn ID':<10} {'Date':<12} {'Net':>10} {'Expires':<12} {'Status':<8}")
            print(f"  {'─'*10} {'─'*12} {'─'*10} {'─'*12} {'─'*8}")
            for _, p in purchases.iterrows():
                status = "active" if p["active"] else "EXPIRED"
                print(f"  {str(p['txn_id'])[:8]:<10} "
                      f"{str(p['txn_date']):<12} "
                      f"${float(p['net_billed']):>9,.2f} "
                      f"{str(p['expiry_date']):<12} {status:<8}")

        info = lookup_credits(txns, redemptions, key, dt)
        print(f"\n  Active pool: ${info['active_pool']:,.2f}  │  "
              f"Tier: {info['current_tier']}  │  "
              f"Credit balance: ${info['credit_balance']:,.2f}")

    print("Done.")


def _default_rebate_xlsx_path() -> str:
    configured = os.environ.get("REBATE_XLSX")
    if configured:
        return configured

    candidates = [
        Path.cwd() / "Rebate.xlsx",
        Path.home() / "Downloads" / "Rebate.xlsx",
        Path("/mnt/user-data/uploads/Rebate.xlsx"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return str(candidates[0])


def _parse_export_args(args: list[str]) -> tuple[str, Optional[str], date, Optional[str]]:
    path = _default_rebate_xlsx_path()
    output_prefix = None
    as_of = date.today()
    credit_usage_path = None

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in {"--as-of", "-d"}:
            i += 1
            if i >= len(args):
                raise ValueError("--as-of requires a date, for example 2026-06-16")
            as_of = _parse_date(args[i])
        elif arg in {"--out", "-o"}:
            i += 1
            if i >= len(args):
                raise ValueError("--out requires an output prefix path")
            output_prefix = args[i]
        elif arg in {"--credits", "--credit-usage"}:
            i += 1
            if i >= len(args):
                raise ValueError("--credits requires a credit usage Excel path")
            credit_usage_path = args[i]
        else:
            path = arg
        i += 1

    return path, output_prefix, as_of, credit_usage_path


def _config_path(config_file: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else config_file.parent / path


def export_dashboard_from_config(config_path: str) -> tuple[Path, Path, Optional[Path]]:
    config_file = Path(config_path).resolve()
    config = json.loads(config_file.read_text(encoding="utf-8"))

    purchase_value = config.get("purchase_orders_excel") or config.get("purchase_excel")
    if not purchase_value:
        raise ValueError("Config requires purchase_orders_excel.")

    purchase_path = _config_path(config_file, purchase_value)
    credit_value = config.get("credit_usage_excel")
    credit_path = _config_path(config_file, credit_value) if credit_value else None
    output_prefix = config.get("output_prefix")
    output_base = str(_config_path(config_file, output_prefix)) if output_prefix else None
    as_of = _parse_date(config["as_of"]) if config.get("as_of") else date.today()

    excel_path, json_path = export_excel_and_json(
        str(purchase_path),
        output_base,
        as_of,
        str(credit_path) if credit_path else None,
    )

    dashboard_json = None
    if config.get("dashboard_json"):
        dashboard_json = _config_path(config_file, config["dashboard_json"])
        dashboard_json.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(json_path, dashboard_json)

    return excel_path, json_path, dashboard_json


def run_tests() -> int:
    import test_lider_rebate

    suite = unittest.defaultTestLoader.loadTestsFromModule(test_lider_rebate)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    command = argv[0] if argv else "demo"
    args = argv[1:]

    if command == "test":
        return run_tests()
    if command == "gen":
        out = args[0] if args else "synthetic_rebate_2022_2026.xlsx"
        build_synthetic_excel(out)
        print(f"Wrote synthetic test Excel: {out}")
        return 0
    if command == "gen500":
        out = args[0] if args else "synthetic_rebate_500_2025_2026.xlsx"
        build_synthetic_500_excel(out)
        print(f"Wrote 500-record synthetic Excel: {out}")
        return 0
    if command == "gencredits":
        purchase_path = args[0] if len(args) > 0 else "synthetic_rebate_500_2025_2026.xlsx"
        out = args[1] if len(args) > 1 else "synthetic_credit_usage_2025_2026.xlsx"
        build_synthetic_credit_usage_excel(purchase_path, out)
        print(f"Wrote synthetic credit usage Excel: {out}")
        return 0
    if command == "export":
        try:
            path, output_prefix, as_of, credit_usage_path = _parse_export_args(args)
            excel_path, json_path = export_excel_and_json(path, output_prefix, as_of, credit_usage_path)
        except Exception as exc:
            print(f"Export failed: {exc}")
            return 1

        print(f"Wrote Excel: {excel_path}")
        print(f"Wrote JSON : {json_path}")
        return 0
    if command in {"export-dashboard", "dashboard"}:
        config_path = args[0] if args else "dashboard_export_config.json"
        try:
            excel_path, json_path, dashboard_json = export_dashboard_from_config(config_path)
        except Exception as exc:
            print(f"Dashboard export failed: {exc}")
            return 1

        print(f"Wrote Excel: {excel_path}")
        print(f"Wrote JSON : {json_path}")
        if dashboard_json:
            print(f"Updated dashboard JSON: {dashboard_json}")
        return 0
    if command == "excel":
        path = _default_rebate_xlsx_path()
        as_of = date.today()
        credit_usage_path = None
        i = 0
        while i < len(args):
            arg = args[i]
            if arg in {"--credits", "--credit-usage"}:
                i += 1
                if i >= len(args):
                    print("--credits requires a credit usage Excel path")
                    return 1
                credit_usage_path = args[i]
            else:
                try:
                    as_of = _parse_date(arg)
                except ValueError:
                    path = arg
            i += 1

        txns, red, results = load_from_excel(path, credit_usage_path=credit_usage_path)
        print(f"Loaded {len(results)} orders. Evaluated as of {as_of}.\n")
        rows = []
        for key in txns["key"].unique():
            rows.append(lookup_credits(txns, red, key, as_of))
        for info in sorted(rows, key=lambda r: -r["active_pool"]):
            print(f"{info['customer_name']:<24}  "
                  f"pool=${info['active_pool']:>10,.2f}  "
                  f"tier={info['current_tier']}  "
                  f"credit=${info['credit_balance']:>7,.2f}")
        return 0

    cli_demo()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
