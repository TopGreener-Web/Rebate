from __future__ import annotations

import os
import re
import unittest
import uuid
from datetime import date
from pathlib import Path

import pandas as pd

from lider_rebate_core import *
from lider_rebate_simulation import build_synthetic_excel


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


class TestRebate(unittest.TestCase):

    def setUp(self):
        self.txns, self.red = make_ledgers()
        self.email = "test@lider.com"
        self.name = "Test Buyer"

    def _buy(self, amt, dt, credit=0.0, name=None, key=None):
        r = add_purchase(self.txns, self.red, key or self.email,
                         name or self.name, amt, dt, credit)
        self.txns, self.red = r["_txns"], r["_redemptions"]
        return r

    def _ret(self, ref, amt, dt):
        r = process_return(self.txns, self.red, self.email, ref, amt, dt)
        self.txns, self.red = r["_txns"], r["_redemptions"]
        return r

    # ── the reported ordering bug ──
    def test_out_of_order_dates_pool(self):
        """3000 in 2024 then 2000 in 2022. Evaluated as of 2022-06,
        only the 2022 purchase should be in the pool."""
        self._buy(3000, date(2024, 1, 1))
        self._buy(2000, date(2022, 1, 1))
        # As of mid-2022: 2024 purchase hasn't happened yet
        self.assertAlmostEqual(active_pool(self.txns, self.email, date(2022, 6, 1)), 2000.0)
        # As of mid-2024: 2022 purchase (expires 2023) has expired,
        # only 2024 purchase active
        self.assertAlmostEqual(active_pool(self.txns, self.email, date(2024, 6, 1)), 3000.0)

    def test_out_of_order_lookup_status(self):
        """Status flags must reflect each row's own window vs as_of."""
        self._buy(3000, date(2024, 1, 1))
        self._buy(2000, date(2022, 1, 1))
        df = lookup_transactions(self.txns, self.email, date(2022, 6, 1))
        # sorted by date: 2022 row first (active), 2024 row second (not yet active)
        self.assertEqual(list(df["txn_date"]), [date(2022, 1, 1), date(2024, 1, 1)])
        self.assertEqual(list(df["active"]), [True, False])

    def test_two_purchases_never_both_active_if_year_apart(self):
        """2000 in 2022 and 3000 in 2024 are >1yr apart → never co-active."""
        self._buy(2000, date(2022, 1, 1))
        self._buy(3000, date(2024, 1, 1))
        # No single as_of date has both windows open
        for d in [date(2022, 6, 1), date(2023, 6, 1), date(2024, 6, 1)]:
            df = lookup_transactions(self.txns, self.email, d)
            self.assertLessEqual(df["active"].sum(), 1)

    # ── purchase basics ──
    def test_purchase_recorded(self):
        self._buy(1000, date(2024, 1, 1))
        self.assertEqual(len(lookup_transactions(self.txns, self.email)), 1)

    def test_customer_name_stored(self):
        self._buy(1000, date(2024, 1, 1))
        t = lookup_transactions(self.txns, self.email).iloc[0]
        self.assertEqual(t["customer_name"], "Test Buyer")

    def test_empty_name_raises(self):
        with self.assertRaises(ValueError):
            add_purchase(self.txns, self.red, self.email, "", 1000, date(2024, 1, 1))

    def test_expiry_12_months(self):
        self._buy(1000, date(2024, 1, 1))
        t = lookup_transactions(self.txns, self.email).iloc[0]
        self.assertEqual(t["expiry_date"], date(2025, 1, 1))

    def test_feb29_clamp(self):
        self._buy(1000, date(2024, 2, 29))
        t = lookup_transactions(self.txns, self.email).iloc[0]
        self.assertEqual(t["expiry_date"], date(2025, 2, 28))

    def test_negative_purchase_raises(self):
        with self.assertRaises(ValueError):
            self._buy(-1, date(2024, 1, 1))

    def test_zero_purchase_raises(self):
        with self.assertRaises(ValueError):
            self._buy(0, date(2024, 1, 1))

    # ── tier issuance ──
    def test_tier1_at_5000(self):
        self._buy(3000, date(2024, 3, 1))
        r = self._buy(2000, date(2024, 4, 1))
        self.assertAlmostEqual(r["credit_balance"], 200.0)

    def test_tier2_at_10000(self):
        self._buy(5000, date(2024, 1, 1))
        r = self._buy(5000, date(2024, 2, 1))
        self.assertAlmostEqual(r["credit_balance"], 425.0)

    def test_all_four_tiers(self):
        r = self._buy(20_000, date(2024, 1, 1))
        self.assertAlmostEqual(r["credit_balance"], 950.0)

    def test_tier_jump_0_to_3(self):
        r = self._buy(15_000, date(2024, 1, 1))
        self.assertAlmostEqual(r["credit_balance"], 675.0)

    def test_no_double_credit_same_tier(self):
        self._buy(6000, date(2024, 1, 1))
        r = self._buy(1000, date(2024, 2, 1))
        # pool $7000, still Tier 1 → balance $200, not $400
        self.assertAlmostEqual(r["credit_balance"], 200.0)

    # ── credit redemption ──
    def test_credit_reduces_net(self):
        self._buy(5000, date(2024, 1, 1))
        r = self._buy(1000, date(2024, 2, 1), credit=200)
        self.assertAlmostEqual(r["net_billed"], 800.0)

    def test_transaction_rows_store_credit_balance_before_and_after(self):
        first = self._buy(5000, date(2024, 1, 1))
        second = self._buy(1000, date(2024, 2, 1), credit=200)
        first_row = self.txns[self.txns["txn_id"] == first["txn_id"]].iloc[0]
        second_row = self.txns[self.txns["txn_id"] == second["txn_id"]].iloc[0]

        self.assertAlmostEqual(float(first_row["credit_balance_before"]), 0.0)
        self.assertAlmostEqual(float(first_row["credit_balance_after"]), 200.0)
        self.assertAlmostEqual(float(second_row["credit_balance_before"]), 200.0)
        self.assertAlmostEqual(float(second_row["credit_balance_after"]), 0.0)

    def test_partial_redemption(self):
        self._buy(5000, date(2024, 1, 1))
        r = self._buy(500, date(2024, 2, 1), credit=100)
        self.assertAlmostEqual(r["credit_balance"], 100.0)

    def test_over_credit_raises(self):
        self._buy(5000, date(2024, 1, 1))
        with self.assertRaises(ValueError):
            self._buy(500, date(2024, 2, 1), credit=500)

    def test_negative_credit_raises(self):
        self._buy(5000, date(2024, 1, 1))
        with self.assertRaises(ValueError):
            self._buy(500, date(2024, 2, 1), credit=-10)

    def test_credit_reduces_pool_contribution(self):
        self._buy(5000, date(2024, 1, 1))
        self._buy(1000, date(2024, 2, 1), credit=200)
        self.assertAlmostEqual(
            active_pool(self.txns, self.email, date(2024, 2, 1)), 5800.0
        )

    def test_credit_use_prevents_tier_crossing(self):
        """2k+3k+5k+5k(−100 credit) = 14,900 net < 15,000 → stays Tier 2."""
        self._buy(2000, date(2024, 4, 1))
        self._buy(3000, date(2024, 5, 1))   # Tier 1
        self._buy(5000, date(2024, 9, 1))   # Tier 2
        r = self._buy(5000, date(2024, 10, 1), credit=100)
        self.assertAlmostEqual(
            active_pool(self.txns, self.email, date(2024, 10, 1)), 14900.0
        )
        self.assertEqual(r["tier_after"], 2)
        self.assertAlmostEqual(r["credit_balance"], 325.0)  # 425 − 100

    # ── full spec scenario ──
    def test_spec_scenario(self):
        """Mar 3k → Apr 2k (Tier1) → Jul 5k using 200 credit.
        Net pool 9,800 → Tier 1, balance 0 after spending."""
        r1 = self._buy(3000, date(2024, 3, 1))
        self.assertAlmostEqual(r1["credit_balance"], 0.0)
        r2 = self._buy(2000, date(2024, 4, 1))
        self.assertAlmostEqual(r2["credit_balance"], 200.0)
        r3 = self._buy(5000, date(2024, 7, 1), credit=200)
        self.assertAlmostEqual(r3["net_billed"], 4800.0)
        self.assertAlmostEqual(
            active_pool(self.txns, self.email, date(2024, 7, 1)), 9800.0
        )
        self.assertAlmostEqual(r3["credit_balance"], 0.0)

    # ── rolling expiry ──
    def test_expired_excluded(self):
        self._buy(3000, date(2024, 3, 1))
        self._buy(2000, date(2024, 4, 1))
        self.assertAlmostEqual(
            active_pool(self.txns, self.email, date(2025, 3, 2)), 2000.0
        )

    def test_status_flags(self):
        self._buy(3000, date(2024, 3, 1))
        self._buy(2000, date(2024, 4, 1))
        df = lookup_transactions(self.txns, self.email, date(2025, 3, 2))
        # 2024-03 expired by 2025-03-02; 2024-04 still active
        self.assertEqual(list(df["expired"]), [True, False])
        self.assertEqual(list(df["active"]), [False, True])

    def test_credit_lapses_when_pool_expires(self):
        """Tier 1 earned; a year later pool empty → balance 0 (strict rolling)."""
        self._buy(5000, date(2024, 1, 1))
        self.assertAlmostEqual(
            credit_balance(self.txns, self.red, self.email, date(2024, 6, 1)), 200.0
        )
        # As of 2025-02 the purchase has expired → pool 0 → Tier 0 → balance 0
        self.assertAlmostEqual(
            credit_balance(self.txns, self.red, self.email, date(2025, 2, 1)), 0.0
        )

    def test_no_phantom_credit_far_future_purchase(self):
        """Reported bug: 5k in 1999, 1k in 2022.
        At 2022 the old purchase is long expired → no credit available."""
        self._buy(5000, date(1999, 12, 1))
        r = self._buy(1000, date(2022, 1, 1))
        self.assertAlmostEqual(r["credit_balance"], 0.0)
        self.assertAlmostEqual(
            active_pool(self.txns, self.email, date(2022, 1, 1)), 1000.0
        )

    def test_monthly_expiry(self):
        self._buy(3000, date(2024, 3, 1))
        self._buy(2000, date(2024, 4, 1))
        df = monthly_expiry_view(self.txns, self.email)
        self.assertEqual(len(df), 2)
        self.assertIn("2025-03", list(df["expiry_month"]))

    # ── returns ──
    def test_return_reduces_pool(self):
        r = self._buy(5000, date(2024, 1, 1))
        self._ret(r["txn_id"], 1000, date(2024, 2, 1))
        self.assertAlmostEqual(
            active_pool(self.txns, self.email, date(2024, 2, 1)), 4000.0
        )

    def test_return_drops_tier(self):
        r = self._buy(5500, date(2024, 1, 1))  # Tier 1
        ret = self._ret(r["txn_id"], 600, date(2024, 2, 1))  # pool 4900
        self.assertAlmostEqual(ret["credit_balance"], 0.0)

    def test_return_keeps_tier_if_above(self):
        r = self._buy(6000, date(2024, 1, 1))
        ret = self._ret(r["txn_id"], 500, date(2024, 2, 1))  # pool 5500
        self.assertAlmostEqual(ret["credit_balance"], 200.0)

    def test_return_inherits_name(self):
        r = self._buy(5000, date(2024, 1, 1))
        self._ret(r["txn_id"], 1000, date(2024, 2, 1))
        txns = lookup_transactions(self.txns, self.email)
        ret_row = txns[txns["txn_type"] == "return"].iloc[0]
        self.assertEqual(ret_row["customer_name"], "Test Buyer")

    def test_return_exceeds_raises(self):
        r = self._buy(1000, date(2024, 1, 1))
        with self.assertRaises(ValueError):
            self._ret(r["txn_id"], 1500, date(2024, 2, 1))

    def test_multiple_partial_returns(self):
        r = self._buy(6000, date(2024, 1, 1))
        self._ret(r["txn_id"], 200, date(2024, 2, 1))
        self._ret(r["txn_id"], 300, date(2024, 3, 1))
        self.assertAlmostEqual(
            active_pool(self.txns, self.email, date(2024, 3, 1)), 5500.0
        )

    def test_return_wrong_key_raises(self):
        r = add_purchase(self.txns, self.red, "other@x.com", "Other",
                         1000, date(2024, 1, 1))
        self.txns, self.red = r["_txns"], r["_redemptions"]
        with self.assertRaises(ValueError):
            self._ret(r["txn_id"], 500, date(2024, 2, 1))

    # ── multi-customer ──
    def test_customers_isolated(self):
        self._buy(5000, date(2024, 1, 1), key="a@x.com", name="Alice")
        self._buy(1000, date(2024, 1, 1), key="b@x.com", name="Bob")
        self.assertAlmostEqual(
            credit_balance(self.txns, self.red, "a@x.com", date(2024, 6, 1)), 200.0
        )
        self.assertAlmostEqual(
            credit_balance(self.txns, self.red, "b@x.com", date(2024, 6, 1)), 0.0
        )

    # ── non-email business key (Excel customer names) ──
    def test_business_key_accepted(self):
        r = self._buy(5000, date(2024, 1, 1), key="2531651 Eddie Montalvo",
                      name="2531651 Eddie Montalvo")
        self.assertAlmostEqual(r["credit_balance"], 200.0)

    def test_email_normalised_lowercase(self):
        r1 = self._buy(3000, date(2024, 1, 1), key="Buyer@LIDER.com", name="B")
        r2 = self._buy(2000, date(2024, 2, 1), key="buyer@lider.com", name="B")
        # same customer → Tier 1 reached
        self.assertAlmostEqual(r2["credit_balance"], 200.0)

    # ── email validation ──
    def test_bad_email_raises(self):
        with self.assertRaises(ValueError):
            add_purchase(self.txns, self.red, "user @test.com", "X",
                         1000, date(2024, 1, 1))

    # ── lookup_credits ──
    def test_lookup_credits(self):
        self._buy(10_000, date(2024, 1, 1))
        info = lookup_credits(self.txns, self.red, self.email, date(2024, 6, 1))
        self.assertEqual(info["current_tier"], 2)
        self.assertAlmostEqual(info["credit_balance"], 425.0)
        self.assertEqual(info["customer_name"], "Test Buyer")

    def test_txn_month_peg(self):
        self._buy(1000, date(2024, 7, 15))
        t = lookup_transactions(self.txns, self.email).iloc[0]
        self.assertEqual(t["txn_month"], "2024-07")

    def test_customer_summary_frame(self):
        self._buy(5000, date(2024, 1, 1))
        self._buy(1000, date(2024, 2, 1), credit=200)
        summary = customer_summary_frame(self.txns, self.red, date(2024, 3, 1))
        row = summary[summary["key"] == self.email].iloc[0]
        self.assertAlmostEqual(float(row["total_transaction_cost"]), 6000.0)
        self.assertAlmostEqual(float(row["currently_available_credits"]), 0.0)
        self.assertEqual(int(row["current_tier"]), 1)
        self.assertAlmostEqual(float(row["used_credits"]), 200.0)

    def test_credit_cannot_exceed_purchase_amount(self):
        self._buy(25_000, date(2024, 1, 1))
        with self.assertRaisesRegex(ValueError, "exceeds purchase amount"):
            self._buy(100, date(2024, 2, 1), credit=200)


