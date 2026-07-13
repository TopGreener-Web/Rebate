from __future__ import annotations

import random
from datetime import date, timedelta

import pandas as pd

from lider_rebate_core import (
    add_purchase,
    credit_balance,
    make_ledgers,
    sales_orders_from_excel,
)


def build_synthetic_excel(path: str) -> str:
    """
    Write a 2022–2026 Excel in the SAME format as the real export:
    columns Date, Document Number, Customer Name, Item, Quantity, Amount,
    Order Source.  Includes:
      - numeric-prefixed customer names (to test stripping)
      - discount rows with blank Quantity (to test filtering)
      - multi-line orders sharing one Document Number (to test aggregation)
      - purchases spread across 2022-2026 (to test rolling expiry)

    Returns the path written.
    """
    rows: list[dict] = []
    doc_counter = [70000]

    def order(cust, dt, line_items, with_discount=True):
        """line_items: list of (item, qty, amount).  Optionally add a discount row."""
        doc = f"SO{doc_counter[0]:010d}"
        doc_counter[0] += 1
        for item, qty, amt in line_items:
            rows.append({
                "Date": dt, "Document Number": doc, "Customer Name": cust,
                "Item": item, "Quantity": qty, "Amount": amt, "Order Source": "B2B",
            })
            if with_discount:
                rows.append({
                    "Date": dt, "Document Number": doc, "Customer Name": cust,
                    "Item": "TopGreener.com Discount", "Quantity": None,
                    "Amount": -round(amt * 0.1, 2), "Order Source": "B2B",
                })

    # Steady Buyer: 5k every Q1, 2022-2026 (one order/year → rolling Tier 1)
    for yr in range(2022, 2027):
        order("1000001 Steady Buyer", date(yr, 2, 15),
              [("WIDGET-A", 100, 5000.0)])

    # Ramp Buyer: two 6k orders within 2024 (Jan + Jun) → Tier 2 mid-2024
    order("1000002 Ramp Buyer", date(2024, 1, 10), [("WIDGET-B", 120, 6000.0)])
    order("1000002 Ramp Buyer", date(2024, 6, 10), [("WIDGET-B", 120, 6000.0)])

    # Whale Co: single 25k order in 2025 → Tier 4
    order("1000003 Whale Co", date(2025, 3, 1), [("BULK-X", 500, 25000.0)])

    # Multi Line Co: one order, three line items → aggregate to 5500
    order("1000004 Multi Line Co", date(2023, 9, 5),
          [("ITEM-1", 10, 2000.0), ("ITEM-2", 20, 2500.0), ("ITEM-3", 5, 1000.0)])

    # Small Fry: tiny orders that never reach a tier
    order("1000005 Small Fry", date(2022, 5, 1), [("TRINKET", 2, 50.0)])
    order("1000005 Small Fry", date(2026, 1, 1), [("TRINKET", 3, 75.0)])

    # Late Bloomer: nothing until 2026, then 15k → Tier 3
    order("1000006 Late Bloomer", date(2026, 2, 20), [("GEAR-Z", 300, 15000.0)])

    df = pd.DataFrame(rows, columns=[
        "Date", "Document Number", "Customer Name", "Item",
        "Quantity", "Amount", "Order Source",
    ])
    df.to_excel(path, index=False)
    return path


