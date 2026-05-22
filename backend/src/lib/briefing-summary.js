const DailyBriefing = require("../models/DailyBriefing");
const Insight = require("../models/Insight");
const { getBusinessContextForUser } = require("./business-context");
const { quickbooksIntegrationReady, squareIntegrationReady } = require("./integration-sync");

function dateKeyUtc(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function formatUsdFromCents(cents) {
  const n = Number(cents || 0) / 100;
  if (!Number.isFinite(n)) return "n/a";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Compact facts for the model — keeps numbers grounded in synced data. */
function buildFactsBlock(context) {
  const squareSeries = context?.square?.series || [];
  const last7 = squareSeries.slice(-7);
  const prev7 = squareSeries.slice(-14, -7);
  const last7Net = sum(last7.map((r) => Number(r.netRevenueCents || 0)));
  const prev7Net = sum(prev7.map((r) => Number(r.netRevenueCents || 0)));
  let revenueTrend = "not enough history";
  if (prev7Net > 0) {
    const ch = ((last7Net - prev7Net) / prev7Net) * 100;
    revenueTrend = `${ch >= 0 ? "+" : ""}${ch.toFixed(0)}% vs prior 7 days`;
  } else if (last7Net > 0) {
    revenueTrend = "first week of synced revenue data";
  }

  const pl = context?.quickbooks?.latestProfitAndLoss?.profitAndLoss || null;
  const lines = [
    `Window: ${context?.windowDays || 30} days`,
    `Square net revenue (window): ${formatUsdFromCents(context?.square?.summary?.netRevenueCents)}`,
    `Square payments (window): ${context?.square?.summary?.paymentCount ?? 0}`,
    `Square orders (window): ${context?.square?.summary?.orderCount ?? 0}`,
    `Square refunds (window): ${formatUsdFromCents(context?.square?.summary?.refundCents)}`,
    `Last 7 days net revenue: ${formatUsdFromCents(last7Net)} (${revenueTrend})`,
  ];
  if (pl) {
    lines.push(
      `QuickBooks income: ${pl.totalIncome ?? "n/a"}`,
      `QuickBooks expenses: ${pl.totalExpenses ?? "n/a"}`,
      `QuickBooks net income: ${pl.netIncome ?? "n/a"}`
    );
  }
  const biz = context?.sources?.square?.profile?.businessName;
  if (biz) lines.unshift(`Business (Square): ${biz}`);
  return lines.join("\n");
}

function hasMetricData(context) {
  const sq = context?.square?.summary || {};
  const hasSquare =
    Number(sq.netRevenueCents || 0) > 0 ||
    Number(sq.paymentCount || 0) > 0 ||
    (context?.square?.series || []).length > 0;
  const hasQbo =
    context?.quickbooks?.latestProfitAndLoss != null || (context?.quickbooks?.series || []).length > 0;
  return hasSquare || hasQbo;
}

function getIntegrationSyncHint(user) {
  const list = user?.integrations || [];
  const square = list.find((x) => x.provider === "square");
  const qbo = list.find((x) => x.provider === "quickbooks");
  const parts = [];

  if (squareIntegrationReady(square)) {
    const synced = square?.sync?.lastSyncedAt;
    parts.push(
      synced
        ? `Square: last sync ${new Date(synced).toLocaleString()} (${square.sync?.lastSyncStatus || "no status"})`
        : "Square: connected but never synced — click Run full sync now"
    );
  }
  if (quickbooksIntegrationReady(qbo)) {
    const synced = qbo?.sync?.lastSyncedAt;
    parts.push(
      synced
        ? `QuickBooks: last sync ${new Date(synced).toLocaleString()} (${qbo.sync?.lastSyncStatus || "no status"})`
        : "QuickBooks: connected but never synced — click Run full sync now"
    );
  }
  return parts;
}

function buildNotEnoughDataError(user, context) {
  const hints = getIntegrationSyncHint(user);
  const sq = context?.square?.summary || {};
  const hasConn = hints.length > 0;

  if (!hasConn) {
    return "Connect Square or QuickBooks in the Integrations section above, then run a full sync.";
  }

  const syncedButEmpty =
    hints.some((h) => h.includes("last sync")) &&
    Number(sq.paymentCount || 0) === 0 &&
    !context?.quickbooks?.latestProfitAndLoss;

  if (syncedButEmpty) {
    return (
      "Integrations are connected and synced, but no sales or QuickBooks reports were found for the last 30 days. " +
      "Square Sandbox often has zero payments until you create test transactions in the Square Sandbox dashboard. " +
      "Or connect QuickBooks sandbox and run full sync again. " +
      `Details: ${hints.join(" · ")}`
    );
  }

  return `Run a full sync first (Daily briefing → Automated data processing). ${hints.join(" · ")}`;
}

/** Allow briefing if we have metrics, or a completed sync (even when sandbox has $0 sales). */
function canGenerateBriefing(user, context) {
  if (hasMetricData(context)) return true;
  const list = user?.integrations || [];
  return list.some((entry) => {
    const ready =
      (entry.provider === "square" && squareIntegrationReady(entry)) ||
      (entry.provider === "quickbooks" && quickbooksIntegrationReady(entry));
    const synced = entry?.sync?.lastSyncedAt;
    const status = String(entry?.sync?.lastSyncStatus || "");
    return ready && synced && status.toLowerCase().startsWith("ok");
  });
}

function stripJsonFence(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw;
}

function sectionsToPlainText(headline, sections) {
  const parts = [headline, ""];
  for (const s of sections) {
    if (s.title) parts.push(s.title);
    if (s.body) parts.push(s.body);
    parts.push("");
  }
  return parts.join("\n").trim();
}

function serializeBriefing(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    dateKey: doc.dateKey,
    headline: doc.headline || "",
    sections: Array.isArray(doc.sections) ? doc.sections : [],
    plainText: doc.plainText || "",
    model: doc.model || "",
    dataWindowDays: doc.dataWindowDays || 30,
    insightsCount: doc.insightsCount || 0,
    status: doc.status || "ok",
    error: doc.error || "",
    generatedAt: doc.generatedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function callAnthropicJson({ system, userContent }) {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) {
    const err = new Error("Missing ANTHROPIC_API_KEY on the backend.");
    err.status = 500;
    throw err;
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1400,
      temperature: 0.3,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || "Anthropic request failed.");
    err.status = res.status;
    throw err;
  }
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { model, text };
}

async function generateBriefingForUser(user, { dateKey = dateKeyUtc(), force = false } = {}) {
  if (!user?._id) throw new Error("User is required.");

  const existing = await DailyBriefing.findOne({ userId: user._id, dateKey }).lean();
  if (existing && existing.status === "ok" && !force) {
    return { briefing: serializeBriefing(existing), created: false };
  }

  const context = await getBusinessContextForUser(user, { days: 30 });
  const insights = await Insight.find({ userId: user._id }).sort({ createdAt: -1 }).limit(12).lean();

  if (!canGenerateBriefing(user, context)) {
    const err = new Error(buildNotEnoughDataError(user, context));
    err.status = 400;
    throw err;
  }

  const sparseData = !hasMetricData(context);

  const industry = String(user.industry || "general").trim();
  const ownerName = String(user.name || "there").trim() || "there";
  const facts = buildFactsBlock(context);
  const insightLines = insights.length
    ? insights.map((i) => `- [${i.severity}] ${i.title}: ${i.body}`).join("\n")
    : "- No rule-based alerts fired today (metrics may be steady).";

  const system = `You write daily business briefings for small business owners. Use plain, simple English — short sentences, no jargon, no corporate buzzwords. Be specific with the numbers provided. If staffing data is missing, say you don't have schedule/payroll data yet and give practical general advice for their industry. Output ONLY valid JSON, no markdown.`;

  const sparseNote = sparseData
    ? "\nIMPORTANT: Sync completed but metrics are empty (common in Square Sandbox with no test payments). Explain that clearly and give practical next steps. Do not invent dollar amounts.\n"
    : "";

  const userContent = `Write today's daily business briefing for ${ownerName} (${industry} business).
${sparseNote}
FACTS (from synced Square / QuickBooks data — do not invent numbers):
${facts}

AUTOMATED ALERTS:
${insightLines}

Return JSON exactly in this shape:
{
  "headline": "one friendly sentence summarizing today",
  "sections": [
    { "id": "overview", "title": "Today's snapshot", "body": "2-4 short sentences" },
    { "id": "revenue", "title": "Revenue", "body": "2-4 short sentences in plain English" },
    { "id": "costs", "title": "Costs", "body": "2-4 short sentences; use QuickBooks if present" },
    { "id": "staffing", "title": "Staffing", "body": "2-3 short sentences; note if data is missing" },
    { "id": "actions", "title": "What to do this week", "body": "3 bullet points as one string separated by newlines, each starting with - " }
  ]
}`;

  const { model, text } = await callAnthropicJson({ system, userContent });
  let parsed;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch {
    const err = new Error("AI returned an invalid briefing format. Try again.");
    err.status = 502;
    throw err;
  }

  const headline = String(parsed.headline || "").trim();
  const sections = Array.isArray(parsed.sections)
    ? parsed.sections
        .map((s) => ({
          id: String(s.id || s.title || "section").trim(),
          title: String(s.title || "").trim(),
          body: String(s.body || "").trim(),
        }))
        .filter((s) => s.title || s.body)
    : [];

  if (!headline && !sections.length) {
    const err = new Error("AI returned an empty briefing. Try again.");
    err.status = 502;
    throw err;
  }

  const plainText = sectionsToPlainText(headline, sections);
  const doc = await DailyBriefing.findOneAndUpdate(
    { userId: user._id, dateKey },
    {
      $set: {
        headline,
        sections,
        plainText,
        model,
        dataWindowDays: context.windowDays || 30,
        insightsCount: insights.length,
        status: "ok",
        error: "",
        generatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  return { briefing: serializeBriefing(doc), created: true };
}

async function getLatestBriefingForUser(userId, { preferDateKey } = {}) {
  if (preferDateKey) {
    const today = await DailyBriefing.findOne({ userId, dateKey: preferDateKey }).lean();
    if (today) return serializeBriefing(today);
  }
  const latest = await DailyBriefing.findOne({ userId, status: "ok" }).sort({ generatedAt: -1 }).lean();
  return serializeBriefing(latest);
}

module.exports = {
  generateBriefingForUser,
  getLatestBriefingForUser,
  serializeBriefing,
  dateKeyUtc,
};
