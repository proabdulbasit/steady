const BusinessMetricDaily = require("../models/BusinessMetricDaily");
const BusinessInsightsSnapshot = require("../models/BusinessInsightsSnapshot");
const QboReportSnapshot = require("../models/QboReportSnapshot");
const { deriveInsightsForUser } = require("./insights");

function dateKeyUtc(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function formatUsdFromCents(cents) {
  const n = Number(cents || 0) / 100;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatUsd(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatPct(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}

function weekOverWeekPct(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function trendWord(pct) {
  if (pct == null) return "flat";
  if (pct >= 8) return "up";
  if (pct <= -8) return "down";
  return "flat";
}

function buildRevenuePillar(squareRows) {
  const last7 = squareRows.slice(-7);
  const prev7 = squareRows.slice(-14, -7);
  const last7Net = sum(last7.map((r) => Number(r.metrics?.netRevenueCents || 0)));
  const prev7Net = sum(prev7.map((r) => Number(r.metrics?.netRevenueCents || 0)));
  const last7Orders = sum(last7.map((r) => Number(r.metrics?.orderCount || 0)));
  const prev7Orders = sum(prev7.map((r) => Number(r.metrics?.orderCount || 0)));
  const last7Payments = sum(last7.map((r) => Number(r.metrics?.paymentCount || 0)));
  const last7Refunds = sum(last7.map((r) => Number(r.metrics?.refundCents || 0)));
  const last7Gross = sum(last7.map((r) => Number(r.metrics?.grossRevenueCents || 0)));

  if (!squareRows.length && last7Net === 0 && last7Payments === 0) {
    return {
      status: "no_data",
      headline: "No Square sales data yet",
      summary:
        "Connect Square and run a full sync to see revenue trends, average ticket, and refund impact in plain English.",
      metrics: [],
      highlights: [],
    };
  }

  const revChange = weekOverWeekPct(last7Net, prev7Net);
  const ordChange = weekOverWeekPct(last7Orders, prev7Orders);
  const avgTicket = last7Payments > 0 ? last7Gross / last7Payments : 0;
  const refundRate = last7Gross > 0 ? (last7Refunds / last7Gross) * 100 : 0;
  const trend = trendWord(revChange);

  let headline = `Revenue is ${trend} this week`;
  if (revChange != null) headline = `Revenue is ${formatPct(revChange)} vs last week`;

  const summaryParts = [
    `You brought in ${formatUsdFromCents(last7Net)} in net sales over the last 7 days`,
    revChange != null ? `(${formatPct(revChange)} compared with the week before)` : "",
    last7Orders > 0 ? `from ${last7Orders.toLocaleString()} orders` : "",
    avgTicket > 0 ? `with an average ticket around ${formatUsdFromCents(avgTicket)}` : "",
  ].filter(Boolean);

  const highlights = [];
  if (revChange != null && revChange <= -15) {
    highlights.push({
      tone: "negative",
      text: `Sales slowed — down ${Math.abs(revChange).toFixed(0)}% week over week. Worth checking marketing, hours, or staffing on busy shifts.`,
    });
  } else if (revChange != null && revChange >= 10) {
    highlights.push({
      tone: "positive",
      text: `Sales picked up ${revChange.toFixed(0)}% week over week. Keep doing what's working on your busiest days.`,
    });
  }
  if (refundRate >= 5) {
    highlights.push({
      tone: "negative",
      text: `Refunds are about ${refundRate.toFixed(1)}% of gross sales this week — review voids, comps, or problem orders.`,
    });
  } else if (last7Refunds > 0) {
    highlights.push({
      tone: "neutral",
      text: `Refunds totaled ${formatUsdFromCents(last7Refunds)} this week (${refundRate.toFixed(1)}% of gross).`,
    });
  }
  if (ordChange != null && ordChange <= -20) {
    highlights.push({
      tone: "negative",
      text: `Order count dropped ${Math.abs(ordChange).toFixed(0)}% vs the prior week — fewer customers or shorter hours may be the cause.`,
    });
  }

  return {
    status: last7Net > 0 || last7Payments > 0 ? "ready" : "limited",
    headline,
    summary: summaryParts.join(" ") + ".",
    metrics: [
      { label: "Net revenue (7d)", value: formatUsdFromCents(last7Net), hint: "Square, after refunds" },
      {
        label: "vs prior week",
        value: revChange != null ? formatPct(revChange) : "—",
        hint: prev7Net > 0 ? `Prior: ${formatUsdFromCents(prev7Net)}` : "Not enough prior-week data",
      },
      { label: "Orders (7d)", value: String(last7Orders), hint: ordChange != null ? formatPct(ordChange) + " vs prior week" : "" },
      { label: "Avg ticket", value: formatUsdFromCents(avgTicket), hint: "Gross ÷ payments" },
    ],
    highlights,
  };
}

function buildCostsPillar(qboRow, latestPl) {
  const pl = latestPl?.extracted?.profitAndLoss || latestPl?.profitAndLoss || null;
  const income = pl ? Number(pl.totalIncome) : qboRow ? Number(qboRow.metrics?.totalIncome) : null;
  const expenses = pl ? Number(pl.totalExpenses) : qboRow ? Number(qboRow.metrics?.totalExpenses) : null;
  const net = pl ? Number(pl.netIncome) : qboRow ? Number(qboRow.metrics?.netIncome) : null;

  if (
    (income == null || !Number.isFinite(income)) &&
    (expenses == null || !Number.isFinite(expenses)) &&
    (net == null || !Number.isFinite(net))
  ) {
    return {
      status: "no_data",
      headline: "No QuickBooks cost data yet",
      summary:
        "Connect QuickBooks and run a full sync to see income, expenses, and profit in simple terms for the last 30 days.",
      metrics: [],
      highlights: [],
    };
  }

  const safeIncome = Number.isFinite(income) ? income : 0;
  const safeExpenses = Number.isFinite(expenses) ? expenses : 0;
  const safeNet = Number.isFinite(net) ? net : safeIncome - safeExpenses;
  const expenseRatio = safeIncome > 0 ? (safeExpenses / safeIncome) * 100 : null;
  const marginPct = safeIncome > 0 ? (safeNet / safeIncome) * 100 : null;

  let headline = safeNet >= 0 ? "You're profitable on paper" : "Costs are outpacing income";
  if (safeNet < 0) headline = "Spending more than you're bringing in";

  const summary = [
    `Over the last 30 days QuickBooks shows ${formatUsd(safeIncome)} in income and ${formatUsd(safeExpenses)} in expenses`,
    `leaving ${formatUsd(safeNet)} in net income`,
    expenseRatio != null ? `(${expenseRatio.toFixed(0)} cents of every dollar went to expenses)` : "",
  ]
    .filter(Boolean)
    .join(" ") + ".";

  const highlights = [];
  if (safeNet < 0) {
    highlights.push({
      tone: "negative",
      text: `Net income is negative (${formatUsd(safeNet)}). Review your biggest expense lines in QuickBooks this week.`,
    });
  } else if (marginPct != null && marginPct >= 15) {
    highlights.push({
      tone: "positive",
      text: `Profit margin is about ${marginPct.toFixed(0)}% — healthy room after expenses if that matches how the business feels day to day.`,
    });
  }
  if (expenseRatio != null && expenseRatio >= 90) {
    highlights.push({
      tone: "negative",
      text: `Expenses eat ${expenseRatio.toFixed(0)}% of income — small slips can wipe out profit quickly.`,
    });
  }

  return {
    status: "ready",
    headline,
    summary,
    metrics: [
      { label: "Income (30d)", value: formatUsd(safeIncome), hint: "QuickBooks P&L" },
      { label: "Expenses (30d)", value: formatUsd(safeExpenses), hint: "QuickBooks P&L" },
      { label: "Net income", value: formatUsd(safeNet), hint: marginPct != null ? `${marginPct.toFixed(0)}% margin` : "" },
      {
        label: "Expense ratio",
        value: expenseRatio != null ? `${expenseRatio.toFixed(0)}%` : "—",
        hint: "Expenses ÷ income",
      },
    ],
    highlights,
  };
}

function buildStaffingPillar(squareRows) {
  const last7 = squareRows.slice(-7);
  const prev7 = squareRows.slice(-14, -7);
  const last7Orders = sum(last7.map((r) => Number(r.metrics?.orderCount || 0)));
  const prev7Orders = sum(prev7.map((r) => Number(r.metrics?.orderCount || 0)));
  const last7Net = sum(last7.map((r) => Number(r.metrics?.netRevenueCents || 0)));
  const ordChange = weekOverWeekPct(last7Orders, prev7Orders);
  const ordersPerDay = last7.length ? last7Orders / last7.length : 0;
  const revenuePerOrder = last7Orders > 0 ? last7Net / last7Orders : 0;

  if (!squareRows.length && last7Orders === 0) {
    return {
      status: "no_data",
      headline: "No workload signals yet",
      summary:
        "We don't have payroll or schedule data connected. After Square syncs orders, we estimate staffing pressure from customer volume.",
      metrics: [],
      highlights: [
        {
          tone: "info",
          text: "Connect Square and sync to see orders-per-day and whether volume is rising or falling.",
        },
      ],
    };
  }

  let headline = "Customer volume is steady";
  if (ordChange != null && ordChange >= 12) headline = "You're busier — plan for more coverage";
  if (ordChange != null && ordChange <= -12) headline = "Foot traffic is lighter — watch labor hours";

  const summary = [
    "We don't sync payroll or schedules yet, so this uses order volume as a proxy for how busy you are.",
    last7Orders > 0
      ? `Last 7 days: about ${ordersPerDay.toFixed(0)} orders per day (${last7Orders} total)`
      : "No orders recorded in the last 7 days",
    ordChange != null ? `(${formatPct(ordChange)} vs the week before)` : "",
    revenuePerOrder > 0 ? `with about ${formatUsdFromCents(revenuePerOrder)} revenue per order` : "",
  ]
    .filter(Boolean)
    .join(" ") + ".";

  const highlights = [];
  highlights.push({
    tone: "info",
    text: "For true labor % and schedule insights, connect payroll when available. Until then, use order trends to adjust shifts.",
  });
  if (ordChange != null && ordChange >= 15) {
    highlights.push({
      tone: "negative",
      text: `Volume is up ${ordChange.toFixed(0)}% — consider extra staff on peak days so service doesn't slip.`,
    });
  } else if (ordChange != null && ordChange <= -15) {
    highlights.push({
      tone: "positive",
      text: `Volume is down ${Math.abs(ordChange).toFixed(0)}% — trim labor on slow days to protect margin.`,
    });
  }

  return {
    status: last7Orders > 0 ? "ready" : "limited",
    headline,
    summary,
    metrics: [
      { label: "Orders / day (7d avg)", value: ordersPerDay > 0 ? ordersPerDay.toFixed(1) : "0", hint: "Square orders" },
      {
        label: "vs prior week",
        value: ordChange != null ? formatPct(ordChange) : "—",
        hint: prev7Orders > 0 ? `Prior week: ${prev7Orders} orders` : "",
      },
      {
        label: "Revenue / order",
        value: formatUsdFromCents(revenuePerOrder),
        hint: "Proxy for ticket size + efficiency",
      },
      { label: "Payroll data", value: "Not connected", hint: "Volume-based estimate only" },
    ],
    highlights,
  };
}

async function loadMetrics(userId) {
  const end = new Date();
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const startKey = dateKeyUtc(start);
  const endKey = dateKeyUtc(end);

  const rows = await BusinessMetricDaily.find({
    userId,
    date: { $gte: startKey, $lte: endKey },
    provider: { $in: ["square", "quickbooks"] },
  })
    .sort({ date: 1 })
    .lean();

  const latestQboPl = await QboReportSnapshot.findOne({ userId, reportType: "ProfitAndLoss" })
    .sort({ createdAt: -1 })
    .lean();

  return {
    squareRows: rows.filter((r) => r.provider === "square"),
    qboRow: rows.filter((r) => r.provider === "quickbooks").slice(-1)[0] || null,
    latestQboPl,
  };
}

async function computeBusinessInsights(userId) {
  const { squareRows, qboRow, latestQboPl } = await loadMetrics(userId);
  const dateKey = dateKeyUtc();

  return {
    dateKey,
    computedAt: new Date(),
    revenue: buildRevenuePillar(squareRows),
    costs: buildCostsPillar(qboRow, latestQboPl),
    staffing: buildStaffingPillar(squareRows),
  };
}

function serializeSnapshot(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(o._id),
    dateKey: o.dateKey,
    computedAt: o.computedAt,
    revenue: o.revenue || {},
    costs: o.costs || {},
    staffing: o.staffing || {},
    updatedAt: o.updatedAt,
  };
}

async function refreshBusinessInsightsForUser(userId) {
  const dashboard = await computeBusinessInsights(userId);
  const doc = await BusinessInsightsSnapshot.findOneAndUpdate(
    { userId, dateKey: dashboard.dateKey },
    { $set: dashboard },
    { upsert: true, new: true }
  );
  const alerts = await deriveInsightsForUser(userId);
  return {
    dashboard: serializeSnapshot(doc),
    alertsCreated: Number(alerts?.created || 0),
  };
}

async function getLatestBusinessInsights(userId) {
  const today = dateKeyUtc();
  let doc = await BusinessInsightsSnapshot.findOne({ userId, dateKey: today }).lean();
  if (!doc) {
    doc = await BusinessInsightsSnapshot.findOne({ userId }).sort({ computedAt: -1 }).lean();
  }
  return serializeSnapshot(doc);
}

module.exports = {
  computeBusinessInsights,
  refreshBusinessInsightsForUser,
  getLatestBusinessInsights,
  serializeSnapshot,
};
