const DailyPulse = require("../models/DailyPulse");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LEVELS = new Set(["busy", "normal", "slow"]);

function isValidDateKey(dateKey) {
  return typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}

function dayOfWeekFromDateKey(dateKey) {
  // Parse as local noon UTC-safe: use Date.UTC parts then getUTCDay of that calendar day.
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.getUTCDay();
}

function serializePulse(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(o._id),
    dateKey: o.dateKey,
    dayOfWeek: o.dayOfWeek,
    weekday: WEEKDAYS[o.dayOfWeek] || "",
    level: o.level,
    note: o.note || "",
    patternKey: o.patternKey || "",
    patternMessage: o.patternMessage || "",
    patternDismissedAt: o.patternDismissedAt || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * Detect notable patterns from recent pulses (including the one just logged).
 * Returns { key, message, helpPrompt } or null.
 */
function detectPulsePattern(pulsesNewestFirst) {
  const list = Array.isArray(pulsesNewestFirst) ? pulsesNewestFirst : [];
  if (list.length < 3) return null;

  const latest = list[0];
  const level = latest.level;
  const weekday = WEEKDAYS[latest.dayOfWeek] || "that day";

  // 1) Same weekday, same level, last 3 occurrences of that weekday
  const sameWeekday = list.filter((p) => p.dayOfWeek === latest.dayOfWeek).slice(0, 3);
  if (sameWeekday.length === 3 && sameWeekday.every((p) => p.level === level)) {
    if (level === "slow") {
      return {
        key: `slow_${weekday.toLowerCase()}_x3`,
        message: `Three slow ${weekday}s in a row. Want help filling that day?`,
        helpPrompt: `My Daily Pulse shows three slow ${weekday}s in a row. Help me fill ${weekday}s — concrete ideas for my business, not vague tips.`,
      };
    }
    if (level === "busy") {
      return {
        key: `busy_${weekday.toLowerCase()}_x3`,
        message: `Three busy ${weekday}s in a row. Want a staffing / prep checklist?`,
        helpPrompt: `My Daily Pulse shows three busy ${weekday}s in a row. Give me a simple prep and staffing checklist for busy ${weekday}s.`,
      };
    }
  }

  // 2) Three consecutive logged days (by date order) all slow or all busy
  const byDate = [...list].sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
  const last3 = byDate.slice(-3);
  if (last3.length === 3 && last3.every((p) => p.level === level) && areConsecutiveDateKeys(last3.map((p) => p.dateKey))) {
    if (level === "slow") {
      return {
        key: "slow_streak_3",
        message: "Three slow days in a row. Want ideas to bring people in?",
        helpPrompt:
          "My Daily Pulse shows three slow days in a row. Give me specific, low-cost ways to bring in more customers this week.",
      };
    }
    if (level === "busy") {
      return {
        key: "busy_streak_3",
        message: "Three busy days in a row. Want help so the team doesn't burn out?",
        helpPrompt:
          "My Daily Pulse shows three busy days in a row. Help me keep quality up and stop the team from burning out — short, clear steps.",
      };
    }
  }

  // 3) Last 5 entries: mostly slow (4+)
  const last5 = list.slice(0, 5);
  if (last5.length >= 5) {
    const slowCount = last5.filter((p) => p.level === "slow").length;
    if (slowCount >= 4) {
      return {
        key: "mostly_slow_5",
        message: "Most of your last five days were slow. Want a simple recovery plan?",
        helpPrompt:
          "My Daily Pulse shows most of the last five days were slow. Give me a simple 7-day recovery plan for my business.",
      };
    }
  }

  return null;
}

function areConsecutiveDateKeys(keys) {
  if (!keys || keys.length < 2) return false;
  for (let i = 1; i < keys.length; i += 1) {
    const prev = parseDateKey(keys[i - 1]);
    const next = parseDateKey(keys[i]);
    if (!prev || !next) return false;
    const diffDays = Math.round((next - prev) / (24 * 60 * 60 * 1000));
    if (diffDays !== 1) return false;
  }
  return true;
}

function parseDateKey(dateKey) {
  if (!isValidDateKey(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

async function getTodayPulse(userId, dateKey) {
  if (!userId || !isValidDateKey(dateKey)) return null;
  const doc = await DailyPulse.findOne({ userId, dateKey }).lean();
  return serializePulse(doc);
}

async function listRecentPulses(userId, { limit = 60 } = {}) {
  const items = await DailyPulse.find({ userId }).sort({ dateKey: -1 }).limit(limit).lean();
  return items.map(serializePulse);
}

async function logDailyPulse(userId, { dateKey, level, note = "" }) {
  if (!LEVELS.has(level)) {
    const err = new Error("Level must be busy, normal, or slow.");
    err.status = 400;
    throw err;
  }
  if (!isValidDateKey(dateKey)) {
    const err = new Error("Invalid dateKey. Use YYYY-MM-DD.");
    err.status = 400;
    throw err;
  }

  const noteText = typeof note === "string" ? note.trim().slice(0, 280) : "";

  const dayOfWeek = dayOfWeekFromDateKey(dateKey);

  // Upsert today's pulse (allow changing mind same day).
  let doc = await DailyPulse.findOne({ userId, dateKey });
  if (doc) {
    doc.level = level;
    doc.dayOfWeek = dayOfWeek;
    if (noteText) doc.note = noteText;
  } else {
    doc = new DailyPulse({ userId, dateKey, dayOfWeek, level, note: noteText });
  }

  // Detect pattern using recent history + this level.
  const recent = await DailyPulse.find({ userId }).sort({ dateKey: -1 }).limit(40).lean();
  const merged = [
    { dateKey, dayOfWeek, level },
    ...recent.filter((p) => p.dateKey !== dateKey),
  ];
  const pattern = detectPulsePattern(merged);
  if (pattern) {
    doc.patternKey = pattern.key;
    doc.patternMessage = pattern.message;
    // Re-show offer if they retap and pattern still applies.
    doc.patternDismissedAt = null;
  } else {
    doc.patternKey = "";
    doc.patternMessage = "";
    doc.patternDismissedAt = null;
  }

  await doc.save();

  const history = await listRecentPulses(userId, { limit: 30 });
  return {
    pulse: serializePulse(doc),
    pattern: pattern
      ? {
          key: pattern.key,
          message: pattern.message,
          helpPrompt: pattern.helpPrompt,
        }
      : null,
    history,
  };
}

async function dismissPulsePattern(userId, dateKey) {
  const doc = await DailyPulse.findOne({ userId, dateKey });
  if (!doc) {
    const err = new Error("Today's pulse not found.");
    err.status = 404;
    throw err;
  }
  doc.patternDismissedAt = new Date();
  await doc.save();
  return serializePulse(doc);
}

/** Compact block for Anthropic system prompt. */
async function buildPulseMemoryBlock(userId) {
  const items = await DailyPulse.find({ userId }).sort({ dateKey: -1 }).limit(14).lean();
  if (!items.length) return "";

  const lines = items.map((p) => {
    const day = WEEKDAYS[p.dayOfWeek] || "?";
    const note = typeof p.note === "string" && p.note.trim() ? ` — ${p.note.trim().slice(0, 80)}` : "";
    return `- ${p.dateKey} (${day}): ${p.level}${note}`;
  });

  const openPattern = items.find((p) => p.patternKey && !p.patternDismissedAt);
  const patternLine = openPattern
    ? `\nActive pattern flag: ${openPattern.patternMessage}`
    : "";

  return `DAILY PULSE (owner's own busy/normal/slow taps — use for timing advice; don't lecture):
${lines.join("\n")}${patternLine}`;
}

module.exports = {
  WEEKDAYS,
  isValidDateKey,
  dayOfWeekFromDateKey,
  serializePulse,
  detectPulsePattern,
  getTodayPulse,
  listRecentPulses,
  logDailyPulse,
  dismissPulsePattern,
  buildPulseMemoryBlock,
};
