const User = require("../models/User");
const { deliverDailyBriefingForUser } = require("../lib/briefing-delivery");
const { quickbooksIntegrationReady, squareIntegrationReady } = require("../lib/integration-sync");
const { dateKeyUtc } = require("../lib/briefing-summary");

function parseDeliveryHourUtc() {
  const raw = Number(process.env.BRIEFING_DELIVERY_HOUR_UTC ?? 14);
  if (!Number.isFinite(raw)) return 14;
  return Math.min(Math.max(Math.floor(raw), 0), 23);
}

function userEligibleForDelivery(user) {
  const list = user.integrations || [];
  return list.some(
    (x) =>
      (x.provider === "square" && squareIntegrationReady(x)) ||
      (x.provider === "quickbooks" && quickbooksIntegrationReady(x))
  );
}

async function runDeliveryCycle() {
  const today = dateKeyUtc();
  const users = await User.find({
    $or: [{ "briefingDelivery.emailEnabled": { $ne: false } }, { "briefingDelivery.pushEnabled": { $ne: false } }],
  }).limit(100);

  let delivered = 0;
  for (const user of users) {
    if (!userEligibleForDelivery(user)) continue;
    if (user.briefingDelivery?.lastDeliveryDateKey === today) continue;
    try {
      await deliverDailyBriefingForUser(user, { force: false, generateIfMissing: true });
      delivered += 1;
    } catch (e) {
      console.error("[briefing-delivery] user failed", user._id, e?.message || e);
    }
  }
  return { delivered, checked: users.length };
}

function startBriefingDeliveryScheduler() {
  if (process.env.BRIEFING_DELIVERY_ENABLED !== "true") {
    console.log("[briefing-delivery] BRIEFING_DELIVERY_ENABLED is not true — scheduled delivery disabled.");
    return null;
  }

  const targetHour = parseDeliveryHourUtc();
  console.log(`[briefing-delivery] Daily delivery check enabled (target ~${targetHour}:00 UTC).`);

  let lastRunDate = "";

  async function tick() {
    const now = new Date();
    const today = dateKeyUtc(now);
    if (now.getUTCHours() !== targetHour) return;
    if (lastRunDate === today) return;
    lastRunDate = today;
    try {
      const summary = await runDeliveryCycle();
      console.log("[briefing-delivery] cycle done", summary);
    } catch (e) {
      console.error("[briefing-delivery] cycle error", e?.message || e);
    }
  }

  const id = setInterval(() => tick().catch(() => null), 60 * 1000);
  setTimeout(() => tick().catch(() => null), 8000);
  return () => clearInterval(id);
}

module.exports = { startBriefingDeliveryScheduler, runDeliveryCycle };
