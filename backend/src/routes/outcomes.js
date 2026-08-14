const express = require("express");
const mongoose = require("mongoose");
const { requireAuth } = require("../middleware/auth");
const {
  scheduleOutcomeCheck,
  listDueOutcomes,
  respondToOutcome,
  buildOutcomeMemoryBlock,
  serializeOutcome,
  getFollowUpDueAt,
} = require("../lib/outcome-checks");
const OutcomeCheck = require("../models/OutcomeCheck");

const router = express.Router();

function isObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/** Schedule a follow-up after tool advice (chat schedules via conversation save). */
router.post("/", requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const advice = typeof body.advice === "string" ? body.advice : "";
    const userPrompt = typeof body.userPrompt === "string" ? body.userPrompt : "";
    const source = typeof body.source === "string" ? body.source : "chat";
    const conversationId =
      typeof body.conversationId === "string" && isObjectId(body.conversationId)
        ? body.conversationId
        : null;

    const outcome = await scheduleOutcomeCheck({
      userId: req.auth.sub,
      source,
      conversationId,
      advice,
      userPrompt,
    });

    if (!outcome) {
      return res.json({ ok: true, outcome: null, skipped: true });
    }
    return res.json({ ok: true, outcome });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Unable to schedule outcome checkup." });
  }
});

/** Pending checkups that are due now (shown in-app). */
router.get("/due", requireAuth, async (req, res) => {
  const outcomes = await listDueOutcomes(req.auth.sub);
  return res.json({
    ok: true,
    outcomes,
    followUpHint: process.env.OUTCOME_FOLLOWUP_MINUTES
      ? `${process.env.OUTCOME_FOLLOWUP_MINUTES} minute(s) (dev override)`
      : `${process.env.OUTCOME_FOLLOWUP_DAYS || 14} day(s)`,
  });
});

/**
 * Dev/test helper: send due follow-up emails immediately (does not wait for the daily UTC hour).
 * Enabled when OUTCOME_ALLOW_FORCE_DUE=true (or always in non-production).
 */
router.post("/send-due-emails", requireAuth, async (req, res) => {
  const allow =
    process.env.OUTCOME_ALLOW_FORCE_DUE === "true" || process.env.NODE_ENV !== "production";
  if (!allow) {
    return res.status(403).json({ error: "send-due-emails is disabled." });
  }
  if (process.env.OUTCOME_FOLLOWUP_EMAIL_ENABLED !== "true") {
    return res.status(400).json({ error: "Set OUTCOME_FOLLOWUP_EMAIL_ENABLED=true first." });
  }
  try {
    const { runOutcomeFollowUpEmailCycle } = require("../integrations/outcome-followup-scheduler");
    const summary = await runOutcomeFollowUpEmailCycle();
    return res.json({ ok: true, ...summary });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Unable to send follow-up emails." });
  }
});

/** Recent responded outcomes for AI memory injection. */
router.get("/memory", requireAuth, async (req, res) => {
  const block = await buildOutcomeMemoryBlock(req.auth.sub);
  return res.json({ ok: true, memoryBlock: block || "" });
});

/** Worked / Partially / Didn't Try / dismiss. */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ error: "Invalid outcome id." });

    const status = typeof req.body?.status === "string" ? req.body.status : "";
    const note = typeof req.body?.note === "string" ? req.body.note : "";

    const outcome = await respondToOutcome(req.auth.sub, id, { status, note });
    return res.json({ ok: true, outcome });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Unable to save outcome." });
  }
});

/**
 * Dev/test helper: mark a pending checkup due immediately.
 * Enabled when OUTCOME_ALLOW_FORCE_DUE=true (or always in non-production).
 */
router.post("/:id/force-due", requireAuth, async (req, res) => {
  const allow =
    process.env.OUTCOME_ALLOW_FORCE_DUE === "true" || process.env.NODE_ENV !== "production";
  if (!allow) {
    return res.status(403).json({ error: "force-due is disabled." });
  }

  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ error: "Invalid outcome id." });

  const doc = await OutcomeCheck.findOne({ _id: id, userId: req.auth.sub, status: "pending" });
  if (!doc) return res.status(404).json({ error: "Pending outcome not found." });

  doc.dueAt = new Date(Date.now() - 1000);
  await doc.save();
  return res.json({ ok: true, outcome: serializeOutcome(doc) });
});

/** Latest pending (not necessarily due) — useful for local testing UI. */
router.get("/pending", requireAuth, async (req, res) => {
  const items = await OutcomeCheck.find({ userId: req.auth.sub, status: "pending" })
    .sort({ dueAt: 1 })
    .limit(10)
    .lean();
  return res.json({
    ok: true,
    outcomes: items.map(serializeOutcome),
    nextDueAtDefault: getFollowUpDueAt(),
  });
});

module.exports = router;
