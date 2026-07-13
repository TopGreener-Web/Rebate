from __future__ import annotations

import calendar
import json
import re
import uuid
from datetime import date
from pathlib import Path
from typing import Optional

import pandas as pd


TIERS: list[tuple[float, float]] = [
    (20_000, 950.0),
    (15_000, 675.0),
    (10_000, 425.0),
    (5_000, 200.0),
]

_TIER_CREDIT = {0: 0.0, 1: 200.0, 2: 425.0, 3: 675.0, 4: 950.0}
PURCHASE_TTL_MONTHS = 12
_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
_LEADING_ID_RE = re.compile(r"^\s*\d{4,}\s+")
_ORDER_KEYS = ["Customer Name", "Document Number", "Date"]


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def validate_email(email: str) -> str:
    """Lowercase + validate.  Raises ValueError on bad format."""
    email = email.strip().lower()
    if not email:
        raise ValueError("Email cannot be empty.")
    if not _EMAIL_RE.match(email):
        raise ValueError(f"Invalid email format: '{email}'")
    return email


def tier_for_cumulative(cumulative: float) -> tuple[int, float]:
    """(tier_number, cumulative_credit_value) for a pool total."""
    for threshold, credit in TIERS:
        if cumulative >= threshold:
            return {950.0: 4, 675.0: 3, 425.0: 2, 200.0: 1}[credit], credit
    return 0, 0.0


def credit_for_tier(tier: int) -> float:
    return _TIER_CREDIT[tier]


