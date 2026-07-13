const DATA_URL = "./rebate-data.json";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const elements = {
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  panels: Array.from(document.querySelectorAll(".view-panel")),
  contentStage: document.querySelector("#contentStage"),
  viewTitle: document.querySelector("#viewTitle"),
  todayLabel: document.querySelector("#todayLabel"),
  metricGrid: document.querySelector("#metricGrid"),
  poolGrowthBars: document.querySelector("#poolGrowthBars"),
  poolGrowthSummary: document.querySelector("#poolGrowthSummary"),
  tierBreakdown: document.querySelector("#tierBreakdown"),
  activityList: document.querySelector("#activityList"),
  customerSummaryGrid: document.querySelector("#customerSummaryGrid"),
  summarySearch: document.querySelector("#summarySearch"),
  customerSearch: document.querySelector("#customerSearch"),
  showExpired: document.querySelector("#showExpired"),
  bucketButtons: Array.from(document.querySelectorAll(".bucket-button")),
  ledgerBody: document.querySelector("#ledgerBody"),
  rowCount: document.querySelector("#rowCount")
};

const state = {
  view: "dashboard",
  query: "",
  summaryQuery: "",
  bucket: "all",
  showExpired: true
};

const today = startOfDay(new Date());

let customers = [];
let ledgerRows = [];
let monthlyQualifiedPool = [];
let customerSummaries = [];
let summaryByKey = new Map();
let asOfDate = today;

const bucketDefinitions = [
  { key: "expired", label: "Expired", metricLabel: "Expired", min: Number.NEGATIVE_INFINITY, max: -1 },
  { key: "7", label: "0-7 days", metricLabel: "7-day risk", min: 0, max: 7 },
  { key: "30", label: "8-30 days", metricLabel: "30-day watch", min: 8, max: 30 },
  { key: "60", label: "31-60 days", metricLabel: "60-day view", min: 31, max: 60 },
  { key: "later", label: "60+ days", metricLabel: "Later", min: 61, max: Number.POSITIVE_INFINITY }
];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setMonth(next.getMonth() + months);

  if (next.getDate() !== originalDay) {
    next.setDate(0);
  }

  return next;
}