def build_synthetic_500_excel(path: str, record_count: int = 500) -> str:
    """
    Write a deterministic 500-record Excel export in the real source format.

    The generated rows use exactly 10 customer names, include leading account
    numbers so the cleaner can strip them, and keep purchase dates between
    2025-01-01 and 2026-06-06 inclusive.
    """
    if record_count <= 0:
        raise ValueError("record_count must be positive")

    rng = random.Random(20260619)
    start_date = date(2025, 1, 1)
    end_date = date(2026, 6, 6)
    date_span = (end_date - start_date).days

    customers = [
        ("3000001", "Andrew de Freitas", 0.45),
        ("3000002", "Andrew Gonzalez", 0.65),
        ("3000003", "Braden Giles", 0.75),
        ("3000004", "Britt Robertson", 0.85),
        ("3000005", "CHIP HARPER", 1.00),
        ("3000006", "Eddie Montalvo", 1.15),
        ("3000007", "GENA SANDER", 1.35),
        ("3000008", "Jerel Luna", 1.55),
        ("3000009", "Joseph Esposito", 1.80),
        ("3000010", "Katrina Perasso", 2.10),
    ]
    items = [
        ("TG-15A-SWITCH", 28.0),
        ("TG-DIMMER-KIT", 44.0),
        ("TG-OUTLET-GFCI", 31.0),
        ("TG-SENSOR-WALL", 58.0),
        ("TG-USB-RECEPT", 36.0),
        ("TG-LED-DRIVER", 72.0),
        ("TG-WALL-PLATE", 12.0),
        ("TG-CONTRACTOR-PACK", 96.0),
    ]
    quantities = [4, 6, 8, 10, 12, 16, 20, 24, 30, 36]
    sources = ["B2B", "Manual", "Web"]

    rows: list[dict] = []
    for index in range(record_count):
        account, customer_name, amount_scale = customers[index % len(customers)]
        item, base_price = rng.choice(items)
        quantity = rng.choice(quantities)
        unit_price = round(base_price * amount_scale * rng.uniform(0.82, 1.24), 2)
        amount = round(quantity * unit_price, 2)
        purchase_date = start_date + timedelta(days=rng.randint(0, date_span))

        rows.append({
            "Date": purchase_date,
            "Document Number": f"SO{9000000000 + index + 1}",
            "Customer Name": f"{account} {customer_name}",
            "Item": item,
            "Quantity": quantity,
            "Amount": amount,
            "Order Source": rng.choice(sources),
        })

    df = (
        pd.DataFrame(rows, columns=[
            "Date", "Document Number", "Customer Name", "Item",
            "Quantity", "Amount", "Order Source",
        ])
        .sort_values(["Date", "Customer Name", "Document Number"])
        .reset_index(drop=True)
    )
    df.to_excel(path, index=False)
    return path


def build_synthetic_credit_usage_excel(
    purchase_path: str,
    output_path: str,
    target_usage_rows: int = 60,
) -> str:
    """
    Write a separate simulated credit-usage workbook.

    Rows match purchase transactions by Customer Name + Document Number + Date.
    The generated credit values are only written when the customer has enough
    available credit at that purchase date.
    """
    if target_usage_rows <= 0:
        raise ValueError("target_usage_rows must be positive")

    rng = random.Random(20260620)
    orders = sales_orders_from_excel(purchase_path)
    txns, redemptions = make_ledgers()
    usage_rows: list[dict] = []

    for _, order in orders.iterrows():
        customer = str(order["Customer Name"])
        txn_date = order["Date"]
        amount = round(float(order["Amount"]), 2)
        available = credit_balance(txns, redemptions, customer, txn_date)
        max_credit = min(available, amount)
        credit_used = 0.0

        if len(usage_rows) < target_usage_rows and max_credit >= 50:
            options = [value for value in (50.0, 100.0, 200.0, 425.0, 675.0, 950.0) if value <= max_credit]
            if options and (max_credit >= 200 or rng.random() < 0.65):
                credit_used = min(rng.choice(options), amount)

        if credit_used > 0:
            usage_rows.append({
                "Date": txn_date,
                "Document Number": order["Document Number"],
                "Customer Name": customer,
                "Credit Used": credit_used,
                "Notes": f"{customer} used ${credit_used:,.0f} credit on this transaction.",
            })

        result = add_purchase(
            txns,
            redemptions,
            identifier=customer,
            customer_name=customer,
            amount=amount,
            txn_date=txn_date,
            credit_to_apply=credit_used,
            document_number=str(order["Document Number"]),
            notes=f"Doc {order['Document Number']}",
        )
        txns, redemptions = result["_txns"], result["_redemptions"]

    if not usage_rows:
        raise ValueError("No valid credit-usage rows could be generated.")

    df = pd.DataFrame(
        usage_rows,
        columns=["Date", "Document Number", "Customer Name", "Credit Used", "Notes"],
    )
    df.to_excel(output_path, index=False)
    return output_path