def make_ledgers() -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Return (transactions, redemptions).

    transactions: one row per purchase OR return.
    redemptions:  one row each time a customer spends credit on a purchase.
    """
    txns = pd.DataFrame(columns=[
        "txn_id", "key", "customer_name", "txn_type", "txn_date", "txn_month",
        "gross_amount", "expiry_date", "credit_redeemed", "net_billed",
        "credit_balance_before", "credit_balance_after", "tier_after",
        "tier_credit_value_after", "ref_txn_id", "document_number", "notes",
    ])
    redemptions = pd.DataFrame(columns=[
        "redemption_id", "key", "txn_id", "redeem_date", "redeem_month",
        "amount", "notes",
    ])
    return txns, redemptions


def _norm_key(identifier: str) -> str:
    """
    Normalise a customer identifier.  Accepts an email (validated/lowercased)
    or any non-email business key (e.g. '2531651 Eddie Montalvo') which is
    just stripped.  This lets the engine group by email OR by the Excel's
    'Customer Name' column.
    """
    s = identifier.strip()
    if "@" in s:
        return validate_email(s)
    if not s:
        raise ValueError("Customer identifier cannot be empty.")
    return s


def _append(df: pd.DataFrame, row: dict) -> pd.DataFrame:
    new_row = pd.DataFrame([row])
    if df.empty:
        return new_row.reindex(columns=df.columns)
    return pd.concat([df, new_row], ignore_index=True)


def active_pool(txns: pd.DataFrame, key: str, as_of: date) -> float:
    """
    Σ net_billed of this customer's purchase/return rows whose 12-month
    window is open at `as_of`:  txn_date ≤ as_of < expiry_date.

    Because each row carries its own date and expiry, ordering of insertion
    is irrelevant — this is what fixes the out-of-order bug.
    """
    rows = txns[(txns["key"] == key) & txns["txn_type"].isin(["purchase", "return"])]
    if rows.empty:
        return 0.0
    open_mask = (rows["txn_date"] <= as_of) & (rows["expiry_date"] > as_of)
    return float(rows.loc[open_mask, "net_billed"].sum())


def current_tier(txns: pd.DataFrame, key: str, as_of: date) -> tuple[int, float]:
    return tier_for_cumulative(active_pool(txns, key, as_of))


def _redeemed_through(redemptions: pd.DataFrame, key: str, as_of: date) -> float:
    rows = redemptions[
        (redemptions["key"] == key) & (redemptions["redeem_date"] <= as_of)
    ]
    return float(rows["amount"].sum()) if len(rows) else 0.0


def credit_balance(
    txns: pd.DataFrame, redemptions: pd.DataFrame, key: str, as_of: date,
) -> float:
    """
    Available credit at `as_of`:
        earned (current rolling tier value) − redemptions to date, floored 0.
    Strict rolling: if the pool has dropped a tier, earned drops too.
    """
    _, earned = current_tier(txns, key, as_of)
    spent = _redeemed_through(redemptions, key, as_of)
    return max(0.0, earned - spent)


def _customer_name(txns: pd.DataFrame, key: str) -> str:
    rows = txns[txns["key"] == key]
    return str(rows.iloc[-1]["customer_name"]) if len(rows) else ""


def add_purchase(
    txns: pd.DataFrame,
    redemptions: pd.DataFrame,
    identifier: str,
    customer_name: str,
    amount: float,
    txn_date: date,
    credit_to_apply: float = 0.0,
    document_number: Optional[str] = None,
    notes: str = "",
) -> dict:
    """
    Record a purchase.  Updated frames in result['_txns'], result['_redemptions'].
    Credit availability is checked against the rolling balance AT txn_date.
    """
    key = _norm_key(identifier)
    customer_name = customer_name.strip()
    if not customer_name:
        raise ValueError("Customer name cannot be empty.")
    if amount <= 0:
        raise ValueError("Purchase amount must be positive.")
    if credit_to_apply < 0:
        raise ValueError("credit_to_apply cannot be negative.")
    if credit_to_apply > amount + 1e-9:
        raise ValueError(
            f"Credit ${credit_to_apply:.2f} exceeds purchase amount ${amount:.2f}."
        )

    credit_balance_before = credit_balance(txns, redemptions, key, txn_date)
    if credit_to_apply > credit_balance_before + 1e-9:
        raise ValueError(
            f"Credit ${credit_to_apply:.2f} exceeds available ${credit_balance_before:.2f}."
        )
    credit_to_apply = min(credit_to_apply, credit_balance_before)
    txn_id = str(uuid.uuid4())

    txns = _append(txns, {
        "txn_id": txn_id, "key": key, "customer_name": customer_name,
        "txn_type": "purchase",
        "txn_date": txn_date, "txn_month": txn_date.strftime("%Y-%m"),
        "gross_amount": amount,
        "expiry_date": add_months(txn_date, PURCHASE_TTL_MONTHS),
        "credit_redeemed": credit_to_apply,
        "net_billed": amount - credit_to_apply,
        "credit_balance_before": credit_balance_before,
        "credit_balance_after": None,
        "tier_after": None,
        "tier_credit_value_after": None,
        "ref_txn_id": None, "document_number": document_number, "notes": notes,
    })

    if credit_to_apply > 0:
        redemptions = _append(redemptions, {
            "redemption_id": str(uuid.uuid4()), "key": key, "txn_id": txn_id,
            "redeem_date": txn_date, "redeem_month": txn_date.strftime("%Y-%m"),
            "amount": credit_to_apply, "notes": f"Redeemed on {txn_id[:8]}",
        })

    tier_num, tier_credit_value = current_tier(txns, key, txn_date)
    credit_balance_after = credit_balance(txns, redemptions, key, txn_date)
    txns.loc[txns["txn_id"] == txn_id, [
        "credit_balance_after", "tier_after", "tier_credit_value_after",
    ]] = [credit_balance_after, tier_num, tier_credit_value]
    return {
        "txn_id": txn_id,
        "customer_name": customer_name,
        "gross_amount": amount,
        "document_number": document_number,
        "credit_used": credit_to_apply,
        "net_billed": amount - credit_to_apply,
        "credit_balance_before": credit_balance_before,
        "tier_after": tier_num,
        "tier_credit_value_after": tier_credit_value,
        "credit_balance": credit_balance_after,
        "_txns": txns,
        "_redemptions": redemptions,
    }


def process_return(
    txns: pd.DataFrame,
    redemptions: pd.DataFrame,
    identifier: str,
    ref_txn_id: str,
    return_amount: float,
    return_date: date,
    notes: str = "",
) -> dict:
    """Record a return against an existing purchase.  Inherits its window."""
    key = _norm_key(identifier)
    if return_amount <= 0:
        raise ValueError("Return amount must be positive.")
    orig = txns[
        (txns["txn_id"] == ref_txn_id)
        & (txns["key"] == key)
        & (txns["txn_type"] == "purchase")
    ]
    if orig.empty:
        raise ValueError(f"No purchase {ref_txn_id} for {key}.")
    orig_row = orig.iloc[0]
    already = txns[
        (txns["ref_txn_id"] == ref_txn_id) & (txns["txn_type"] == "return")
    ]["gross_amount"].sum()
    remaining = orig_row["net_billed"] + already  # already is negative
    if return_amount > remaining + 1e-9:
        raise ValueError(
            f"Return ${return_amount:.2f} exceeds remaining ${remaining:.2f}."
        )
    credit_balance_before = credit_balance(txns, redemptions, key, return_date)
    ret_id = str(uuid.uuid4())
    txns = _append(txns, {
        "txn_id": ret_id, "key": key,
        "customer_name": orig_row["customer_name"],
        "txn_type": "return",
        "txn_date": return_date, "txn_month": return_date.strftime("%Y-%m"),
        "gross_amount": -return_amount,
        "expiry_date": orig_row["expiry_date"],  # inherits original window
        "credit_redeemed": 0.0, "net_billed": -return_amount,
        "credit_balance_before": credit_balance_before,
        "credit_balance_after": None,
        "tier_after": None,
        "tier_credit_value_after": None,
        "ref_txn_id": ref_txn_id,
        "document_number": orig_row.get("document_number"),
        "notes": notes,
    })
    tier_num, tier_credit_value = current_tier(txns, key, return_date)
    credit_balance_after = credit_balance(txns, redemptions, key, return_date)
    txns.loc[txns["txn_id"] == ret_id, [
        "credit_balance_after", "tier_after", "tier_credit_value_after",
    ]] = [credit_balance_after, tier_num, tier_credit_value]
    return {
        "return_txn_id": ret_id,
        "return_amount": return_amount,
        "pool_after": active_pool(txns, key, return_date),
        "tier_after": tier_num,
        "tier_credit_value_after": tier_credit_value,
        "credit_balance": credit_balance_after,
        "_txns": txns,
        "_redemptions": redemptions,
    }


def lookup_transactions(
    txns: pd.DataFrame, identifier: str, as_of: Optional[date] = None,
) -> pd.DataFrame:
    """
    (1) All transaction rows for a customer, sorted by date.
    With as_of, adds 'active' (window open) and 'expired' columns.
    """
    key = _norm_key(identifier)
    df = txns[txns["key"] == key].drop(columns=["key"]).copy()
    if df.empty:
        return df.reset_index(drop=True)
    df = df.sort_values("txn_date").reset_index(drop=True)
    if as_of is not None:
        df["active"] = (df["txn_date"] <= as_of) & (df["expiry_date"] > as_of)
        df["expired"] = df["expiry_date"] <= as_of
    return df


def lookup_credits(
    txns: pd.DataFrame, redemptions: pd.DataFrame,
    identifier: str, as_of: Optional[date] = None,
) -> dict:
    """(2) Current credit state for a customer at `as_of`."""
    key = _norm_key(identifier)
    if as_of is None:
        as_of = date.today()
    pool = active_pool(txns, key, as_of)
    tier, credit_val = tier_for_cumulative(pool)
    return {
        "key": key,
        "customer_name": _customer_name(txns, key),
        "as_of": as_of,
        "active_pool": pool,
        "current_tier": tier,
        "tier_credit_value": credit_val,
        "credit_balance": credit_balance(txns, redemptions, key, as_of),
    }


def monthly_expiry_view(txns: pd.DataFrame, identifier: str) -> pd.DataFrame:
    """Per-month net amount scheduled to expire (by expiry month)."""
    key = _norm_key(identifier)
    rows = txns[
        (txns["key"] == key) & txns["txn_type"].isin(["purchase", "return"])
    ].copy()
    if rows.empty:
        return pd.DataFrame(columns=["expiry_month", "amount_expiring"])
    rows["expiry_month"] = pd.to_datetime(rows["expiry_date"]).dt.strftime("%Y-%m")
    return (
        rows.groupby("expiry_month")["net_billed"]
        .sum().reset_index()
        .rename(columns={"net_billed": "amount_expiring"})
        .sort_values("expiry_month")
    )


def clean_customer_name(name: str) -> str:
    """
    Strip a leading account-number prefix from a customer name.
    '3042650 Maria Mila' → 'Maria Mila'.  Names without a numeric prefix
    are returned stripped but otherwise unchanged.
    """
    if pd.isna(name):
        return ""
    return _LEADING_ID_RE.sub("", str(name)).strip()


def clean_document_number(value) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    return text


def sales_orders_from_excel(path: str) -> pd.DataFrame:
    raw = pd.read_excel(path)
    required = {"Date", "Document Number", "Customer Name", "Item", "Quantity", "Amount"}
    missing = required - set(raw.columns)
    if missing:
        raise ValueError(f"Excel missing columns: {missing}")

    clean = raw.copy()
    clean["Quantity"] = pd.to_numeric(clean["Quantity"], errors="coerce")
    clean["Amount"] = pd.to_numeric(clean["Amount"], errors="coerce")

    # Drop discount rows. In the current export they have blank Quantity, but
    # matching Item text too prevents discount amounts from leaking in if a
    # future export fills Quantity with 0 or 1.
    discount_mask = clean["Item"].astype(str).str.contains("discount", case=False, na=False)
    clean = clean[clean["Quantity"].notna() & clean["Amount"].notna() & ~discount_mask].copy()

    # Strip account-number prefix from customer names.
    clean["Customer Name"] = clean["Customer Name"].map(clean_customer_name)
    clean["Document Number"] = clean["Document Number"].map(clean_document_number)
    clean = clean[clean["Customer Name"].ne("") & clean["Document Number"].ne("")].copy()

    # Normalise dates to python date.
    clean["Date"] = pd.to_datetime(clean["Date"]).dt.date

    # Aggregate one order = same customer + document + date.
    return (
        clean.groupby(_ORDER_KEYS, as_index=False)["Amount"].sum()
        .sort_values(["Date", "Customer Name", "Document Number"])
        .reset_index(drop=True)
    )


def credit_usage_from_excel(path: str) -> pd.DataFrame:
    raw = pd.read_excel(path)
    required = {"Date", "Document Number", "Customer Name", "Credit Used"}
    missing = required - set(raw.columns)
    if missing:
        raise ValueError(f"Credit usage Excel missing columns: {missing}")

    clean = raw.copy()
    clean["Customer Name"] = clean["Customer Name"].map(clean_customer_name)
    clean["Document Number"] = clean["Document Number"].map(clean_document_number)
    clean["Date"] = pd.to_datetime(clean["Date"]).dt.date
    clean["Credit Used"] = pd.to_numeric(clean["Credit Used"], errors="coerce")
    clean = clean[clean["Customer Name"].ne("") & clean["Document Number"].ne("")].copy()

    if clean["Credit Used"].isna().any():
        raise ValueError("Credit usage Excel contains a non-numeric Credit Used value.")
    if (clean["Credit Used"] < 0).any():
        raise ValueError("Credit usage Excel cannot contain negative Credit Used values.")

    clean = clean[clean["Credit Used"] > 0].copy()
    if clean.empty:
        return pd.DataFrame(columns=[*_ORDER_KEYS, "Credit Used"])

    return (
        clean.groupby(_ORDER_KEYS, as_index=False)["Credit Used"].sum()
        .sort_values(["Date", "Customer Name", "Document Number"])
        .reset_index(drop=True)
    )


def load_from_excel(
    path: str,
    txns: Optional[pd.DataFrame] = None,
    redemptions: Optional[pd.DataFrame] = None,
    credit_usage_path: Optional[str] = None,
) -> tuple[pd.DataFrame, pd.DataFrame, list[dict]]:
    """
    Load purchases from a sales-line Excel export, optionally merging a
    separate credit-usage Excel onto matching purchase transactions.

    Expected columns: Date, Document Number, Customer Name, Item,
                      Quantity, Amount, Order Source.

    Rules:
      - Drop discount rows (blank Quantity).
      - Strip leading account-number prefix from Customer Name.
      - Aggregate line items sharing (Customer Name, Document Number, Date)
        into a single purchase = Σ Amount.
      - Feed each aggregated order to add_purchase in DATE ORDER.
      - Cleaned 'Customer Name' is the grouping key (no email in this data).

    Returns (txns, redemptions, results) where results is the per-order
    list of add_purchase return dicts.
    """
    if txns is None or redemptions is None:
        txns, redemptions = make_ledgers()

    orders = sales_orders_from_excel(path)
    orders["Credit Used"] = 0.0

    if credit_usage_path:
        usage = credit_usage_from_excel(credit_usage_path)
        if not usage.empty:
            missing_usage = usage.merge(
                orders[_ORDER_KEYS].drop_duplicates(),
                on=_ORDER_KEYS,
                how="left",
                indicator=True,
            )
            missing_usage = missing_usage[missing_usage["_merge"] == "left_only"]
            if not missing_usage.empty:
                sample = missing_usage.iloc[0]
                raise ValueError(
                    "Credit usage row does not match a purchase order: "
                    f"{sample['Customer Name']} / {sample['Document Number']} / {sample['Date']}"
                )

            orders = (
                orders.drop(columns=["Credit Used"])
                .merge(usage, on=_ORDER_KEYS, how="left")
            )
            orders["Credit Used"] = orders["Credit Used"].fillna(0.0)

    results = []
    for _, o in orders.iterrows():
        amount = round(float(o["Amount"]), 2)
        if amount <= 0:
            continue  # skip net-zero / net-negative aggregated orders
        credit_used = round(float(o["Credit Used"]), 2)
        try:
            r = add_purchase(
                txns, redemptions,
                identifier=str(o["Customer Name"]),
                customer_name=str(o["Customer Name"]),
                amount=amount,
                txn_date=o["Date"],
                credit_to_apply=credit_used,
                document_number=str(o["Document Number"]),
                notes=f"Doc {o['Document Number']}",
            )
        except ValueError as exc:
            raise ValueError(
                f"Could not apply credit usage for Doc {o['Document Number']} "
                f"({o['Customer Name']} on {o['Date']}): {exc}"
            ) from exc
        txns, redemptions = r["_txns"], r["_redemptions"]
        results.append(r)

    return txns, redemptions, results


def _json_safe(value):
    if isinstance(value, (date, pd.Timestamp)):
        return value.isoformat()
    if pd.isna(value):
        return None
    return value


def _json_records(df: pd.DataFrame) -> list[dict]:
    records = []
    for row in df.to_dict(orient="records"):
        records.append({key: _json_safe(value) for key, value in row.items()})
    return records


def credit_summary_frame(
    txns: pd.DataFrame, redemptions: pd.DataFrame, as_of: date,
) -> pd.DataFrame:
    rows = []
    for key in sorted(txns["key"].dropna().unique()):
        rows.append(lookup_credits(txns, redemptions, str(key), as_of))
    return pd.DataFrame(rows).sort_values("active_pool", ascending=False).reset_index(drop=True)


def customer_summary_frame(
    txns: pd.DataFrame, redemptions: pd.DataFrame, as_of: date,
) -> pd.DataFrame:
    rows = []
    for key in sorted(txns["key"].dropna().unique()):
        customer_txns = txns[(txns["key"] == key) & (txns["txn_type"] == "purchase")]
        credit_info = lookup_credits(txns, redemptions, str(key), as_of)
        rows.append({
            "key": key,
            "customer_name": credit_info["customer_name"],
            "total_transaction_cost": float(customer_txns["gross_amount"].sum()) if len(customer_txns) else 0.0,
            "currently_available_credits": credit_info["credit_balance"],
            "current_tier": credit_info["current_tier"],
            "used_credits": _redeemed_through(redemptions, str(key), as_of),
            "active_pool": credit_info["active_pool"],
            "as_of": as_of,
        })
    if not rows:
        return pd.DataFrame(columns=[
            "key", "customer_name", "total_transaction_cost",
            "currently_available_credits", "current_tier", "used_credits",
            "active_pool", "as_of",
        ])
    return (
        pd.DataFrame(rows)
        .sort_values(["currently_available_credits", "total_transaction_cost"], ascending=False)
        .reset_index(drop=True)
    )


def monthly_expiry_frame(txns: pd.DataFrame) -> pd.DataFrame:
    if txns.empty:
        return pd.DataFrame(columns=["key", "customer_name", "expiry_month", "amount_expiring"])

    rows = txns[txns["txn_type"].isin(["purchase", "return"])].copy()
    if rows.empty:
        return pd.DataFrame(columns=["key", "customer_name", "expiry_month", "amount_expiring"])

    rows["expiry_month"] = pd.to_datetime(rows["expiry_date"]).dt.strftime("%Y-%m")
    return (
        rows.groupby(["key", "customer_name", "expiry_month"], as_index=False)["net_billed"]
        .sum()
        .rename(columns={"net_billed": "amount_expiring"})
        .sort_values(["expiry_month", "customer_name"])
        .reset_index(drop=True)
    )


def export_excel_and_json(
    input_path: str,
    output_prefix: Optional[str] = None,
    as_of: Optional[date] = None,
    credit_usage_path: Optional[str] = None,
) -> tuple[Path, Path]:
    """
    Load a rebate workbook and export cleaned outputs:
      - Excel workbook with transactions, redemptions, credit summary, monthly expiry.
      - JSON file with the same tables plus metadata.
    """
    if as_of is None:
        as_of = date.today()

    input_file = Path(input_path)
    if output_prefix is None:
        output_base = input_file.with_name(f"{input_file.stem}_cleaned")
    else:
        output_base = Path(output_prefix)
        if output_base.suffix:
            output_base = output_base.with_suffix("")

    excel_path = output_base.with_suffix(".xlsx")
    json_path = output_base.with_suffix(".json")

    txns, redemptions, results = load_from_excel(str(input_file), credit_usage_path=credit_usage_path)
    summary = credit_summary_frame(txns, redemptions, as_of)
    customer_summary = customer_summary_frame(txns, redemptions, as_of)
    expiry = monthly_expiry_frame(txns)

    for output_path in (excel_path, json_path):
        try:
            output_path.unlink(missing_ok=True)
        except PermissionError as exc:
            raise PermissionError(
                f"Cannot overwrite {output_path}. Close the file if it is open."
            ) from exc

    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        txns.to_excel(writer, sheet_name="transactions", index=False)
        redemptions.to_excel(writer, sheet_name="redemptions", index=False)
        summary.to_excel(writer, sheet_name="credit_summary", index=False)
        customer_summary.to_excel(writer, sheet_name="customer_summary", index=False)
        expiry.to_excel(writer, sheet_name="monthly_expiry", index=False)

    payload = {
        "metadata": {
            "source_file": str(input_file),
            "credit_usage_file": str(Path(credit_usage_path)) if credit_usage_path else None,
            "as_of": as_of.isoformat(),
            "orders_loaded": len(results),
            "transactions": len(txns),
            "redemptions": len(redemptions),
        },
        "transactions": _json_records(txns),
        "redemptions": _json_records(redemptions),
        "credit_summary": _json_records(summary),
        "customer_summary": _json_records(customer_summary),
        "monthly_expiry": _json_records(expiry),
    }
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return excel_path, json_path
