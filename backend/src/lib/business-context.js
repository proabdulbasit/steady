const BusinessMetricDaily = require("../models/BusinessMetricDaily");
const QboReportSnapshot = require("../models/QboReportSnapshot");

function clampDays(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.min(Math.max(Math.floor(n), 1), 180);
}

function dateKeyUtc(d) {
  return d.toISOString().slice(0, 10);
}

function snapshotSquareIntegration(user) {
  const e = (user?.integrations || []).find((x) => x.provider === "square");
  if (!e) return null;
  return {
    merchantId: String(e.merchantId || ""),
    locationIds: Array.isArray(e.locationIds) ? e.locationIds : [],
    profile: e.meta?.squareProfile || null,
  };
}

function snapshotQuickBooksIntegration(user) {
  const e = (user?.integrations || []).find((x) => x.provider === "quickbooks");
  if (!e) return null;
  return {
    realmId: String(e.realmId || ""),
    lastExtractedProfitAndLoss: e.meta?.qboFinancialsSummary?.profitAndLoss || null,
  };
}

/** Compact prose + structured blocks for prompting / retrieval. */
function buildCanonicalSummary({ windowDays, squareSummary, latestQboPl, squareProfile, qboRealmId }) {
  const lines = [];
  lines.push(`Reporting window: ${windowDays} days (UTC date keys on daily metrics).`);
  if (squareProfile?.businessName) {
    lines.push(`Square merchant: ${squareProfile.businessName}${squareProfile.country ? ` (${squareProfile.country})` : ""}.`);
  }
  lines.push(
    `Square aggregates: net revenue ${(squareSummary.netRevenueCents / 100).toFixed(2)} (currency USD from integration), payments ${squareSummary.paymentCount}, orders ${squareSummary.orderCount}, refunds cents ${squareSummary.refundCents}.`
  );
  if (latestQboPl?.profitAndLoss) {
    const p = latestQboPl.profitAndLoss;
    lines.push(
      `QuickBooks profit and loss (latest snapshot): income ${p.totalIncome ?? "n/a"}, expenses ${p.totalExpenses ?? "n/a"}, net ${p.netIncome ?? "n/a"}${qboRealmId ? ` (realm ${qboRealmId})` : ""}.`
    );
  }
  return lines.join(" ");
}

/**
 * Normalized context for downstream AI tools: structured metrics + source metadata + canonical summary string.
 * @param {object} user - Mongoose User with integrations hydrated
 */
async function getBusinessContextForUser(user, { days = 30 } = {}) {
  if (!user?._id) {
    throw new Error("Business context requires a persisted user.");
  }
  const userId = user._id;
  const ndays = clampDays(days);
  const start = new Date(Date.now() - ndays * 24 * 60 * 60 * 1000);
  const startKey = dateKeyUtc(start);

  const metrics = await BusinessMetricDaily.find({
    userId,
    date: { $gte: startKey },
    provider: { $in: ["square", "quickbooks"] },
  })
    .sort({ date: 1 })
    .lean();

  const latestQboPl = await QboReportSnapshot.findOne({ userId, reportType: "ProfitAndLoss" })
    .sort({ createdAt: -1 })
    .lean();

  const squareSeries = metrics.filter((m) => m.provider === "square");
  const qboSeries = metrics.filter((m) => m.provider === "quickbooks");

  const squareSummary = squareSeries.reduce(
    (acc, row) => {
      const net = Number(row.metrics?.netRevenueCents || 0);
      acc.netRevenueCents += net;
      acc.paymentCount += Number(row.metrics?.paymentCount || 0);
      acc.refundCents += Number(row.metrics?.refundCents || 0);
      acc.orderCount += Number(row.metrics?.orderCount || 0);
      return acc;
    },
    { netRevenueCents: 0, paymentCount: 0, refundCents: 0, orderCount: 0 }
  );

  const squareSnap = snapshotSquareIntegration(user);
  const qboSnap = snapshotQuickBooksIntegration(user);

  const structured = {
    windowDays: ndays,
    sources: {
      square: squareSnap,
      quickbooks: qboSnap,
    },
    square: {
      summary: squareSummary,
      series: squareSeries.map((r) => ({ date: r.date, ...r.metrics })),
    },
    quickbooks: {
      latestProfitAndLoss: latestQboPl?.extracted || null,
      series: qboSeries.map((r) => ({ date: r.date, ...r.metrics })),
    },
  };

  structured.canonicalSummary = buildCanonicalSummary({
    windowDays: ndays,
    squareSummary,
    latestQboPl: latestQboPl?.extracted,
    squareProfile: squareSnap?.profile,
    qboRealmId: qboSnap?.realmId,
  }).slice(0, 6000);

  return structured;
}

module.exports = { getBusinessContextForUser };
