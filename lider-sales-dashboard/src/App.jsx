import { useMemo, useState } from "react";
import dashboardData from "./data/liderDashboardData.json";

const ALL_CATEGORIES = "all";
const ALL_STATUSES = "all";
const STATUS_ACTIVE = "active";
const STATUS_INACTIVE = "inactive";
const MAX_QUERY_ROWS = 180;
const MAX_RANK_ROWS = 25;
const MAX_DISCONTINUE_ROWS = 600;

const years = [...dashboardData.years].sort((left, right) => left - right);
const allMonths = Array.from({ length: 12 }, (_, index) => index + 1);
const panelYears = [2024, 2025, 2026].filter((year) => years.includes(year));
const discontinuePeriods = [
  { key: "2024", label: "2024", months: allMonths.map((month) => ({ year: 2024, month })) },
  { key: "2025", label: "2025", months: allMonths.map((month) => ({ year: 2025, month })) },
  { key: "2026", label: "2026 Jan-May", months: [1, 2, 3, 4, 5].map((month) => ({ year: 2026, month })) },
];
const discontinueWindow = discontinuePeriods.flatMap((period) => period.months);
const products = dashboardData.products;
const categories = dashboardData.categories;
const models = dashboardData.models;
const defaultYear = dashboardData.defaultYear ?? years.at(-1);
const defaultCompareModels = models.includes("LR15-TR") ? ["LR15-TR"] : models.slice(0, 1);
const defaultCompareYears =
  [2023, 2024].filter((year) => years.includes(year)).length >= 2
    ? [2023, 2024].filter((year) => years.includes(year))
    : years.slice(0, Math.min(2, years.length));

const statusOptions = [
  { value: ALL_STATUSES, label: "All products" },
  { value: STATUS_ACTIVE, label: "Active" },
  { value: STATUS_INACTIVE, label: "Inactive" },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const signedNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  signDisplay: "always",
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  signDisplay: "always",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatDecimal(value) {
  return decimalFormatter.format(Number(value || 0));
}

function formatSignedNumber(value) {
  return signedNumberFormatter.format(Number(value || 0));
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "New";
  }
  return `${percentFormatter.format(value)}%`;
}

function getAnnual(product, year) {
  return product.annual[String(year)] ?? null;
}

function getYearMonths(year) {
  return dashboardData.yearSummaries[String(year)]?.availableMonths ?? [];
}

function getCoverageLabel(year) {
  return dashboardData.yearSummaries[String(year)]?.coverageLabel ?? "No months";
}

function categoryLabel(category) {
  return category === ALL_CATEGORIES ? "All categories" : category;
}

function productStatus(product) {
  return String(product.status || "").trim().toLowerCase() === "active" ? STATUS_ACTIVE : STATUS_INACTIVE;
}

function productStatusLabel(product) {
  return productStatus(product) === STATUS_ACTIVE ? "Active" : "Inactive";
}

function matchesCategory(product, category) {
  return category === ALL_CATEGORIES || product.category === category;
}

function matchesStatus(product, status) {
  return status === ALL_STATUSES || productStatus(product) === status;
}

function monthPairKey(year, month) {
  return `${year}-${month}`;
}

function monthPairLabel({ year, month }) {
  return `${year} ${dashboardData.monthLabels[month - 1]}`;
}

function normalizeBaseSku(sku) {
  return String(sku || "").trim().replace(/(\d{1,2})P$/i, "");
}

function isDiscontinueStatus(statusLabel) {
  return String(statusLabel || "").toLowerCase().includes("discontinue");
}

function sumMonths(values = [], months = []) {
  return months.reduce((total, month) => total + Number(values[month - 1] || 0), 0);
}

function annualTotalUnits(annual, months = allMonths) {
  return annual ? sumMonths(annual.units, months) : 0;
}

function annualTotalRevenue(annual, months = allMonths) {
  return annual ? sumMonths(annual.revenue, months) : 0;
}

