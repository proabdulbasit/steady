const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  getTodayPulse,
  listRecentPulses,
  logDailyPulse,
  dismissPulsePattern,
  buildPulseMemoryBlock,
  isValidDateKey,
  detectPulsePattern,
} = require("../lib/daily-pulse");

const router = express.Router();

function localTodayFallback() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's pulse + whether UI should prompt. */
router.get("/today", requireAuth, async (req, res) => {
  const dateKey =
    typeof req.query.dateKey === "string" && isValidDateKey(req.query.dateKey)
      ? req.query.dateKey
      : localTodayFallback();

  const pulse = await getTodayPulse(req.auth.sub, dateKey);
  const history = await listRecentPulses(req.auth.sub, { limit: 14 });

  let pattern = null;
  if (pulse?.patternKey && !pulse.patternDismissedAt) {
    // Rebuild helpPrompt from current history.
    const detected = detectPulsePattern(
      history.map((h) => ({
        dateKey: h.dateKey,
        dayOfWeek: h.dayOfWeek,
        level: h.level,
      }))
    );
    if (detected && detected.key === pulse.patternKey) {
      pattern = {
        key: detected.key,
        message: pulse.patternMessage || detected.message,
        helpPrompt: detected.helpPrompt,
      };
    } else if (pulse.patternMessage) {
      pattern = {
        key: pulse.patternKey,
        message: pulse.patternMessage,
        helpPrompt: `My Daily Pulse flagged: ${pulse.patternMessage} Help me with a clear plan.`,
      };
    }
  }

  return res.json({
    ok: true,
    dateKey,
    needsCheckin: !pulse,
    pulse,
    pattern,
    history,
  });
});

/** Log Busy / Normal / Slow for a day. */
router.post("/", requireAuth, async (req, res) => {
  try {
    const level = typeof req.body?.level === "string" ? req.body.level.trim().toLowerCase() : "";
    const dateKey =
      typeof req.body?.dateKey === "string" && isValidDateKey(req.body.dateKey)
        ? req.body.dateKey
        : localTodayFallback();

    const result = await logDailyPulse(req.auth.sub, { dateKey, level });
    return res.json({ ok: true, ...result, needsCheckin: false });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Unable to save pulse." });
  }
});

/** Dismiss the pattern "want help?" offer for today. */
router.post("/dismiss-pattern", requireAuth, async (req, res) => {
  try {
    const dateKey =
      typeof req.body?.dateKey === "string" && isValidDateKey(req.body.dateKey)
        ? req.body.dateKey
        : localTodayFallback();
    const pulse = await dismissPulsePattern(req.auth.sub, dateKey);
    return res.json({ ok: true, pulse });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Unable to dismiss." });
  }
});

/** Recent history for profile / charts. */
router.get("/history", requireAuth, async (req, res) => {
  const limit = Math.min(90, Math.max(7, Number(req.query.limit) || 30));
  const history = await listRecentPulses(req.auth.sub, { limit });
  return res.json({ ok: true, history });
});

/** For Anthropic injection. */
router.get("/memory", requireAuth, async (req, res) => {
  const memoryBlock = await buildPulseMemoryBlock(req.auth.sub);
  return res.json({ ok: true, memoryBlock: memoryBlock || "" });
});

/**
 * Dev helper: seed prior same-weekday pulses so "3 slow Tuesdays" can be tested.
 * Body: { level: "slow", count: 2 } — creates previous weeks' same weekday.
 */
router.post("/seed-pattern", requireAuth, async (req, res) => {
  const allow =
    process.env.OUTCOME_ALLOW_FORCE_DUE === "true" ||
    process.env.PULSE_ALLOW_SEED === "true" ||
    process.env.NODE_ENV !== "production";
  if (!allow) return res.status(403).json({ error: "seed-pattern is disabled." });

  const level = typeof req.body?.level === "string" ? req.body.level.trim().toLowerCase() : "slow";
  const count = Math.min(5, Math.max(1, Number(req.body?.count) || 2));
  const dateKey =
    typeof req.body?.dateKey === "string" && isValidDateKey(req.body.dateKey)
      ? req.body.dateKey
      : localTodayFallback();

  const { dayOfWeekFromDateKey } = require("../lib/daily-pulse");
  const DailyPulse = require("../models/DailyPulse");
  const dow = dayOfWeekFromDateKey(dateKey);
  const created = [];

  for (let w = 1; w <= count; w += 1) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    base.setUTCDate(base.getUTCDate() - 7 * w);
    const key = base.toISOString().slice(0, 10);
    const doc = await DailyPulse.findOneAndUpdate(
      { userId: req.auth.sub, dateKey: key },
      { userId: req.auth.sub, dateKey: key, dayOfWeek: dow, level },
      { upsert: true, new: true }
    );
    created.push({ dateKey: key, level: doc.level });
  }

  return res.json({ ok: true, seeded: created, tip: `Now tap ${level} for today (${dateKey}) to trigger the pattern.` });
});

module.exports = router;