function parseLocalDate(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function bucketForDays(days) {
  return (
    bucketDefinitions.find((bucket) => days >= bucket.min && days <= bucket.max) ||
    bucketDefinitions[bucketDefinitions.length - 1]
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatMonth(value) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function formatDaysLeft(days) {
  if (days < 0) {
    return `Expired ${Math.abs(days)}d`;
  }

  if (days === 0) {
    return "Today";
  }

  return String(days);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + row[field], 0);
}

function uniqueCount(rows, field) {
  return new Set(rows.map((row) => row[field])).size;
}

function rowsForBucket(key) {
  if (key === "all") {
    return ledgerRows;
  }

  return ledgerRows.filter((row) => row.bucketKey === key);
}

function tierLabel(tier) {
  if (tier === null || tier === undefined || tier === "") {
    return "Tier 0";
  }

  return String(tier).startsWith("Tier") ? String(tier) : `Tier ${tier}`;
}

function documentNumberFromTransaction(transaction) {
  if (transaction.document_number) {
    return transaction.document_number;
  }

  const match = String(transaction.notes || "").match(/\bDoc\s+(.+)$/);
  return match ? match[1] : "";
}

function normalizeExportTransaction(transaction) {
  const key = transaction.key || transaction.customer_name || "Unknown Customer";
  const summary = summaryByKey.get(key) || {};
  const expirationDate = parseLocalDate(transaction.expiry_date);
  const purchaseDate = parseLocalDate(transaction.txn_date);
  const daysLeft = expirationDate ? Math.round((expirationDate.getTime() - asOfDate.getTime()) / MS_PER_DAY) : 0;
  const bucket = bucketForDays(daysLeft);

  return {
    key,
    transactionId: transaction.txn_id,
    documentNumber: documentNumberFromTransaction(transaction),
    name: transaction.customer_name || key,
    tier: tierLabel(transaction.tier_after ?? summary.current_tier),
    expiresInDays: daysLeft,
    qualifiedAmount: Number(transaction.net_billed || transaction.gross_amount || 0),
    grossAmount: Number(transaction.gross_amount || 0),
    creditEarned: Number(transaction.tier_credit_value_after ?? summary.tier_credit_value ?? 0),
    creditUsed: Number(transaction.credit_redeemed || 0),
    creditBalanceBefore: Number(transaction.credit_balance_before ?? summary.credit_balance ?? 0),
    creditBalance: Number(transaction.credit_balance_after ?? summary.credit_balance ?? 0),
    activePool: Number(summary.active_pool || 0),
    notes: transaction.notes || "",
    purchaseDate,
    expirationDate,
    bucketKey: bucket.key,
    bucketLabel: bucket.label
  };
}

function buildMonthlyQualifiedPool(rows) {
  const months = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const monthDate = addMonths(asOfDate, -offset);
    const evaluationDate =
      monthDate.getFullYear() === asOfDate.getFullYear() && monthDate.getMonth() === asOfDate.getMonth()
        ? asOfDate
        : endOfMonth(monthDate);
    const totalQualifiedPool = rows
      .filter((row) => row.purchaseDate && row.expirationDate)
      .filter((row) => row.purchaseDate <= evaluationDate && row.expirationDate > evaluationDate)
      .reduce((total, row) => total + row.qualifiedAmount, 0);

    months.push({
      month: monthKey(evaluationDate),
      totalQualifiedPool
    });
  }

  return months;
}

async function loadDashboardData() {
  const response = await fetch(DATA_URL);

  if (!response.ok) {
    throw new Error(`Could not load ${DATA_URL}.`);
  }

  const payload = await response.json();
  // Use the live dashboard date for expiration math. The export's metadata.as_of
  // describes when the source file was generated, but days-left should age daily.
  asOfDate = today;
  const creditSummaries = payload.credit_summary || [];
  customerSummaries = payload.customer_summary && payload.customer_summary.length ? payload.customer_summary : creditSummaries;
  summaryByKey = new Map(creditSummaries.map((summary) => [summary.key, summary]));
  ledgerRows = (payload.transactions || []).map(normalizeExportTransaction);
  const transactionTotals = ledgerRows.reduce((totals, row) => {
    const current = totals.get(row.key) || { gross: 0, used: 0 };
    current.gross += row.grossAmount;
    current.used += row.creditUsed;
    totals.set(row.key, current);
    return totals;
  }, new Map());
  customers = customerSummaries.map((summary) => {
    const creditSummary = summaryByKey.get(summary.key) || summary;
    const totals = transactionTotals.get(summary.key) || { gross: 0, used: 0 };

    return {
      key: summary.key,
      name: summary.customer_name || summary.key,
      tier: tierLabel(summary.current_tier ?? creditSummary.current_tier),
      currentTotal: Number(summary.active_pool ?? creditSummary.active_pool ?? 0),
      creditBalance: Number(summary.currently_available_credits ?? creditSummary.credit_balance ?? 0),
      totalTransactionCost: Number(summary.total_transaction_cost ?? totals.gross),
      usedCredits: Number(summary.used_credits ?? totals.used)
    };
  });
  monthlyQualifiedPool = payload.monthlyQualifiedPool || buildMonthlyQualifiedPool(ledgerRows);
}

function renderMetrics() {
  const within7 = rowsForBucket("7");
  const within30 = ledgerRows.filter((row) => row.expiresInDays >= 0 && row.expiresInDays <= 30);
  const totalBalance = customers.reduce((total, customer) => total + customer.creditBalance, 0);
  const totalActivePool = customers.reduce((total, customer) => total + customer.currentTotal, 0);

  const cards = [
    {
      label: "Active Customers",
      value: customers.length,
      detail: `${formatCurrency(totalBalance)} open credit`,
      tone: "teal"
    },
    {
      label: "Expiring In 7 Days",
      value: within7.length,
      detail: `${uniqueCount(within7, "key")} users at risk`,
      tone: "coral"
    },
    {
      label: "Expiring In 30 Days",
      value: formatCurrency(sum(within30, "qualifiedAmount")),
      detail: `${within30.length} credit lots`,
      tone: "amber"
    },
    {
      label: "Open Qualified Pool",
      value: formatCurrency(totalActivePool),
      detail: "Rolling 12-month basis",
      tone: "blue"
    }
  ];

  elements.metricGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card ${card.tone}">
          <div>
            <span>${card.label}</span>
            <strong>${card.value}</strong>
          </div>
          <p>${card.detail}</p>
        </article>
      `
    )
    .join("");
}

function renderQualifiedPoolGrowth() {
  if (!monthlyQualifiedPool.length) {
    elements.poolGrowthSummary.innerHTML = "";
    elements.poolGrowthBars.innerHTML = "";
    return;
  }

  const visibleMonths = monthlyQualifiedPool.slice(-12);
  const first = visibleMonths[0];
  const last = visibleMonths[visibleMonths.length - 1];
  const increase = last.totalQualifiedPool - first.totalQualifiedPool;
  const percentChange =
    first.totalQualifiedPool > 0 ? Math.round((Math.abs(increase) / first.totalQualifiedPool) * 100) : 0;
  const trendClass = increase < 0 ? "negative" : "positive";
  const trendWord = increase < 0 ? "decrease" : "growth";
  const monthlyChanges = visibleMonths.map((month, index) => ({
    ...month,
    change: index === 0 ? 0 : month.totalQualifiedPool - visibleMonths[index - 1].totalQualifiedPool
  }));
  const maxMagnitude = Math.max(...monthlyChanges.map((month) => Math.abs(month.change)), 1);

  elements.poolGrowthSummary.classList.toggle("negative", increase < 0);
  elements.poolGrowthSummary.innerHTML = `
    <div>
      <span>Open qualified pool ${increase < 0 ? "change" : "increase"}</span>
      <strong>${formatCurrency(increase)}</strong>
    </div>
    <p>${percentChange}% ${trendWord} from ${formatMonth(first.month)} to ${formatMonth(last.month)}</p>
  `;

  elements.poolGrowthBars.innerHTML = monthlyChanges
    .map((month) => {
      const directionClass =
        month.change < 0 ? "negative-fill" : month.change > 0 ? "positive-fill" : "flat-fill";
      const height = month.change === 0 ? 2 : Math.max(8, Math.round((Math.abs(month.change) / maxMagnitude) * 46));

      return `
        <div class="bar-item growth-item">
          <div class="growth-track">
            <span class="growth-bar ${directionClass}" style="height: ${height}%"></span>
          </div>
          <div class="bar-meta">
            <span>${formatMonth(month.month)}</span>
            <strong>${month.change >= 0 ? "+" : ""}${formatCurrency(month.change)}</strong>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTierMix() {
  const tierCounts = customers.reduce((counts, customer) => {
    counts[customer.tier] = (counts[customer.tier] || 0) + 1;
    return counts;
  }, {});

  const tiers = Object.keys(tierCounts).sort((left, right) => {
    const leftTier = Number(left.replace(/[^0-9]/g, ""));
    const rightTier = Number(right.replace(/[^0-9]/g, ""));
    return leftTier - rightTier;
  });

  elements.tierBreakdown.innerHTML = tiers
    .map((tier) => {
      const count = tierCounts[tier];
      const percentage = customers.length ? Math.round((count / customers.length) * 100) : 0;
      const tierClass = tier.toLowerCase().replace(/\s+/g, "-");

      return `
        <div class="tier-row ${tierClass}">
          <div class="tier-row-head">
            <span>${tier}</span>
            <strong>${percentage}%</strong>
          </div>
          <div class="tier-meter" aria-label="${tier} users ${percentage}%">
            <span style="width: ${percentage}%"></span>
          </div>
          <p>${count} of ${customers.length} users</p>
        </div>
      `;
    })
    .join("");
}

function renderCustomerSummary() {
  if (!elements.customerSummaryGrid) {
    return;
  }

  const visibleCustomers = customers
    .filter((customer) => !state.summaryQuery || customer.name.toLowerCase().includes(state.summaryQuery))
    .sort((left, right) => right.totalTransactionCost - left.totalTransactionCost);

  if (!visibleCustomers.length) {
    elements.customerSummaryGrid.innerHTML = `
      <article class="summary-card">
        <h3>No matching customers</h3>
      </article>
    `;
    return;
  }

  elements.customerSummaryGrid.innerHTML = visibleCustomers
    .map(
      (customer) => `
        <article class="summary-card">
          <div class="summary-card-head">
            <h3>${escapeHtml(customer.name)}</h3>
            <span>${escapeHtml(customer.tier)}</span>
          </div>
          <dl class="summary-metrics">
            <div>
              <dt>Total transaction cost</dt>
              <dd>${formatCurrency(customer.totalTransactionCost)}</dd>
            </div>
            <div>
              <dt>Currently available credits</dt>
              <dd>${formatCurrency(customer.creditBalance)}</dd>
            </div>
            <div>
              <dt>Current tier</dt>
              <dd>${escapeHtml(customer.tier)}</dd>
            </div>
            <div>
              <dt>Used credits</dt>
              <dd>${formatCurrency(customer.usedCredits)}</dd>
            </div>
          </dl>
        </article>
      `
    )
    .join("");
}

function renderActivity() {
  const recentRows = [...ledgerRows]
    .filter((row) => row.expiresInDays >= 0)
    .sort((left, right) => left.expiresInDays - right.expiresInDays)
    .slice(0, 5);

  elements.activityList.innerHTML = recentRows
    .map(
      (row) => `
        <div class="activity-row">
          <div>
            <strong>${escapeHtml(row.name)}</strong>
            <span>${escapeHtml(row.transactionId)} - ${row.bucketLabel}</span>
          </div>
          <p>${formatCurrency(row.creditBalance)}</p>
        </div>
      `
    )
    .join("");
}

function matchesSearch(row) {
  if (!state.query) {
    return true;
  }

  const haystack = `${row.name} ${row.key || ""} ${row.documentNumber || ""}`.toLowerCase();
  return haystack.includes(state.query);
}

function filteredRows() {
  return ledgerRows
    .filter((row) => matchesSearch(row))
    .filter((row) => state.showExpired || row.expiresInDays >= 0)
    .filter((row) => state.bucket === "all" || row.bucketKey === state.bucket)
    .sort((left, right) => {
      if (left.bucketKey !== right.bucketKey) {
        return bucketIndex(left.bucketKey) - bucketIndex(right.bucketKey);
      }

      if (left.name !== right.name) {
        return left.name.localeCompare(right.name);
      }

      return left.expiresInDays - right.expiresInDays;
    });
}

function bucketIndex(key) {
  return bucketDefinitions.findIndex((bucket) => bucket.key === key);
}

function renderRowCount(rows) {
  elements.rowCount.textContent = `${rows.length} ${rows.length === 1 ? "row" : "rows"}`;
}

function renderLedgerTable() {
  const rows = filteredRows();
  let stripe = 0;
  let html = "";

  renderRowCount(rows);

  if (!rows.length) {
    elements.ledgerBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="11">No matching rebate credit lots.</td>
      </tr>
    `;
    return;
  }

  if (state.bucket !== "all") {
    const activeBucket = bucketDefinitions.find((bucket) => bucket.key === state.bucket);
    html += `
        <tr class="bucket-row">
        <th colspan="11">
          <span>${activeBucket.label}</span>
          <strong>${formatCurrency(sum(rows, "qualifiedAmount"))}</strong>
        </th>
      </tr>
    `;
  }

  rows.forEach((row) => {
    const stripeClass = stripe % 2 === 0 ? "stripe-white" : "stripe-gray";
    stripe += 1;

    html += `
      <tr class="data-row ${stripeClass}">
        <td><code>${escapeHtml(row.transactionId)}</code></td>
        <td><code>${escapeHtml(row.documentNumber || "-")}</code></td>
        <td>${escapeHtml(row.name)}</td>
        <td>${formatDate(row.purchaseDate)}</td>
        <td>${formatDate(row.expirationDate)}</td>
        <td>${formatDaysLeft(row.expiresInDays)}</td>
        <td>${formatCurrency(row.qualifiedAmount)}</td>
        <td>${formatCurrency(row.creditEarned)}</td>
        <td>${formatCurrency(row.creditUsed)}</td>
        <td>${formatCurrency(row.creditBalanceBefore)}</td>
        <td>${formatCurrency(row.creditBalance)}</td>
      </tr>
    `;
  });

  elements.ledgerBody.innerHTML = html;
}

function renderLoadError(error) {
  const message = escapeHtml(error.message);
  elements.metricGrid.innerHTML = `
    <article class="metric-card coral">
      <div>
        <span>Data Error</span>
        <strong>Not loaded</strong>
      </div>
      <p>${message}</p>
    </article>
  `;
  elements.ledgerBody.innerHTML = `
    <tr class="empty-row">
      <td colspan="11">${message}</td>
    </tr>
  `;
}

function setActiveView(view) {
  if (state.view === view) {
    return;
  }

  state.view = view;
  const activeNavItem = elements.navItems.find((item) => item.dataset.view === view);
  elements.viewTitle.textContent =
    activeNavItem?.dataset.title || view.charAt(0).toUpperCase() + view.slice(1);

  elements.navItems.forEach((item) => {
    const isActive = item.dataset.view === view;
    item.classList.toggle("active", isActive);
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  elements.panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== view;
  });

  elements.contentStage.classList.remove("stage-enter");
  window.requestAnimationFrame(() => {
    elements.contentStage.classList.add("stage-enter");
  });
}

function setActiveBucket(bucket) {
  state.bucket = bucket;

  elements.bucketButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.bucket === bucket);
  });

  renderLedgerTable();
}

function bindEvents() {
  elements.navItems.forEach((item) => {
    item.addEventListener("click", () => setActiveView(item.dataset.view));
  });

  elements.customerSearch.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderLedgerTable();
  });

  elements.summarySearch.addEventListener("input", (event) => {
    state.summaryQuery = event.target.value.trim().toLowerCase();
    renderCustomerSummary();
  });

  elements.bucketButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveBucket(button.dataset.bucket));
  });

  elements.showExpired.addEventListener("change", (event) => {
    state.showExpired = event.target.checked;
    renderLedgerTable();
  });
}

async function init() {
  bindEvents();

  try {
    await loadDashboardData();
    elements.todayLabel.textContent = formatDate(asOfDate);
    renderMetrics();
    renderQualifiedPoolGrowth();
    renderTierMix();
    renderCustomerSummary();
    renderActivity();
    renderLedgerTable();
  } catch (error) {
    elements.todayLabel.textContent = formatDate(today);
    renderLoadError(error);
  }
}

init();
