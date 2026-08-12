const OutcomeCheck = require("../models/OutcomeCheck");

const MAX_EXCERPT = 500;
const MAX_PENDING_PER_USER = 5;

function getFollowUpDueAt(from = new Date()) {
  const minutes = Number(process.env.OUTCOME_FOLLOWUP_MINUTES || 0);
  if (Number.isFinite(minutes) && minutes > 0) {
    return new Date(from.getTime() + minutes * 60 * 1000);
  }
  const days = Number(process.env.OUTCOME_FOLLOWUP_DAYS || 7);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 7;
  return new Date(from.getTime() + safeDays * 24 * 60 * 60 * 1000);
}

function excerpt(text = "", max = MAX_EXCERPT) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function isActionableAdvice(text = "") {
  const t = String(text || "").trim();
  if (t.length < 80) return false;
  if (/^(upgrade to|unable to|please sign in|missing |authentication required)/i.test(t) && t.length < 220) {
    return false;
  }
  return true;
}

function serializeOutcome(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(o._id),
    source: o.source || "chat",
    conversationId: o.conversationId ? String(o.conversationId) : null,
    adviceExcerpt: o.adviceExcerpt || "",
    userPromptExcerpt: o.userPromptExcerpt || "",
    dueAt: o.dueAt,
    status: o.status || "pending",
    respondedAt: o.respondedAt || null,
    note: o.note || "",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * Schedule (or refresh) a 7-day outcome checkup after Steady gives advice.
 */
async function scheduleOutcomeCheck({
  userId,
  source = "chat",
  conversationId = null,
  advice = "",
  userPrompt = "",
}) {
  if (!userId) return null;
  if (!isActionableAdvice(advice)) return null;

  const dueAt = getFollowUpDueAt();
  const adviceExcerpt = excerpt(advice);
  const userPromptExcerpt = excerpt(userPrompt, 280);

  // Prefer one pending checkup per conversation (refresh to latest advice).
  if (conversationId) {
    const existing = await OutcomeCheck.findOne({
      userId,
      conversationId,
      status: "pending",
    });
    if (existing) {
      existing.adviceExcerpt = adviceExcerpt;
      existing.userPromptExcerpt = userPromptExcerpt || existing.userPromptExcerpt;
      existing.source = source;
      existing.dueAt = dueAt;
      await existing.save();
      return serializeOutcome(existing);
    }
  }

  const pendingCount = await OutcomeCheck.countDocuments({ userId, status: "pending" });
  if (pendingCount >= MAX_PENDING_PER_USER) {
    // Drop the oldest pending so new advice still gets a follow-up.
    const oldest = await OutcomeCheck.findOne({ userId, status: "pending" }).sort({ dueAt: 1 });
    if (oldest) {
      oldest.status = "dismissed";
      oldest.respondedAt = new Date();
      await oldest.save();
    }
  }

  const created = await OutcomeCheck.create({
    userId,
    source,
    conversationId: conversationId || null,
    adviceExcerpt,
    userPromptExcerpt,
    dueAt,
    status: "pending",
  });

  return serializeOutcome(created);
}

async function listDueOutcomes(userId, { limit = 5 } = {}) {
  const items = await OutcomeCheck.find({
    userId,
    status: "pending",
    dueAt: { $lte: new Date() },
  })
    .sort({ dueAt: 1 })
    .limit(limit)
    .lean();
  return items.map(serializeOutcome);
}

async function respondToOutcome(userId, outcomeId, { status, note = "" } = {}) {
  const allowed = new Set(["worked", "partially", "didnt_try", "dismissed"]);
  if (!allowed.has(status)) {
    const err = new Error("Status must be worked, partially, didnt_try, or dismissed.");
    err.status = 400;
    throw err;
  }

  const doc = await OutcomeCheck.findOne({ _id: outcomeId, userId });
  if (!doc) {
    const err = new Error("Outcome checkup not found.");
    err.status = 404;
    throw err;
  }
  if (doc.status !== "pending") {
    return serializeOutcome(doc);
  }

  doc.status = status;
  doc.respondedAt = new Date();
  if (typeof note === "string" && note.trim()) {
    doc.note = excerpt(note, 1000);
  }
  await doc.save();
  return serializeOutcome(doc);
}

/** Compact memory for Anthropic system prompt. */
async function buildOutcomeMemoryBlock(userId, { limit = 8 } = {}) {
  const items = await OutcomeCheck.find({
    userId,
    status: { $in: ["worked", "partially", "didnt_try"] },
  })
    .sort({ respondedAt: -1, updatedAt: -1 })
    .limit(limit)
    .lean();

  if (!items.length) return "";

  const lines = items.map((o) => {
    const label =
      o.status === "worked" ? "worked" : o.status === "partially" ? "partially worked" : "didn't try";
    const ask = o.userPromptExcerpt ? `Ask: ${o.userPromptExcerpt} · ` : "";
    const note = o.note ? ` · Owner note: ${o.note}` : "";
    return `- [${label}] ${ask}Advice: ${o.adviceExcerpt}${note}`;
  });

  return `OUTCOME MEMORY (what this owner reported after past Steady advice — use to avoid repeating what failed and build on what worked; do not list this block unless useful):
${lines.join("\n")}`;
}

module.exports = {
  getFollowUpDueAt,
  excerpt,
  isActionableAdvice,
  serializeOutcome,
  scheduleOutcomeCheck,
  listDueOutcomes,
  respondToOutcome,
  buildOutcomeMemoryBlock,
};