function monthRange(startMonth, endMonth) {
  const start = Math.min(Number(startMonth), Number(endMonth));
  const end = Math.max(Number(startMonth), Number(endMonth));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function monthRangeLabel(startMonth, endMonth) {
  const months = monthRange(startMonth, endMonth);
  if (months.length === 1) {
    return dashboardData.monthLabels[months[0] - 1];
  }
  return `${dashboardData.monthLabels[months[0] - 1]}-${dashboardData.monthLabels[months.at(-1) - 1]}`;
}

function bestMonth(annual, months) {
  if (!annual || !months.length) {
    return "-";
  }

  const winner = months.reduce(
    (best, month) => {
      const units = Number(annual.units[month - 1] || 0);
      return units > best.units ? { month, units } : best;
    },
    { month: months[0], units: -1 },
  );

  return `${dashboardData.monthLabels[winner.month - 1]} (${formatNumber(winner.units)})`;
}

function filteredProducts(year, category, status = ALL_STATUSES) {
  return products.filter(
    (product) => getAnnual(product, year) && matchesCategory(product, category) && matchesStatus(product, status),
  );
}

function buildSummary(year, category, status) {
  const months = getYearMonths(year);
  const rows = filteredProducts(year, category, status);
  const monthlySales = months.map((month) => {
    const units = rows.reduce((total, product) => total + Number(getAnnual(product, year)?.units[month - 1] || 0), 0);
    const revenue = rows.reduce(
      (total, product) => total + Number(getAnnual(product, year)?.revenue[month - 1] || 0),
      0,
    );

    return {
      month,
      label: dashboardData.monthLabels[month - 1],
      units,
      revenue,
    };
  });

  return {
    months,
    monthlySales,
    totalUnits: rows.reduce((total, product) => total + annualTotalUnits(getAnnual(product, year), months), 0),
    totalRevenue: rows.reduce((total, product) => total + annualTotalRevenue(getAnnual(product, year), months), 0),
    activeSkus: rows.filter((product) => annualTotalUnits(getAnnual(product, year), months) > 0).length,
  };
}

function buildComparison(year, category, status) {
  const previousYear = year - 1;
  if (!years.includes(previousYear)) {
    return null;
  }

  const months = getYearMonths(year);
  const currentRows = filteredProducts(year, category, status);
  const previousRows = products.filter(
    (product) => getAnnual(product, previousYear) && matchesCategory(product, category) && matchesStatus(product, status),
  );
  const currentUnits = currentRows.reduce(
    (total, product) => total + sumMonths(getAnnual(product, year)?.units, months),
    0,
  );
  const previousUnits = previousRows.reduce(
    (total, product) => total + sumMonths(getAnnual(product, previousYear)?.units, months),
    0,
  );
  const change = currentUnits - previousUnits;

  return {
    previousYear,
    currentUnits,
    previousUnits,
    change,
    percent: previousUnits > 0 ? (change / previousUnits) * 100 : Number.POSITIVE_INFINITY,
  };
}

function getTopSellers(year, category, status) {
  const months = getYearMonths(year);
  return filteredProducts(year, category, status)
    .map((product) => {
      const annual = getAnnual(product, year);
      return {
        product,
        units: annualTotalUnits(annual, months),
        revenue: annualTotalRevenue(annual, months),
        bestMonth: bestMonth(annual, months),
      };
    })
    .filter((row) => row.units > 0)
    .sort((left, right) => right.units - left.units || right.revenue - left.revenue)
    .slice(0, 12);
}

function getImproverGroups(year, category, status) {
  const previousYear = year - 1;
  if (!years.includes(previousYear)) {
    return { previousYear, improvers: [], newProducts: [] };
  }

  const months = getYearMonths(year);
  const rows = products
    .filter((product) => getAnnual(product, year) && matchesCategory(product, category) && matchesStatus(product, status))
    .map((product) => {
      const currentAnnual = getAnnual(product, year);
      const previousAnnual = getAnnual(product, previousYear);
      const currentUnits = sumMonths(currentAnnual.units, months);
      const previousUnits = previousAnnual ? sumMonths(previousAnnual.units, months) : 0;
      const change = currentUnits - previousUnits;

      return {
        product,
        currentUnits,
        previousUnits,
        change,
        percent: previousUnits > 0 ? (change / previousUnits) * 100 : Number.POSITIVE_INFINITY,
        revenue: annualTotalRevenue(currentAnnual, months),
        isNewProduct: currentUnits > 0 && previousUnits <= 0,
      };
    })
    .filter((row) => row.currentUnits > 0);

  return {
    previousYear,
    improvers: rows
      .filter((row) => !row.isNewProduct && row.change > 0)
      .sort((left, right) => right.change - left.change || right.percent - left.percent)
      .slice(0, MAX_RANK_ROWS),
    newProducts: rows
      .filter((row) => row.isNewProduct)
      .sort((left, right) => right.currentUnits - left.currentUnits || right.revenue - left.revenue)
      .slice(0, MAX_RANK_ROWS),
  };
}

function productsForModel(model, year, status) {
  return products.filter(
    (product) => product.model === model && getAnnual(product, year) && matchesStatus(product, status),
  );
}

function buildModelComparison(filters) {
  const months = monthRange(filters.startMonth, filters.endMonth);
  const selectedYears = [...filters.years].sort((left, right) => left - right);

  return filters.models.flatMap((model) =>
    selectedYears.map((year) => {
      const rows = productsForModel(model, year, filters.status);
      const units = rows.reduce((total, product) => total + sumMonths(getAnnual(product, year)?.units, months), 0);
      const revenue = rows.reduce((total, product) => total + sumMonths(getAnnual(product, year)?.revenue, months), 0);
      const activeSkus = rows.filter((product) => sumMonths(getAnnual(product, year)?.units, months) > 0).length;

      return {
        key: `${model}-${year}`,
        model,
        year,
        months,
        units,
        revenue,
        activeSkus,
      };
    }),
  );
}

function buildModelMonthRows(filters) {
  const months = monthRange(filters.startMonth, filters.endMonth);
  const selectedYears = [...filters.years].sort((left, right) => left - right);
  const columns = filters.models.flatMap((model) => selectedYears.map((year) => ({ key: `${model}-${year}`, model, year })));

  return months.map((month) => {
    const values = Object.fromEntries(
      columns.map((column) => {
        const rows = productsForModel(column.model, column.year, filters.status);
        const units = rows.reduce(
          (total, product) => total + Number(getAnnual(product, column.year)?.units[month - 1] || 0),
          0,
        );
        return [column.key, units];
      }),
    );

    return {
      month,
      label: dashboardData.monthLabels[month - 1],
      values,
    };
  });
}

function productMetricValue(product, year, metric) {
  const annual = getAnnual(product, year);
  if (!annual) {
    return 0;
  }
  return metric === "revenue" ? annualTotalRevenue(annual, getYearMonths(year)) : annualTotalUnits(annual, getYearMonths(year));
}

function buildContributionRows(year, status, groupBy, metric) {
  const grouped = products
    .filter((product) => getAnnual(product, year) && matchesStatus(product, status))
    .reduce((totals, product) => {
      const label = groupBy === "category" ? product.category : product.model;
      const value = productMetricValue(product, year, metric);
      totals[label] = (totals[label] || 0) + value;
      return totals;
    }, {});

  const total = Object.values(grouped).reduce((sum, value) => sum + value, 0);
  return Object.entries(grouped)
    .map(([label, value]) => ({
      label,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
    }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);
}

function panelQuantity(product, year) {
  const annual = getAnnual(product, year);
  return annualTotalUnits(annual, getYearMonths(year)) * Number(product.packSize || 1);
}

function buildPanelAnswer(status) {
  const panelProducts = products.filter(
    (product) => ["PC", "PB"].includes(product.panelFinish) && matchesStatus(product, status),
  );
  const summaryRows = ["PC", "PB"].map((finish) => {
    const yearly = Object.fromEntries(
      panelYears.map((year) => [
        year,
        panelProducts
          .filter((product) => product.panelFinish === finish)
          .reduce((total, product) => total + panelQuantity(product, year), 0),
      ]),
    );
    return {
      finish,
      label: `${finish} panel`,
      yearly,
      total: Object.values(yearly).reduce((total, value) => total + value, 0),
    };
  });

  const grouped = panelProducts.reduce((groups, product) => {
    const key = `${product.panelFinish}-${product.model}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        finish: product.panelFinish,
        model: product.model,
        yearly: Object.fromEntries(panelYears.map((year) => [year, 0])),
        total: 0,
      };
    }
    panelYears.forEach((year) => {
      const quantity = panelQuantity(product, year);
      groups[key].yearly[year] += quantity;
      groups[key].total += quantity;
    });
    return groups;
  }, {});

  return {
    summaryRows,
    detailRows: Object.values(grouped).sort(
      (left, right) => left.finish.localeCompare(right.finish) || right.total - left.total,
    ),
    productCount: panelProducts.length,
  };
}

function emptyDiscontinueMonthly() {
  return Object.fromEntries(discontinueWindow.map(({ year, month }) => [monthPairKey(year, month), 0]));
}

function discontinueStats(monthly, months) {
  const values = months.map(({ year, month }) => Number(monthly[monthPairKey(year, month)] || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  const sellingValues = values.filter((value) => value > 0);

  return {
    total,
    sellingMonths: sellingValues.length,
    excludedZeroMonths: values.length - sellingValues.length,
    avg: sellingValues.length ? total / sellingValues.length : 0,
    peak: values.length ? Math.max(...values) : 0,
  };
}

function buildDiscontinueRecords() {
  const groups = products.reduce((collection, product) => {
    const skuBase = normalizeBaseSku(product.sku);
    const color = String(product.color || "Unknown").trim() || "Unknown";
    const key = `${skuBase}||${color}`;
    if (!collection[key]) {
      collection[key] = {
        key,
        skuBase,
        category: product.category || "Uncategorized",
        model: product.model || skuBase,
        color,
        statusLabels: new Set(),
        statusTypes: new Set(),
        skus: new Set(),
        packSizes: new Set(),
        monthly: emptyDiscontinueMonthly(),
      };
    }

    const group = collection[key];
    group.statusLabels.add(String(product.status || "Blank").trim() || "Blank");
    group.statusTypes.add(productStatus(product));
    group.skus.add(product.sku);
    group.packSizes.add(Number(product.packSize || 1));

    discontinueWindow.forEach(({ year, month }) => {
      const annual = getAnnual(product, year);
      const units = Number(annual?.units?.[month - 1] || 0);
      group.monthly[monthPairKey(year, month)] += units * Number(product.packSize || 1);
    });

    return collection;
  }, {});

  const rows = Object.values(groups)
    .filter((group) => ![...group.statusLabels].some(isDiscontinueStatus))
    .map((group) => {
      const stats = Object.fromEntries(
        discontinuePeriods.map((period) => [period.key, discontinueStats(group.monthly, period.months)]),
      );
      const windowStats = discontinueStats(group.monthly, discontinueWindow);
      return {
        ...group,
        stats,
        windowStats,
        skuList: [...group.skus].sort().join(", "),
        statusLabel: [...group.statusLabels].sort().join(", "),
        packSizeLabel: [...group.packSizes].sort((left, right) => left - right).join(", "),
      };
    });

  const byModel = rows.reduce((collection, row) => {
    collection[row.model] = collection[row.model] || [];
    if (row.windowStats.sellingMonths > 0) {
      collection[row.model].push(row);
    }
    return collection;
  }, {});

  return rows.map((row) => {
    const colorPeers = (byModel[row.model] || []).filter((peer) => peer.key !== row.key && peer.color !== row.color);
    const modelPeers = colorPeers.length
      ? colorPeers
      : (byModel[row.model] || []).filter((peer) => peer.key !== row.key);
    const bestPeer = modelPeers.sort((left, right) => right.windowStats.avg - left.windowStats.avg)[0] || null;
    return { ...row, bestPeer };
  });
}

function matchesDiscontinueStatus(row, status) {
  return status === ALL_STATUSES || row.statusTypes.has(status);
}

function buildDiscontinueCandidates(filters) {
  const threshold = Number(filters.threshold || 100);
  const minMonths = Number(filters.minMonths || 18);
  const search = String(filters.search || "").trim().toLowerCase();

  const rows = buildDiscontinueRecords()
    .filter((row) => row.windowStats.sellingMonths >= minMonths)
    .filter((row) => discontinuePeriods.every((period) => row.stats[period.key].avg < threshold))
    .filter((row) => filters.category === ALL_CATEGORIES || row.category === filters.category)
    .filter((row) => matchesDiscontinueStatus(row, filters.status))
    .filter((row) => {
      if (!search) {
        return true;
      }
      return `${row.skuBase} ${row.skuList} ${row.category} ${row.model} ${row.color} ${row.statusLabel}`.toLowerCase().includes(search);
    });

  return sortDiscontinueRows(rows, filters.sort);
}

function sortDiscontinueRows(rows, sort) {
  const sortable = [...rows];
  if (sort === "contrast") {
    return sortable.sort(
      (left, right) =>
        (Number(right.bestPeer?.windowStats.avg || 0) - right.windowStats.avg) -
          (Number(left.bestPeer?.windowStats.avg || 0) - left.windowStats.avg) ||
        left.model.localeCompare(right.model),
    );
  }
  if (sort === "2026") {
    return sortable.sort((left, right) => left.stats["2026"].avg - right.stats["2026"].avg || left.model.localeCompare(right.model));
  }
  if (sort === "model") {
    return sortable.sort(
      (left, right) =>
        left.model.localeCompare(right.model) ||
        left.color.localeCompare(right.color) ||
        left.windowStats.avg - right.windowStats.avg,
    );
  }
  return sortable.sort((left, right) => left.windowStats.avg - right.windowStats.avg || left.model.localeCompare(right.model));
}

function App() {
  const [activeView, setActiveView] = useState("visualization");
  const [overviewYear, setOverviewYear] = useState(defaultYear);
  const [overviewCategory, setOverviewCategory] = useState(ALL_CATEGORIES);
  const [overviewStatus, setOverviewStatus] = useState(ALL_STATUSES);
  const [topFilters, setTopFilters] = useState({
    year: defaultYear,
    category: ALL_CATEGORIES,
    status: ALL_STATUSES,
  });
  const [improverFilters, setImproverFilters] = useState({
    year: defaultYear,
    category: ALL_CATEGORIES,
    status: ALL_STATUSES,
  });
  const [queryYear, setQueryYear] = useState(defaultYear);
  const [queryCategory, setQueryCategory] = useState(ALL_CATEGORIES);
  const [queryStatus, setQueryStatus] = useState(ALL_STATUSES);
  const [query, setQuery] = useState("");
  const [selectedSku, setSelectedSku] = useState("");
  const [compareFilters, setCompareFilters] = useState({
    models: defaultCompareModels,
    years: defaultCompareYears,
    startMonth: 3,
    endMonth: 3,
    status: ALL_STATUSES,
  });
  const [compareModelToAdd, setCompareModelToAdd] = useState(
    models.find((model) => !defaultCompareModels.includes(model)) || models[0] || "",
  );
  const [contributionFilters, setContributionFilters] = useState({
    year: defaultYear,
    status: ALL_STATUSES,
    metric: "revenue",
  });
  const [panelStatus, setPanelStatus] = useState(ALL_STATUSES);
  const [discontinueFilters, setDiscontinueFilters] = useState({
    category: ALL_CATEGORIES,
    status: ALL_STATUSES,
    search: "",
    threshold: 100,
    minMonths: 18,
    sort: "lowest",
  });
  const [selectedDiscontinueKey, setSelectedDiscontinueKey] = useState("");

  const summary = useMemo(
    () => buildSummary(overviewYear, overviewCategory, overviewStatus),
    [overviewYear, overviewCategory, overviewStatus],
  );
  const comparison = useMemo(
    () => buildComparison(overviewYear, overviewCategory, overviewStatus),
    [overviewYear, overviewCategory, overviewStatus],
  );
  const improverGroups = useMemo(
    () => getImproverGroups(improverFilters.year, improverFilters.category, improverFilters.status),
    [improverFilters],
  );
  const compareRows = useMemo(() => buildModelComparison(compareFilters), [compareFilters]);
  const compareMonthRows = useMemo(() => buildModelMonthRows(compareFilters), [compareFilters]);
  const categoryContributionRows = useMemo(
    () =>
      buildContributionRows(
        contributionFilters.year,
        contributionFilters.status,
        "category",
        contributionFilters.metric,
      ),
    [contributionFilters],
  );
  const modelContributionRows = useMemo(
    () =>
      buildContributionRows(
        contributionFilters.year,
        contributionFilters.status,
        "model",
        contributionFilters.metric,
      ),
    [contributionFilters],
  );
  const panelAnswer = useMemo(() => buildPanelAnswer(panelStatus), [panelStatus]);
  const discontinueRows = useMemo(() => buildDiscontinueCandidates(discontinueFilters), [discontinueFilters]);

  const queryRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const months = getYearMonths(queryYear);
    return filteredProducts(queryYear, queryCategory, queryStatus)
      .filter((product) => {
        if (!search) {
          return true;
        }
        return `${product.sku} ${product.asin} ${product.title} ${product.category} ${product.model}`.toLowerCase().includes(search);
      })
      .map((product) => ({ product, annual: getAnnual(product, queryYear) }))
      .sort((left, right) => annualTotalUnits(right.annual, months) - annualTotalUnits(left.annual, months));
  }, [queryYear, queryCategory, queryStatus, query]);

  const effectiveSelectedSku = queryRows.some((row) => row.product.sku === selectedSku)
    ? selectedSku
    : queryRows[0]?.product.sku || "";
  const selectedProduct = queryRows.find((row) => row.product.sku === effectiveSelectedSku)?.product;
  const effectiveSelectedDiscontinueKey = discontinueRows.some((row) => row.key === selectedDiscontinueKey)
    ? selectedDiscontinueKey
    : discontinueRows[0]?.key || "";
  const selectedDiscontinueRow = discontinueRows.find((row) => row.key === effectiveSelectedDiscontinueKey) || null;
  const viewTitle =
    activeView === "query"
      ? "Line Query"
      : activeView === "improvers"
        ? "Improvers"
        : activeView === "compare"
          ? "Compare"
          : activeView === "contribution"
            ? "Contribution"
            : activeView === "panels"
              ? "PC/PB Panels"
              : activeView === "discontinue"
                ? "Discontinue"
                : "Visualization";

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>LIDERSALES</span>
        </div>
        <p className="menu-label">Menu</p>
        <nav className="nav-list">
          <NavButton activeView={activeView} view="visualization" label="Visualization" onChange={setActiveView} icon="chart" />
          <NavButton activeView={activeView} view="improvers" label="Improvers" onChange={setActiveView} icon="improver" />
          <NavButton activeView={activeView} view="compare" label="Compare" onChange={setActiveView} icon="compare" />
          <NavButton activeView={activeView} view="contribution" label="Contribution" onChange={setActiveView} icon="contribution" />
          <NavButton activeView={activeView} view="panels" label="PC/PB Panels" onChange={setActiveView} icon="panel" />
          <NavButton activeView={activeView} view="discontinue" label="Discontinue" onChange={setActiveView} icon="discontinue" />
          <NavButton activeView={activeView} view="query" label="Line Query" onChange={setActiveView} icon="query" />
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="menu-button" type="button" aria-label="Menu">
            <span />
            <span />
            <span />
          </button>
          <div>
            <p className="section-kicker">Lider sales operations</p>
            <h1>{viewTitle}</h1>
          </div>
          <div className="topbar-meta">
            <span className="date-pill">{years[0]}-{years.at(-1)}</span>
            <span className="date-pill">{products.length} SKUs</span>
          </div>
        </header>

        <main className="content-stage">
          {activeView === "visualization" && (
            <VisualizationView
              summary={summary}
              comparison={comparison}
              overviewYear={overviewYear}
              overviewCategory={overviewCategory}
              overviewStatus={overviewStatus}
              onOverviewYear={setOverviewYear}
              onOverviewCategory={setOverviewCategory}
              onOverviewStatus={setOverviewStatus}
              topFilters={topFilters}
              onTopFilters={setTopFilters}
            />
          )}

          {activeView === "improvers" && (
            <ImproversView
              filters={improverFilters}
              groups={improverGroups}
              onFilters={setImproverFilters}
            />
          )}

          {activeView === "compare" && (
            <CompareView
              filters={compareFilters}
              rows={compareRows}
              monthRows={compareMonthRows}
              modelToAdd={compareModelToAdd}
              onModelToAdd={setCompareModelToAdd}
              onFilters={setCompareFilters}
            />
          )}

          {activeView === "contribution" && (
            <ContributionView
              filters={contributionFilters}
              categoryRows={categoryContributionRows}
              modelRows={modelContributionRows}
              onFilters={setContributionFilters}
            />
          )}

          {activeView === "panels" && (
            <PanelAnswerView status={panelStatus} answer={panelAnswer} onStatus={setPanelStatus} />
          )}

          {activeView === "discontinue" && (
            <DiscontinueView
              filters={discontinueFilters}
              rows={discontinueRows}
              selectedRow={selectedDiscontinueRow}
              selectedKey={effectiveSelectedDiscontinueKey}
              onFilters={setDiscontinueFilters}
              onSelect={setSelectedDiscontinueKey}
            />
          )}

          {activeView === "query" && (
            <QueryView
              queryRows={queryRows}
              queryYear={queryYear}
              queryCategory={queryCategory}
              queryStatus={queryStatus}
              query={query}
              selectedProduct={selectedProduct}
              selectedSku={effectiveSelectedSku}
              onQueryYear={setQueryYear}
              onQueryCategory={setQueryCategory}
              onQueryStatus={setQueryStatus}
              onQuery={setQuery}
              onSelectSku={setSelectedSku}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function NavButton({ activeView, view, label, onChange, icon }) {
  const isActive = activeView === view;

  return (
    <button
      className={`nav-item ${isActive ? "active" : ""}`}
      type="button"
      onClick={() => onChange(view)}
      aria-current={isActive ? "page" : undefined}
    >
      <span className={`nav-glyph ${icon}-glyph`} aria-hidden="true">
        {icon === "chart" ? <span /> : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

function VisualizationView({
  summary,
  comparison,
  overviewYear,
  overviewCategory,
  overviewStatus,
  onOverviewYear,
  onOverviewCategory,
  onOverviewStatus,
  topFilters,
  onTopFilters,
}) {
  return (
    <section className="view-panel" aria-label="Visualization dashboard">
      <div className="filter-bar">
        <SelectField label="Year" value={overviewYear} onChange={(value) => onOverviewYear(Number(value))}>
          <YearOptions />
        </SelectField>
        <SelectField label="Category" value={overviewCategory} onChange={onOverviewCategory}>
          <CategoryOptions />
        </SelectField>
        <SelectField label="Status" value={overviewStatus} onChange={onOverviewStatus}>
          <StatusOptions />
        </SelectField>
      </div>

      <div className="metric-grid">
        <MetricCard label="Total Revenue" value={formatCurrency(summary.totalRevenue)} detail={categoryLabel(overviewCategory)} tone="blue" />
        <MetricCard label="Units Sold" value={formatNumber(summary.totalUnits)} detail={`${overviewYear} ${getCoverageLabel(overviewYear)}`} tone="teal" />
        <MetricCard label="Active SKUs" value={formatNumber(summary.activeSkus)} detail={`${formatNumber(summary.months.length)} active months`} tone="amber" />
        <MetricCard
          label="YoY Units"
          value={comparison ? formatSignedNumber(comparison.change) : "-"}
          detail={comparison ? `${formatPercent(comparison.percent)} vs ${comparison.previousYear}` : "No prior year"}
          tone={comparison && comparison.change < 0 ? "coral" : "green"}
        />
      </div>

      <div className="dashboard-grid">
        <section className="analysis-panel wide" aria-labelledby="monthly-sales-title">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Monthly units</p>
              <h2 id="monthly-sales-title">Sales By Month</h2>
            </div>
            <span className="panel-chip">{getCoverageLabel(overviewYear)}</span>
          </div>
          <MonthlyBarChart rows={summary.monthlySales} />
        </section>

        <RankTable title="Top Sells" kicker="Past year rank" mode="top" filters={topFilters} onFilters={onTopFilters} />
      </div>
    </section>
  );
}

function ImproversView({ filters, groups, onFilters }) {
  const improvedUnits = groups.improvers.reduce((total, row) => total + row.change, 0);
  const newProductUnits = groups.newProducts.reduce((total, row) => total + row.currentUnits, 0);

  return (
    <section className="view-panel" aria-label="Improvers dashboard">
      <div className="filter-bar compact-filter-bar">
        <SelectField label="Year" value={filters.year} onChange={(value) => onFilters({ ...filters, year: Number(value) })}>
          <YearOptions />
        </SelectField>
        <SelectField label="Category" value={filters.category} onChange={(value) => onFilters({ ...filters, category: value })}>
          <CategoryOptions />
        </SelectField>
        <SelectField label="Status" value={filters.status} onChange={(value) => onFilters({ ...filters, status: value })}>
          <StatusOptions />
        </SelectField>
        <div className="source-pill">Compared with {groups.previousYear}</div>
      </div>

      <div className="metric-grid">
        <MetricCard label="Improved SKUs" value={formatNumber(groups.improvers.length)} detail="Existing products" tone="teal" />
        <MetricCard label="Improvement Units" value={formatSignedNumber(improvedUnits)} detail={`${filters.year} vs ${groups.previousYear}`} tone="green" />
        <MetricCard label="New Products" value={formatNumber(groups.newProducts.length)} detail="No prior-period units" tone="amber" />
        <MetricCard label="New Product Units" value={formatNumber(newProductUnits)} detail={`${filters.year} ${getCoverageLabel(filters.year)}`} tone="blue" />
      </div>

      <div className="improver-grid">
        <ImproverTable title="Existing Product Improvers" rows={groups.improvers} year={filters.year} previousYear={groups.previousYear} mode="improver" />
        <ImproverTable title="New Product Sales" rows={groups.newProducts} year={filters.year} previousYear={groups.previousYear} mode="new" />
      </div>
    </section>
  );
}

function CompareView({ filters, rows, monthRows, modelToAdd, onModelToAdd, onFilters }) {
  const selectedYears = [...filters.years].sort((left, right) => left - right);
  const columns = filters.models.flatMap((model) => selectedYears.map((year) => ({ key: `${model}-${year}`, model, year })));
  const maxUnits = Math.max(...rows.map((row) => row.units), 1);
  const availableModels = models.filter((model) => !filters.models.includes(model));

  function addModel() {
    if (!modelToAdd || filters.models.includes(modelToAdd)) {
      return;
    }
    onFilters({ ...filters, models: [...filters.models, modelToAdd] });
    onModelToAdd(availableModels.find((model) => model !== modelToAdd) || "");
  }

  function removeModel(model) {
    if (filters.models.length <= 1) {
      return;
    }
    onFilters({ ...filters, models: filters.models.filter((item) => item !== model) });
  }

  function toggleYear(year) {
    const nextYears = filters.years.includes(year)
      ? filters.years.filter((item) => item !== year)
      : [...filters.years, year];
    onFilters({ ...filters, years: nextYears });
  }

  return (
    <section className="view-panel" aria-label="Product performance comparison">
      <div className="compare-layout">
        <section className="analysis-panel compare-controls-panel" aria-label="Comparison controls">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Models</p>
              <h2>Comparison Set</h2>
            </div>
            <span className="panel-chip">{monthRangeLabel(filters.startMonth, filters.endMonth)}</span>
          </div>

          <div className="line-picker">
            <SelectField label="Add model" value={modelToAdd} onChange={onModelToAdd}>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </SelectField>
            <button className="add-line-button" type="button" onClick={addModel} disabled={!availableModels.length}>
              Add
            </button>
          </div>

          <div className="selected-lines">
            {filters.models.map((model) => (
              <span className="line-chip" key={model}>
                {model}
                <button type="button" onClick={() => removeModel(model)} aria-label={`Remove ${model}`}>
                  x
                </button>
              </span>
            ))}
          </div>

          <div className="compare-control-grid">
            <SelectField label="From" value={filters.startMonth} onChange={(value) => onFilters({ ...filters, startMonth: Number(value) })}>
              <MonthOptions />
            </SelectField>
            <SelectField label="To" value={filters.endMonth} onChange={(value) => onFilters({ ...filters, endMonth: Number(value) })}>
              <MonthOptions />
            </SelectField>
            <SelectField label="Status" value={filters.status} onChange={(value) => onFilters({ ...filters, status: value })}>
              <StatusOptions />
            </SelectField>
          </div>

          <div className="year-toggle-grid" aria-label="Comparison years">
            {years.map((year) => (
              <label className="check-tile" key={year}>
                <input
                  type="checkbox"
                  checked={filters.years.includes(year)}
                  onChange={() => toggleYear(year)}
                />
                <span>{year}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="analysis-panel compare-results-panel" aria-labelledby="compare-summary-title">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Combined units</p>
              <h2 id="compare-summary-title">Model Performance</h2>
            </div>
            <span className="panel-chip">{selectedYears.join(", ") || "No years"}</span>
          </div>

          <div className="compare-bars">
            {rows.length ? (
              rows.map((row) => (
                <div className="compare-bar-row" key={row.key}>
                  <div>
                    <strong>{row.model}</strong>
                    <span>{row.year}</span>
                  </div>
                  <div className="compare-meter">
                    <span style={{ width: `${Math.max(3, Math.round((row.units / maxUnits) * 100))}%` }} />
                  </div>
                  <p>{formatNumber(row.units)}</p>
                </div>
              ))
            ) : (
              <p className="empty-panel">Select at least one product line and one year.</p>
            )}
          </div>

          <div className="rank-table-wrap compare-table-wrap">
            <table className="rank-table compare-table">
              <thead>
                <tr>
                  <th>model</th>
                  <th>year</th>
                  <th>months</th>
                  <th>units</th>
                  <th>revenue</th>
                  <th>active_skus</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <strong>{row.model}</strong>
                      </td>
                      <td>{row.year}</td>
                      <td>{monthRangeLabel(filters.startMonth, filters.endMonth)}</td>
                      <td>{formatNumber(row.units)}</td>
                      <td>{formatCurrency(row.revenue)}</td>
                      <td>{formatNumber(row.activeSkus)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="empty-row">
                    <td colSpan="6">No comparison rows.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="analysis-panel month-detail-panel" aria-labelledby="compare-month-title">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Month detail</p>
            <h2 id="compare-month-title">Units By Month</h2>
          </div>
        </div>
        <div className="rank-table-wrap compare-table-wrap">
          <table className="rank-table compare-table">
            <thead>
              <tr>
                <th>month</th>
                {columns.map((column) => (
                  <th key={column.key}>{`${column.model}_${column.year}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthRows.length && columns.length ? (
                monthRows.map((row) => (
                  <tr key={row.month}>
                    <td>
                      <strong>{row.label}</strong>
                    </td>
                    {columns.map((column) => (
                      <td key={column.key}>{formatNumber(row.values[column.key])}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="empty-row">
                  <td colSpan={columns.length + 1}>No month rows.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function ContributionView({ filters, categoryRows, modelRows, onFilters }) {
  const metricLabel = filters.metric === "revenue" ? "Revenue" : "Units";
  const totalValue = categoryRows.reduce((total, row) => total + row.value, 0);
  const topCategory = categoryRows[0];
  const topModel = modelRows[0];

  return (
    <section className="view-panel" aria-label="Sales contribution">
      <div className="filter-bar contribution-filter-bar">
        <SelectField label="Year" value={filters.year} onChange={(value) => onFilters({ ...filters, year: Number(value) })}>
          <YearOptions />
        </SelectField>
        <SelectField label="Status" value={filters.status} onChange={(value) => onFilters({ ...filters, status: value })}>
          <StatusOptions />
        </SelectField>
        <SelectField label="Metric" value={filters.metric} onChange={(value) => onFilters({ ...filters, metric: value })}>
          <option value="revenue">Revenue</option>
          <option value="units">Units</option>
        </SelectField>
      </div>

      <div className="metric-grid">
        <MetricCard
          label={`Total ${metricLabel}`}
          value={filters.metric === "revenue" ? formatCurrency(totalValue) : formatNumber(totalValue)}
          detail={`${filters.year} ${getCoverageLabel(filters.year)}`}
          tone="blue"
        />
        <MetricCard label="Categories" value={formatNumber(categoryRows.length)} detail="Worksheet categories" tone="teal" />
        <MetricCard
          label="Top Category"
          value={topCategory ? `${topCategory.percent.toFixed(1)}%` : "-"}
          detail={topCategory?.label || "No sales"}
          tone="amber"
        />
        <MetricCard
          label="Top Model"
          value={topModel ? `${topModel.percent.toFixed(1)}%` : "-"}
          detail={topModel?.label || "No sales"}
          tone="green"
        />
      </div>

      <div className="contribution-grid">
        <ContributionTable title="Category Contribution" labelHeader="category" rows={categoryRows} metric={filters.metric} />
        <ContributionTable title="Model Contribution" labelHeader="model" rows={modelRows} metric={filters.metric} />
      </div>
    </section>
  );
}

function ContributionTable({ title, labelHeader, rows, metric }) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="analysis-panel contribution-panel" aria-labelledby={`${labelHeader}-contribution-title`}>
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Sales mix</p>
          <h2 id={`${labelHeader}-contribution-title`}>{title}</h2>
        </div>
      </div>

      <div className="rank-table-wrap contribution-table-wrap">
        <table className="rank-table contribution-table">
          <thead>
            <tr>
              <th>{labelHeader}</th>
              <th>{metric}</th>
              <th>contribution</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.label}>
                  <td>
                    <strong>{row.label}</strong>
                  </td>
                  <td>{metric === "revenue" ? formatCurrency(row.value) : formatNumber(row.value)}</td>
                  <td className="share-cell">
                    <div className="share-meter">
                      <span style={{ width: `${Math.max(2, Math.round((row.value / maxValue) * 100))}%` }} />
                    </div>
                    <strong>{row.percent.toFixed(1)}%</strong>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="empty-row">
                <td colSpan="3">No contribution rows.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PanelAnswerView({ status, answer, onStatus }) {
  const pcRow = answer.summaryRows.find((row) => row.finish === "PC");
  const pbRow = answer.summaryRows.find((row) => row.finish === "PB");

  return (
    <section className="view-panel" aria-label="PC and PB panel quantities">
      <div className="filter-bar panel-filter-bar">
        <SelectField label="Status" value={status} onChange={onStatus}>
          <StatusOptions />
        </SelectField>
      </div>

      <div className="metric-grid">
        <MetricCard label="PC Panel Qty" value={formatNumber(pcRow?.total || 0)} detail="2024, 2025, 2026 YTD" tone="blue" />
        <MetricCard label="PB Panel Qty" value={formatNumber(pbRow?.total || 0)} detail="2024, 2025, 2026 YTD" tone="teal" />
        <MetricCard label="Panel SKUs" value={formatNumber(answer.productCount)} detail="PC/PB Metal Wall Plate" tone="amber" />
        <MetricCard label="2026 Coverage" value={getCoverageLabel(2026)} detail="YTD source months" tone="green" />
      </div>

      <div className="panel-answer-grid">
        <section className="analysis-panel" aria-labelledby="panel-summary-title">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">PC / PB panels</p>
              <h2 id="panel-summary-title">Quantity By Year</h2>
            </div>
          </div>

          <div className="rank-table-wrap">
            <table className="rank-table panel-answer-table">
              <thead>
                <tr>
                  <th>panel</th>
                  {panelYears.map((year) => (
                    <th key={year}>{year === 2026 ? "2026_ytd" : year}</th>
                  ))}
                  <th>total</th>
                </tr>
              </thead>
              <tbody>
                {answer.summaryRows.map((row) => (
                  <tr key={row.finish}>
                    <td>
                      <strong>{row.label}</strong>
                    </td>
                    {panelYears.map((year) => (
                      <td key={year}>{formatNumber(row.yearly[year] || 0)}</td>
                    ))}
                    <td>{formatNumber(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="analysis-panel panel-detail-panel" aria-labelledby="panel-detail-title">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Model detail</p>
              <h2 id="panel-detail-title">Quantity By Model</h2>
            </div>
          </div>

          <div className="rank-table-wrap panel-detail-wrap">
            <table className="rank-table panel-answer-table">
              <thead>
                <tr>
                  <th>panel</th>
                  <th>model</th>
                  {panelYears.map((year) => (
                    <th key={year}>{year === 2026 ? "2026_ytd" : year}</th>
                  ))}
                  <th>total</th>
                </tr>
              </thead>
              <tbody>
                {answer.detailRows.length ? (
                  answer.detailRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.finish}</td>
                      <td>
                        <strong>{row.model}</strong>
                      </td>
                      {panelYears.map((year) => (
                        <td key={year}>{formatNumber(row.yearly[year] || 0)}</td>
                      ))}
                      <td>{formatNumber(row.total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="empty-row">
                    <td colSpan={panelYears.length + 3}>No matching panel rows.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

function DiscontinueView({ filters, rows, selectedRow, selectedKey, onFilters, onSelect }) {
  const visibleRows = rows.slice(0, MAX_DISCONTINUE_ROWS);
  const avgMonthly = rows.length
    ? rows.reduce((total, row) => total + row.windowStats.avg, 0) / rows.length
    : 0;
  const excludedZeroMonths = rows.reduce((total, row) => total + row.windowStats.excludedZeroMonths, 0);
  const topCategory = Object.entries(
    rows.reduce((counts, row) => {
      counts[row.category] = (counts[row.category] || 0) + 1;
      return counts;
    }, {}),
  ).sort((left, right) => right[1] - left[1])[0];

  return (
    <section className="view-panel" aria-label="Discontinue candidates">
      <div className="filter-bar discontinue-filter-bar">
        <label className="search-box">
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) => onFilters({ ...filters, search: event.target.value })}
            type="search"
            autoComplete="off"
            placeholder="SKU, model, color"
          />
        </label>
        <SelectField label="Category" value={filters.category} onChange={(value) => onFilters({ ...filters, category: value })}>
          <CategoryOptions />
        </SelectField>
        <SelectField label="Status" value={filters.status} onChange={(value) => onFilters({ ...filters, status: value })}>
          <StatusOptions />
        </SelectField>
        <SelectField label="Sort" value={filters.sort} onChange={(value) => onFilters({ ...filters, sort: value })}>
          <option value="lowest">Lowest monthly</option>
          <option value="contrast">Best color gap</option>
          <option value="2026">2026 lowest</option>
          <option value="model">Model</option>
        </SelectField>
        <label className="search-box">
          <span>Max monthly</span>
          <input
            value={filters.threshold}
            onChange={(event) => onFilters({ ...filters, threshold: event.target.value })}
            type="number"
            min="1"
            step="1"
          />
        </label>
        <label className="search-box">
          <span>Min months</span>
          <input
            value={filters.minMonths}
            onChange={(event) => onFilters({ ...filters, minMonths: event.target.value })}
            type="number"
            min="1"
            max="29"
            step="1"
          />
        </label>
      </div>

      <div className="metric-grid">
        <MetricCard label="Candidate Groups" value={formatNumber(rows.length)} detail="Color-level SKU groups" tone="coral" />
        <MetricCard label="Avg Monthly" value={formatDecimal(avgMonthly)} detail="Single-unit basis" tone="blue" />
        <MetricCard label="Zero Months Excluded" value={formatNumber(excludedZeroMonths)} detail="Stockout windows" tone="amber" />
        <MetricCard label="Top Category" value={topCategory?.[0] || "-"} detail={topCategory ? `${formatNumber(topCategory[1])} groups` : "No rows"} tone="teal" />
      </div>

      <div className="discontinue-layout">
        <section className="analysis-panel discontinue-table-panel" aria-labelledby="discontinue-table-title">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Low monthly sellers</p>
              <h2 id="discontinue-table-title">Candidate List</h2>
            </div>
            <span className="panel-chip">{formatNumber(visibleRows.length)} rows</span>
          </div>

          <div className="rank-table-wrap discontinue-table-wrap">
            <table className="rank-table discontinue-table">
              <thead>
                <tr>
                  <th>sku_group</th>
                  <th>category</th>
                  <th>model</th>
                  <th>color</th>
                  <th>2024</th>
                  <th>2025</th>
                  <th>2026_jan_may</th>
                  <th>all_avg</th>
                  <th>sell_months</th>
                  <th>zero_months</th>
                  <th>best_color</th>
                  <th>best_avg</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length ? (
                  visibleRows.map((row) => (
                    <tr key={row.key} className={row.key === selectedKey ? "selected-row" : ""}>
                      <td>
                        <button className="sku-button" type="button" onClick={() => onSelect(row.key)}>
                          {row.skuBase}
                        </button>
                        <span>{row.skuList}</span>
                      </td>
                      <td>{row.category}</td>
                      <td>
                        <strong>{row.model}</strong>
                        <span>{row.statusLabel}</span>
                      </td>
                      <td>{row.color}</td>
                      <td>{formatDecimal(row.stats["2024"].avg)}</td>
                      <td>{formatDecimal(row.stats["2025"].avg)}</td>
                      <td>{formatDecimal(row.stats["2026"].avg)}</td>
                      <td>
                        <strong className="low-score">{formatDecimal(row.windowStats.avg)}</strong>
                      </td>
                      <td>{formatNumber(row.windowStats.sellingMonths)}</td>
                      <td>{formatNumber(row.windowStats.excludedZeroMonths)}</td>
                      <td>{row.bestPeer?.color || "-"}</td>
                      <td>{row.bestPeer ? formatDecimal(row.bestPeer.windowStats.avg) : "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="empty-row">
                    <td colSpan="12">No matching discontinue candidates.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <DiscontinueDetail row={selectedRow} />
      </div>
    </section>
  );
}

function DiscontinueDetail({ row }) {
  if (!row) {
    return (
      <aside className="analysis-panel detail-panel">
        <p className="panel-kicker">Candidate detail</p>
        <h2>No candidate selected</h2>
      </aside>
    );
  }

  const bestPeer = row.bestPeer;

  return (
    <aside className="analysis-panel detail-panel discontinue-detail" aria-label="Selected discontinue candidate">
      <div className="detail-head">
        <div>
          <p className="panel-kicker">Candidate detail</p>
          <h2>{row.skuBase}</h2>
        </div>
        <span className="panel-chip">{row.color}</span>
      </div>
      <p className="product-title">{row.category} / {row.model}</p>

      <div className="detail-metrics">
        <div>
          <span>2024 Avg</span>
          <strong>{formatDecimal(row.stats["2024"].avg)}</strong>
        </div>
        <div>
          <span>2025 Avg</span>
          <strong>{formatDecimal(row.stats["2025"].avg)}</strong>
        </div>
        <div>
          <span>2026 Avg</span>
          <strong>{formatDecimal(row.stats["2026"].avg)}</strong>
        </div>
        <div>
          <span>Months</span>
          <strong>{formatNumber(row.windowStats.sellingMonths)}</strong>
        </div>
      </div>

      <div className="comparison-strip">
        <div>
          <span>Candidate</span>
          <strong>{row.color}</strong>
          <em>{formatDecimal(row.windowStats.avg)} / month</em>
        </div>
        <div>
          <span>Best Same Model</span>
          <strong>{bestPeer?.color || "-"}</strong>
          <em>{bestPeer ? `${formatDecimal(bestPeer.windowStats.avg)} / month` : "-"}</em>
        </div>
      </div>

      <div className="detail-list">
        <div>
          <span>SKUs</span>
          <strong>{row.skuList}</strong>
        </div>
        <div>
          <span>Pack sizes</span>
          <strong>{row.packSizeLabel}</strong>
        </div>
        <div>
          <span>Best SKU group</span>
          <strong>{bestPeer?.skuBase || "-"}</strong>
        </div>
      </div>

      <div className="discontinue-month-grid" aria-label="Monthly single-unit sales">
        {discontinueWindow.map((monthPair) => {
          const value = Number(row.monthly[monthPairKey(monthPair.year, monthPair.month)] || 0);
          return (
            <div className={value > 0 ? "month-tile" : "month-tile empty-month"} key={monthPairKey(monthPair.year, monthPair.month)}>
              <span>{monthPairLabel(monthPair)}</span>
              <strong>{formatNumber(value)}</strong>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function QueryView({
  queryRows,
  queryYear,
  queryCategory,
  queryStatus,
  query,
  selectedProduct,
  selectedSku,
  onQueryYear,
  onQueryCategory,
  onQueryStatus,
  onQuery,
  onSelectSku,
}) {
  const visibleRows = queryRows.slice(0, MAX_QUERY_ROWS);
  const annual = selectedProduct ? getAnnual(selectedProduct, queryYear) : null;
  const months = getYearMonths(queryYear);

  return (
    <section className="view-panel" aria-label="Line query">
      <div className="table-header">
        <div>
          <p className="panel-kicker">SKU lookup</p>
          <h2>Specific Line Query</h2>
        </div>
        <span className="row-count">{formatNumber(queryRows.length)} rows</span>
      </div>

      <div className="query-layout">
        <section className="analysis-panel query-panel" aria-label="Query filters and results">
          <div className="table-tools">
            <label className="search-box">
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                type="search"
                autoComplete="off"
                placeholder="SKU, ASIN, title"
              />
            </label>
            <SelectField label="Year" value={queryYear} onChange={(value) => onQueryYear(Number(value))}>
              <YearOptions />
            </SelectField>
            <SelectField label="Category" value={queryCategory} onChange={onQueryCategory}>
              <CategoryOptions />
            </SelectField>
            <SelectField label="Status" value={queryStatus} onChange={onQueryStatus}>
              <StatusOptions />
            </SelectField>
          </div>

          <div className="sql-frame">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>sku</th>
                    <th>asin</th>
                    <th>category</th>
                    <th>model</th>
                    <th>status</th>
                    <th>units</th>
                    <th>revenue</th>
                    <th>best_month</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length ? (
                    visibleRows.map(({ product, annual: rowAnnual }) => (
                      <tr key={product.sku} className={product.sku === selectedSku ? "selected-row" : ""}>
                        <td>
                          <button className="sku-button" type="button" onClick={() => onSelectSku(product.sku)}>
                            {product.sku}
                          </button>
                        </td>
                        <td>{product.asin || "-"}</td>
                        <td>{product.category}</td>
                        <td>{product.model}</td>
                        <td>{productStatusLabel(product)}</td>
                        <td>{formatNumber(annualTotalUnits(rowAnnual, months))}</td>
                        <td>{formatCurrency(annualTotalRevenue(rowAnnual, months))}</td>
                        <td>{bestMonth(rowAnnual, months)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="empty-row">
                      <td colSpan="8">No matching SKU lines.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <ProductDetail product={selectedProduct} annual={annual} months={months} year={queryYear} />
      </div>
    </section>
  );
}

function ProductDetail({ product, annual, months, year }) {
  if (!product || !annual) {
    return (
      <aside className="analysis-panel detail-panel">
        <p className="panel-kicker">Line detail</p>
        <h2>No SKU selected</h2>
      </aside>
    );
  }

  return (
    <aside className="analysis-panel detail-panel" aria-label="Selected SKU detail">
      <div className="detail-head">
        <div>
          <p className="panel-kicker">Line detail</p>
          <h2>{product.sku}</h2>
        </div>
        <span className="panel-chip">{year}</span>
      </div>
      <p className="product-title">{product.title || product.category || product.model}</p>
      <div className="detail-metrics">
        <div>
          <span>Units</span>
          <strong>{formatNumber(annualTotalUnits(annual, months))}</strong>
        </div>
        <div>
          <span>Revenue</span>
          <strong>{formatCurrency(annualTotalRevenue(annual, months))}</strong>
        </div>
        <div>
          <span>ASIN</span>
          <strong>{product.asin || "-"}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{productStatusLabel(product)}</strong>
        </div>
      </div>
      <ProductMonthBars annual={annual} months={months} />
    </aside>
  );
}

function ProductMonthBars({ annual, months }) {
  const maxUnits = Math.max(...months.map((month) => Number(annual.units[month - 1] || 0)), 1);
  return (
    <div className="mini-months" aria-label="Selected SKU monthly units">
      {months.map((month) => {
        const units = Number(annual.units[month - 1] || 0);
        const height = Math.max(4, Math.round((units / maxUnits) * 100));
        return (
          <div className="mini-month" key={month}>
            <div className="mini-track">
              <span style={{ height: `${height}%` }} />
            </div>
            <strong>{dashboardData.monthLabels[month - 1]}</strong>
            <span>{formatNumber(units)}</span>
          </div>
        );
      })}
    </div>
  );
}

function RankTable({ title, kicker, mode, filters, onFilters }) {
  const rows = getTopSellers(filters.year, filters.category, filters.status);

  return (
    <section className="analysis-panel rank-panel" aria-labelledby={`${mode}-title`}>
      <div className="panel-head">
        <div>
          <p className="panel-kicker">{kicker}</p>
          <h2 id={`${mode}-title`}>{title}</h2>
        </div>
      </div>
      <div className="rank-controls">
        <SelectField
          label="Year"
          value={filters.year}
          onChange={(value) => onFilters({ ...filters, year: Number(value) })}
        >
          <YearOptions />
        </SelectField>
        <SelectField label="Category" value={filters.category} onChange={(value) => onFilters({ ...filters, category: value })}>
          <CategoryOptions />
        </SelectField>
        <SelectField label="Status" value={filters.status} onChange={(value) => onFilters({ ...filters, status: value })}>
          <StatusOptions />
        </SelectField>
      </div>

      <div className="rank-table-wrap">
        <table className="rank-table">
          <thead>
            <tr>
              <th>sku</th>
              <th>units</th>
              <th>revenue</th>
              <th>best_month</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.product.sku}>
                  <td>
                    <strong>{row.product.sku}</strong>
                    <span>{row.product.category} / {row.product.model}</span>
                  </td>
                  <td>{formatNumber(row.units)}</td>
                  <td>{formatCurrency(row.revenue)}</td>
                  <td>{row.bestMonth}</td>
                </tr>
              ))
            ) : (
              <tr className="empty-row">
                <td colSpan="4">No matching rows.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImproverTable({ title, rows, year, previousYear, mode }) {
  return (
    <section className="analysis-panel rank-panel" aria-labelledby={`${mode}-table-title`}>
      <div className="panel-head">
        <div>
          <p className="panel-kicker">{mode === "new" ? "New product rank" : "Sales improvement"}</p>
          <h2 id={`${mode}-table-title`}>{title}</h2>
        </div>
        <span className="panel-chip">{year}</span>
      </div>

      <div className="rank-table-wrap improver-table-wrap">
        <table className="rank-table">
          <thead>
            <tr>
              <th>sku</th>
              <th>{year}</th>
              <th>{previousYear}</th>
              <th>{mode === "new" ? "sales" : "change"}</th>
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.product.sku}>
                  <td>
                    <strong>{row.product.sku}</strong>
                    <span>{row.product.category} / {row.product.model}</span>
                  </td>
                  <td>{formatNumber(row.currentUnits)}</td>
                  <td>{formatNumber(row.previousUnits)}</td>
                  <td>
                    <strong className="positive-text">
                      {mode === "new" ? formatNumber(row.currentUnits) : formatSignedNumber(row.change)}
                    </strong>
                    <span>{mode === "new" ? formatCurrency(row.revenue) : formatPercent(row.percent)}</span>
                  </td>
                  <td>{productStatusLabel(row.product)}</td>
                </tr>
              ))
            ) : (
              <tr className="empty-row">
                <td colSpan="5">No matching rows.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MonthlyBarChart({ rows }) {
  const maxUnits = Math.max(...rows.map((row) => row.units), 1);
  return (
    <div className="bar-chart" aria-label="Monthly sales bar chart">
      {rows.map((row) => {
        const height = Math.max(4, Math.round((row.units / maxUnits) * 100));
        return (
          <div className="bar-item" key={row.month}>
            <div className="bar-track">
              <span className="bar-fill" style={{ height: `${height}%` }} />
            </div>
            <div className="bar-meta">
              <span>{row.label}</span>
              <strong>{formatNumber(row.units)}</strong>
              <em>{formatCurrency(row.revenue)}</em>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, detail, tone }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <p>{detail}</p>
    </article>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function YearOptions() {
  return years.map((year) => (
    <option key={year} value={year}>
      {year} ({getCoverageLabel(year)})
    </option>
  ));
}

function CategoryOptions() {
  return (
    <>
      <option value={ALL_CATEGORIES}>All categories</option>
      {categories.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </>
  );
}

function StatusOptions() {
  return statusOptions.map((status) => (
    <option key={status.value} value={status.value}>
      {status.label}
    </option>
  ));
}

function MonthOptions() {
  return dashboardData.monthLabels.map((label, index) => (
    <option key={label} value={index + 1}>
      {label}
    </option>
  ));
}

export default App;
