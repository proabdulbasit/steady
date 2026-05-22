const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getUserById } = require("../lib/user-service");
const { runDataProcessingForUser, getProcessingStatusForUser } = require("../lib/data-processing");
const { generateBriefingForUser, getLatestBriefingForUser, dateKeyUtc } = require("../lib/briefing-summary");
const { getLatestBusinessInsights, refreshBusinessInsightsForUser } = require("../lib/business-insights");
const {
  deliverDailyBriefingForUser,
  getDeliveryStatusForUser,
  serializeDeliveryPrefs,
  listNotificationsForUser,
  markNotificationRead,
  sendConnectivityTestEmailForUser,
  getIntegrationSummary,
} = require("../lib/briefing-delivery");
const { getVapidPublicKey, isPushConfigured } = require("../lib/push");

const router = express.Router();

/** Scheduler config + this user's processing run history. */
router.get("/processing/status", requireAuth, async (req, res) => {
  const status = await getProcessingStatusForUser(req.auth.sub);
  return res.json({ ok: true, ...status });
});

/** Manual full sync (Square + QuickBooks) + insight derivation — same pipeline as the scheduler. */
router.post("/processing/run-now", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  const result = await runDataProcessingForUser(user, { trigger: "manual" });
  const status = await getProcessingStatusForUser(req.auth.sub);
  const autoBriefing = process.env.BRIEFING_AUTO_GENERATE_AFTER_SYNC === "true";
  let briefing = null;
  if (autoBriefing) {
    try {
      const gen = await generateBriefingForUser(user, { force: true });
      briefing = gen.briefing;
    } catch {
      /* optional — do not fail sync */
    }
  }

  let delivery = null;
  if (process.env.BRIEFING_DELIVER_AFTER_SYNC === "true") {
    try {
      delivery = await deliverDailyBriefingForUser(user, { force: false, generateIfMissing: true });
    } catch {
      /* optional */
    }
  }

  return res.json({ ok: true, result, briefing, delivery, ...status });
});

/** Latest AI daily briefing (today's UTC date first, else most recent). */
router.get("/summary/latest", requireAuth, async (req, res) => {
  const briefing = await getLatestBriefingForUser(req.auth.sub, { preferDateKey: dateKeyUtc() });
  return res.json({ ok: true, briefing, dateKey: dateKeyUtc() });
});

/** Generate or refresh today's briefing in plain English. */
router.post("/summary/generate", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  const force = req.body?.force === true || req.body?.regenerate === true;
  const result = await generateBriefingForUser(user, { force });
  return res.json({ ok: true, ...result, dateKey: dateKeyUtc() });
});

/** Revenue, cost, and staffing insights in plain English (latest snapshot). */
router.get("/insights/latest", requireAuth, async (req, res) => {
  const dashboard = await getLatestBusinessInsights(req.auth.sub);
  return res.json({ ok: true, dashboard, dateKey: dateKeyUtc() });
});

/** Recompute revenue / cost / staffing pillars from synced metrics. */
router.post("/insights/refresh", requireAuth, async (req, res) => {
  const result = await refreshBusinessInsightsForUser(req.auth.sub);
  return res.json({ ok: true, ...result, dateKey: dateKeyUtc() });
});

/** Email + push delivery preferences and today's send log. */
router.get("/delivery/status", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  const status = await getDeliveryStatusForUser(req.auth.sub);
  return res.json({
    ok: true,
    prefs: serializeDeliveryPrefs(user),
    pushConfigured: isPushConfigured(),
    vapidPublicKey: getVapidPublicKey() || null,
    ...status,
  });
});

router.patch("/delivery/preferences", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  const { emailEnabled, pushEnabled } = req.body || {};
  user.briefingDelivery = user.briefingDelivery || {};
  if (typeof emailEnabled === "boolean") user.briefingDelivery.emailEnabled = emailEnabled;
  if (typeof pushEnabled === "boolean") user.briefingDelivery.pushEnabled = pushEnabled;
  await user.save();
  return res.json({ ok: true, prefs: serializeDeliveryPrefs(user) });
});

/** Manual test: sync integrations, then send today's briefing by email + in-app + push. */
router.post("/delivery/send-now", requireAuth, async (req, res) => {
  let user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  const force = req.body?.force === true;

  let syncResult = null;
  const integrations = getIntegrationSummary(user);
  if (integrations.square.connected || integrations.quickbooks.connected) {
    syncResult = await runDataProcessingForUser(user, { trigger: "manual" });
    user = await getUserById(req.auth.sub);
    if (!user) return res.status(404).json({ error: "User not found." });
  }

  const result = await deliverDailyBriefingForUser(user, {
    force,
    generateIfMissing: true,
    forceGenerate: true,
  });
  return res.json({ ok: true, syncResult, ...result });
});

/** Plain test email to your account — no Square/QBO/briefing required (verifies Mailgun). */
router.post("/delivery/test-email", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  const result = await sendConnectivityTestEmailForUser(user);
  return res.json({ ok: true, ...result });
});

router.get("/notifications/vapid-public-key", requireAuth, (_req, res) => {
  return res.json({ ok: true, configured: isPushConfigured(), publicKey: getVapidPublicKey() || null });
});

router.post("/notifications/push-subscribe", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  const { subscription } = req.body || {};
  const endpoint = typeof subscription?.endpoint === "string" ? subscription.endpoint : "";
  const p256dh = subscription?.keys?.p256dh || "";
  const auth = subscription?.keys?.auth || "";
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "Invalid push subscription." });
  }
  user.pushSubscriptions = Array.isArray(user.pushSubscriptions) ? user.pushSubscriptions : [];
  user.pushSubscriptions = user.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
  user.pushSubscriptions.push({
    endpoint,
    keys: { p256dh, auth },
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "",
    createdAt: new Date(),
  });
  await user.save();
  return res.json({ ok: true, count: user.pushSubscriptions.length });
});

router.delete("/notifications/push-subscribe", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  if (endpoint) {
    user.pushSubscriptions = (user.pushSubscriptions || []).filter((s) => s.endpoint !== endpoint);
  } else {
    user.pushSubscriptions = [];
  }
  await user.save();
  return res.json({ ok: true, count: user.pushSubscriptions.length });
});

router.get("/notifications", requireAuth, async (req, res) => {
  const notifications = await listNotificationsForUser(req.auth.sub);
  return res.json({ ok: true, notifications });
});

router.post("/notifications/:id/read", requireAuth, async (req, res) => {
  const note = await markNotificationRead(req.auth.sub, req.params.id);
  if (!note) return res.status(404).json({ error: "Notification not found." });
  return res.json({ ok: true, notification: note });
});

module.exports = router;
