const BusinessMetricDaily = require("../models/BusinessMetricDaily");
const Insight = require("../models/Insight");

function dateKeyUtc(d) {
  return d.toISOString().slice(0, 10);
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

async function deriveInsightsForUser(userId) {
  const end = new Date();
  const endKey = dateKeyUtc(end);
  const start14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const startKey = dateKeyUtc(start14);

  const rows = await BusinessMetricDaily.find({
    userId,
    date: { $gte: startKey, $lte: endKey },
    provider: { $in: ["square", "quickbooks"] },
  })
    .sort({ date: 1 })
    .lean();

  const square = rows.filter((r) => r.provider === "square");
  const last7 = square.slice(-7);
  const prev7 = square.slice(-14, -7);
  const last7Net = sum(last7.map((r) => Number(r.metrics?.netRevenueCents || 0)));
  const prev7Net = sum(prev7.map((r) => Number(r.metrics?.netRevenueCents || 0)));
  const last7Refund = sum(last7.map((r) => Number(r.metrics?.refundCents || 0)));
  const prev7Refund = sum(prev7.map((r) => Number(r.metrics?.refundCents || 0)));
  const last7Orders = sum(last7.map((r) => Number(r.metrics?.orderCount || 0)));
  const prev7Orders = sum(prev7.map((r) => Number(r.metrics?.orderCount || 0)));

  const insights = [];
  if (prev7Net > 0) {
    const change = (last7Net - prev7Net) / prev7Net;
    if (change <= -0.2) {
      insights.push({
        provider: "square",
        type: "square_revenue_drop",
        severity: change <= -0.35 ? "critical" : "warn",
        title: "Revenue drop (last 7 days)",
        body: `Net revenue fell ${(Math.abs(change) * 100).toFixed(0)}% vs the prior week.`,
        dateKey: endKey,
      });
    }
  }
  if (prev7Refund > 0) {
    const change = (last7Refund - prev7Refund) / prev7Refund;
    if (change >= 0.4) {
      insights.push({
        provider: "square",
        type: "square_refund_spike",
        severity: change >= 0.8 ? "critical" : "warn",
        title: "Refund spike (last 7 days)",
        body: `Refunds increased ${(change * 100).toFixed(0)}% vs the prior week.`,
        dateKey: endKey,
      });
    }
  }
  if (prev7Orders > 0) {
    const ordChange = (last7Orders - prev7Orders) / prev7Orders;
    if (ordChange <= -0.35) {
      insights.push({
        provider: "square",
        type: "square_order_volume_drop",
        severity: "warn",
        title: "Order volume down (last 7 days)",
        body: `Square order counts in synced metrics dropped ${(Math.abs(ordChange) * 100).toFixed(0)}% vs the prior week.`,
        dateKey: endKey,
      });
    }
  }

  const qbo = rows.filter((r) => r.provider === "quickbooks").slice(-1)[0];
  const netIncome = qbo ? Number(qbo.metrics?.netIncome || 0) : null;
  if (netIncome != null && Number.isFinite(netIncome) && netIncome < 0) {
    insights.push({
      provider: "quickbooks",
      type: "qbo_negative_net_income",
      severity: "warn",
      title: "Net income is negative (last 30 days)",
      body: `QuickBooks reports net income of ${netIncome.toFixed(2)} over the last 30 days.`,
      dateKey: endKey,
    });
  }

  if (!insights.length) return { ok: true, created: 0 };

  const ops = insights.map((i) =>
    Insight.updateOne(
      { userId, type: i.type, dateKey: i.dateKey },
      { $set: { ...i, userId } },
      { upsert: true }
    )
  );
  await Promise.all(ops);
  return { ok: true, created: insights.length };
}

module.exports = { deriveInsightsForUser };