class TestExcelIngestion(unittest.TestCase):

    PATH = _default_rebate_xlsx_path()

    def test_load_excel(self):
        import os
        if not os.path.exists(self.PATH):
            self.skipTest("Rebate.xlsx not present")
        txns, red, results = load_from_excel(self.PATH)
        # 18 distinct orders expected from the provided file
        self.assertEqual(len(results), 18)
        # No discount rows leaked in (all gross amounts positive)
        self.assertTrue((txns["gross_amount"] > 0).all())

    def test_excel_aggregates_line_items(self):
        import os
        if not os.path.exists(self.PATH):
            self.skipTest("Rebate.xlsx not present")
        txns, red, results = load_from_excel(self.PATH)
        # Maria Mila's single order aggregates two items (564.12 + 15.39)
        maria = txns[txns["customer_name"].str.contains("Maria Mila")]
        self.assertEqual(len(maria), 1)
        self.assertAlmostEqual(float(maria.iloc[0]["gross_amount"]), 579.51, places=2)

    def test_excel_multi_order_customer(self):
        import os
        if not os.path.exists(self.PATH):
            self.skipTest("Rebate.xlsx not present")
        txns, red, results = load_from_excel(self.PATH)
        # Eddie Montalvo has 3 separate orders (3 distinct documents)
        eddie = txns[txns["customer_name"].str.contains("Eddie Montalvo")]
        self.assertEqual(len(eddie), 3)

    def test_excel_names_stripped_of_prefix(self):
        import os
        if not os.path.exists(self.PATH):
            self.skipTest("Rebate.xlsx not present")
        txns, red, results = load_from_excel(self.PATH)
        # No customer_name should start with digits
        for n in txns["customer_name"].unique():
            self.assertFalse(re.match(r"^\d", n), f"prefix not stripped: {n}")
        # Specifically Maria's name is clean
        self.assertIn("Maria Mila", set(txns["customer_name"]))
        self.assertNotIn("3042650 Maria Mila", set(txns["customer_name"]))

    def test_discount_item_ignored_even_if_quantity_present(self):
        path = Path.cwd() / f"discount_quantity_present_{uuid.uuid4().hex}.xlsx"
        try:
            pd.DataFrame([
                {
                    "Date": date(2026, 1, 1),
                    "Document Number": "SO1",
                    "Customer Name": "3042650 Maria Mila",
                    "Item": "MPC-50V-W",
                    "Quantity": 10,
                    "Amount": 1000.0,
                    "Order Source": "B2B",
                },
                {
                    "Date": date(2026, 1, 1),
                    "Document Number": "SO1",
                    "Customer Name": "3042650 Maria Mila",
                    "Item": "TopGreener.com Discount",
                    "Quantity": 1,
                    "Amount": -200.0,
                    "Order Source": "B2B",
                },
            ]).to_excel(path, index=False)

            txns, red, results = load_from_excel(str(path))
            self.assertEqual(len(results), 1)
            self.assertEqual(txns.iloc[0]["customer_name"], "Maria Mila")
            self.assertAlmostEqual(float(txns.iloc[0]["gross_amount"]), 1000.0)
        finally:
            path.unlink(missing_ok=True)

    def test_credit_usage_file_applies_to_matching_transaction(self):
        purchase_path = Path.cwd() / f"credit_purchase_{uuid.uuid4().hex}.xlsx"
        credit_path = Path.cwd() / f"credit_usage_{uuid.uuid4().hex}.xlsx"
        try:
            pd.DataFrame([
                {
                    "Date": date(2025, 1, 1),
                    "Document Number": "SO1",
                    "Customer Name": "1000001 Andrea",
                    "Item": "WIDGET-A",
                    "Quantity": 100,
                    "Amount": 5000.0,
                    "Order Source": "B2B",
                },
                {
                    "Date": date(2025, 2, 1),
                    "Document Number": "SO2",
                    "Customer Name": "1000001 Andrea",
                    "Item": "WIDGET-B",
                    "Quantity": 10,
                    "Amount": 1000.0,
                    "Order Source": "B2B",
                },
            ]).to_excel(purchase_path, index=False)
            pd.DataFrame([
                {
                    "Date": date(2025, 2, 1),
                    "Document Number": "SO2",
                    "Customer Name": "Andrea",
                    "Credit Used": 200.0,
                },
            ]).to_excel(credit_path, index=False)

            txns, red, results = load_from_excel(str(purchase_path), credit_usage_path=str(credit_path))
            credited = txns[txns["credit_redeemed"] > 0].iloc[0]
            self.assertEqual(len(results), 2)
            self.assertEqual(len(red), 1)
            self.assertAlmostEqual(float(credited["gross_amount"]), 1000.0)
            self.assertAlmostEqual(float(credited["credit_redeemed"]), 200.0)
            self.assertAlmostEqual(float(credited["net_billed"]), 800.0)
        finally:
            purchase_path.unlink(missing_ok=True)
            credit_path.unlink(missing_ok=True)

    def test_credit_usage_file_rejects_unknown_transaction(self):
        purchase_path = Path.cwd() / f"credit_purchase_{uuid.uuid4().hex}.xlsx"
        credit_path = Path.cwd() / f"credit_usage_{uuid.uuid4().hex}.xlsx"
        try:
            pd.DataFrame([
                {
                    "Date": date(2025, 1, 1),
                    "Document Number": "SO1",
                    "Customer Name": "1000001 Andrea",
                    "Item": "WIDGET-A",
                    "Quantity": 100,
                    "Amount": 5000.0,
                    "Order Source": "B2B",
                },
            ]).to_excel(purchase_path, index=False)
            pd.DataFrame([
                {
                    "Date": date(2025, 1, 1),
                    "Document Number": "SO-MISSING",
                    "Customer Name": "Andrea",
                    "Credit Used": 200.0,
                },
            ]).to_excel(credit_path, index=False)

            with self.assertRaisesRegex(ValueError, "does not match a purchase order"):
                load_from_excel(str(purchase_path), credit_usage_path=str(credit_path))
        finally:
            purchase_path.unlink(missing_ok=True)
            credit_path.unlink(missing_ok=True)


