const User = require("../models/User");
const { listPendingDueForEmail, markFollowUpEmailSent } = require("../lib/outcome-checks");
const { sendOutcomeFollowUpEmail } = require("../lib/mail");

function parseHourUtc() {
  const raw = Number(process.env.OUTCOME_FOLLOWUP_EMAIL_HOUR_UTC ?? process.env.BRIEFING_DELIVERY_HOUR_UTC ?? 14);
  if (!Number.isFinite(raw)) return 14;
  return Math.min(Math.max(Math.floor(raw), 0), 23);
}

function getFrontendOrigin() {
  const raw = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "";
  return typeof raw === "string" ? raw.replace(/\/$/, "") : "http://localhost:3000";
}

function dateKeyUtc(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

async function runOutcomeFollowUpEmailCycle() {
  const pending = await listPendingDueForEmail({ limit: 80 });
  let sent = 0;
  for (const rec of pending) {
    const user = await User.findById(rec.userId).select("email name").lean();
    if (!user?.email) continue;
    try {
      await sendOutcomeFollowUpEmail({
        to: user.email,
        ownerName: user.name || "",
        context: rec.userPromptExcerpt || rec.adviceExcerpt || "",
        chatUrl: `${getFrontendOrigin()}/chat`,
      });
      await markFollowUpEmailSent(rec._id);
      sent += 1;
    } catch (e) {
      console.error("[outcome-email] send failed", rec._id, e?.message || e);
    }
  }
  return { sent, checked: pending.length };
}

function startOutcomeFollowUpEmailScheduler() {
  if (process.env.OUTCOME_FOLLOWUP_EMAIL_ENABLED !== "true") {
    console.log("[outcome-email] OUTCOME_FOLLOWUP_EMAIL_ENABLED is not true — scheduled emails disabled.");
    return null;
  }

  const targetHour = parseHourUtc();
  console.log(`[outcome-email] Daily follow-up email check enabled (target ~${targetHour}:00 UTC).`);

  let lastRunDate = "";

  async function tick() {
    const now = new Date();
    const today = dateKeyUtc(now);
    if (now.getUTCHours() !== targetHour) return;
    if (lastRunDate === today) return;
    lastRunDate = today;
    try {
      const summary = await runOutcomeFollowUpEmailCycle();
      console.log("[outcome-email] cycle done", summary);
    } catch (e) {
      console.error("[outcome-email] cycle error", e?.message || e);
    }
  }

  const id = setInterval(() => tick().catch(() => null), 60 * 1000);
  setTimeout(() => tick().catch(() => null), 9000);
  return () => clearInterval(id);
}

module.exports = { startOutcomeFollowUpEmailScheduler, runOutcomeFollowUpEmailCycle };