class TestCleanCustomerName(unittest.TestCase):

    def test_strip_numeric_prefix(self):
        self.assertEqual(clean_customer_name("3042650 Maria Mila"), "Maria Mila")

    def test_strip_with_extra_spaces(self):
        self.assertEqual(clean_customer_name("  2531651   Eddie Montalvo"), "Eddie Montalvo")

    def test_no_prefix_unchanged(self):
        self.assertEqual(clean_customer_name("Maria Mila"), "Maria Mila")

    def test_name_with_internal_digits_kept(self):
        # only leading prefix stripped; digits inside the name stay
        self.assertEqual(clean_customer_name("12345 Studio 54 LLC"), "Studio 54 LLC")

    def test_short_leading_number_kept(self):
        self.assertEqual(clean_customer_name("3 Amigos LLC"), "3 Amigos LLC")

    def test_all_caps_name(self):
        self.assertEqual(clean_customer_name("2238328 CHIP HARPER"), "CHIP HARPER")


class TestSyntheticMultiYear(unittest.TestCase):
    """Generate a 2022–2026 Excel in the real format and verify rolling logic."""

    @classmethod
    def setUpClass(cls):
        cls.path = str(Path.cwd() / f"test_multiyear_{uuid.uuid4().hex}.xlsx")
        build_synthetic_excel(cls.path)

    @classmethod
    def tearDownClass(cls):
        Path(cls.path).unlink(missing_ok=True)

    def test_file_loads(self):
        txns, red, results = load_from_excel(self.path)
        self.assertGreater(len(results), 0)
        self.assertTrue((txns["gross_amount"] > 0).all())

    def test_discounts_dropped(self):
        # raw has discount rows; loaded txns must all be positive
        raw = pd.read_excel(self.path)
        self.assertTrue((raw["Quantity"].isna()).any())  # discounts present in raw
        txns, red, _ = load_from_excel(self.path)
        self.assertTrue((txns["gross_amount"] > 0).all())

    def test_names_clean(self):
        txns, red, _ = load_from_excel(self.path)
        for n in txns["customer_name"].unique():
            self.assertFalse(re.match(r"^\d", n))

    def test_rolling_tier_steady_buyer(self):
        """'Steady Buyer' makes 5k every Q1 2022-2026. At any eval date only
        a trailing-12-month window counts, so tier stays at Tier 1, never stacks."""
        txns, red, _ = load_from_excel(self.path)
        key = "Steady Buyer"
        # Mid-2023: only the 2023 Q1 purchase (5k) is within trailing 12mo
        info = lookup_credits(txns, red, key, date(2023, 6, 1))
        self.assertEqual(info["current_tier"], 1)
        self.assertAlmostEqual(info["active_pool"], 5000.0)

    def test_rolling_window_two_purchases_same_year(self):
        """'Ramp Buyer' makes 6k in Jan 2024 and 6k in Jun 2024 → both within
        12mo of Aug 2024 → pool 12k → Tier 2."""
        txns, red, _ = load_from_excel(self.path)
        key = "Ramp Buyer"
        info = lookup_credits(txns, red, key, date(2024, 8, 1))
        self.assertAlmostEqual(info["active_pool"], 12000.0)
        self.assertEqual(info["current_tier"], 2)
        # By Feb 2025 the Jan 2024 purchase has expired → only 6k left → Tier 1
        info2 = lookup_credits(txns, red, key, date(2025, 2, 1))
        self.assertAlmostEqual(info2["active_pool"], 6000.0)
        self.assertEqual(info2["current_tier"], 1)

    def test_big_buyer_tier4(self):
        """'Whale Co' single 25k order in 2025 → Tier 4 while in window."""
        txns, red, _ = load_from_excel(self.path)
        key = "Whale Co"
        info = lookup_credits(txns, red, key, date(2025, 7, 1))
        self.assertEqual(info["current_tier"], 4)
        self.assertAlmostEqual(info["credit_balance"], 950.0)

    def test_aggregation_in_synthetic(self):
        """'Multi Line Co' has one order with 3 line items → 1 aggregated txn."""
        txns, red, _ = load_from_excel(self.path)
        rows = txns[txns["customer_name"] == "Multi Line Co"]
        self.assertEqual(len(rows), 1)
        self.assertAlmostEqual(float(rows.iloc[0]["gross_amount"]), 5500.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
