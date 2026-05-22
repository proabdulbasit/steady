const User = require("../models/User");
const Notification = require("../models/Notification");
const BriefingDeliveryLog = require("../models/BriefingDeliveryLog");
const { sendDailyBriefingEmail, sendMailgunConnectivityTestEmail } = require("./mail");
const { squareIntegrationReady, quickbooksIntegrationReady } = require("./integration-sync");
const { getLatestBriefingForUser, generateBriefingForUser, dateKeyUtc } = require("./briefing-summary");
const { getLatestBusinessInsights, refreshBusinessInsightsForUser } = require("./business-insights");
const { sendWebPushToSubscription, isPushConfigured } = require("./push");

function getFrontendOrigin() {
  const raw = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "";
  return typeof raw === "string" ? raw.replace(/\/$/, "") : "http://localhost:3000";
}

function defaultBriefingDeliveryPrefs(user) {
  const d = user?.briefingDelivery || {};
  return {
    emailEnabled: d.emailEnabled !== false,
    pushEnabled: d.pushEnabled !== false,
    lastDeliveredAt: d.lastDeliveredAt || null,
    lastDeliveryDateKey: d.lastDeliveryDateKey || "",
  };
}

function serializeDeliveryPrefs(user) {
  const prefs = defaultBriefingDeliveryPrefs(user);
  const subs = Array.isArray(user?.pushSubscriptions) ? user.pushSubscriptions : [];
  return {
    ...prefs,
    pushConfigured: isPushConfigured(),
    pushSubscriptionCount: subs.length,
  };
}

async function logDelivery({ userId, dateKey, channel, status, error = "", messageId = "" }) {
  await BriefingDeliveryLog.findOneAndUpdate(
    { userId, dateKey, channel },
    { $set: { status, error, messageId, sentAt: new Date() } },
    { upsert: true }
  );
}

async function alreadyDelivered(userId, dateKey, channel) {
  const row = await BriefingDeliveryLog.findOne({ userId, dateKey, channel, status: "sent" }).lean();
  return !!row;
}

async function ensureBriefingContent(user, { generateIfMissing = true, forceGenerate = false } = {}) {
  let briefing = await getLatestBriefingForUser(user._id, { preferDateKey: dateKeyUtc() });
  let generateError = "";

  if ((!briefing || forceGenerate) && generateIfMissing) {
    try {
      const gen = await generateBriefingForUser(user, { force: forceGenerate || !briefing });
      briefing = gen.briefing || briefing;
    } catch (e) {
      generateError = e?.message || "Could not generate briefing.";
    }
  }

  let insights = await getLatestBusinessInsights(user._id);
  if (!insights || forceGenerate) {
    try {
      const ref = await refreshBusinessInsightsForUser(user._id);
      insights = ref.dashboard;
    } catch (e) {
      if (!insights) generateError = generateError || e?.message || "Could not compute insights.";
    }
  }
  return { briefing, insights, generateError };
}

function hasDeliverableContent(briefing, insights) {
  if (briefing?.headline) return true;
  const pillars = [insights?.revenue, insights?.costs, insights?.staffing];
  return pillars.some(
    (p) => p && ["ready", "limited"].includes(p.status) && (p.headline || p.summary)
  );
}

/** When AI briefing is missing, build email/in-app body from revenue/cost/staffing insights. */
function buildBriefingForDelivery(briefing, insights) {
  if (briefing?.headline) return { briefing, usedInsightsFallback: false };
  const pillars = [
    { key: "revenue", label: "Revenue" },
    { key: "costs", label: "Costs" },
    { key: "staffing", label: "Staffing" },
  ];
  const sections = pillars
    .map(({ key, label }) => {
      const p = insights?.[key];
      if (!p || p.status === "no_data") return null;
      return {
        id: key,
        title: label,
        body: [p.headline, p.summary].filter(Boolean).join("\n\n"),
      };
    })
    .filter((s) => s && s.body);

  if (!sections.length) return { briefing: null, usedInsightsFallback: false };

  const headline =
    insights?.revenue?.headline ||
    insights?.costs?.headline ||
    "Your daily business insights are ready";

  return {
    briefing: { headline, sections, plainText: "" },
    usedInsightsFallback: true,
  };
}

/** When integrations are connected but metrics/briefing are empty (common in sandbox). */
function buildConnectedAccountsBriefing(user) {
  const integrations = getIntegrationSummary(user);
  const { square, quickbooks } = integrations;
  if (!square.connected && !quickbooks.connected) return null;

  const lines = [];
  if (square.connected) {
    const syncHint = square.lastSyncedAt
      ? ` Last sync: ${new Date(square.lastSyncedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.`
      : "";
    lines.push(
      `Square is connected.${syncHint} Status: ${square.lastSyncStatus || "ready to sync"}.`
    );
  }
  if (quickbooks.connected) {
    const syncHint = quickbooks.lastSyncedAt
      ? ` Last sync: ${new Date(quickbooks.lastSyncedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.`
      : "";
    lines.push(
      `QuickBooks is connected.${syncHint} Status: ${quickbooks.lastSyncStatus || "ready to sync"}.`
    );
  }

  return {
    briefing: {
      headline: "Your Steady sync is active",
      sections: [
        {
          id: "status",
          title: "Today's update",
          body: [
            lines.join("\n"),
            "",
            "We did not find sales or expense numbers to include in a full briefing yet. In Square sandbox, add test payments if you want revenue figures. On your Steady profile, use Run full sync now, then Recompute insights or Generate briefing.",
          ].join("\n"),
        },
      ],
    },
    usedInsightsFallback: false,
    usedConnectedFallback: true,
    usedPreviewFallback: false,
  };
}

/** Manual "Send test now" — always deliverable when integrations are not set up yet. */
function buildSendNowPreviewBriefing(user) {
  const profileUrl = `${getFrontendOrigin()}/profile`;
  const integrations = getIntegrationSummary(user);
  const { square, quickbooks } = integrations;

  if (square.connected || quickbooks.connected) return null;

  return {
    briefing: {
      headline: "Steady daily briefing — delivery test",
      sections: [
        {
          id: "setup",
          title: "You're all set for email delivery",
          body: [
            "This message confirms that Send test now can reach your inbox via Mailgun.",
            "",
            "To receive a real briefing with revenue, costs, and staffing:",
            "1. Connect Square and/or QuickBooks on your Steady profile",
            "2. Run Full sync now",
            "3. Recompute insights or Generate briefing",
            "",
            `Open your profile: ${profileUrl}`,
          ].join("\n"),
        },
      ],
    },
    usedInsightsFallback: false,
    usedConnectedFallback: false,
    usedPreviewFallback: true,
  };
}

function resolveBriefingForDelivery(briefing, insights, user, { allowPreview = false } = {}) {
  const fromBriefingOrInsights = buildBriefingForDelivery(briefing, insights);
  if (fromBriefingOrInsights.briefing?.headline) {
    return { ...fromBriefingOrInsights, usedConnectedFallback: false, usedPreviewFallback: false };
  }
  const fromConnected = buildConnectedAccountsBriefing(user);
  if (fromConnected) return fromConnected;
  if (allowPreview) {
    const preview = buildSendNowPreviewBriefing(user);
    if (preview) return preview;
  }
  return {
    briefing: null,
    usedInsightsFallback: false,
    usedConnectedFallback: false,
    usedPreviewFallback: false,
  };
}

function buildPushPayload({ briefing, profileUrl }) {
  const title = briefing?.headline || "Your Steady daily briefing";
  const firstSection = briefing?.sections?.[0];
  const body = firstSection?.body
    ? String(firstSection.body).slice(0, 180)
    : "Tap to read revenue, costs, and staffing insights.";
  return {
    title: "Steady — Daily briefing",
    body: `${title}. ${body}`.slice(0, 240),
    url: profileUrl,
  };
}

async function deliverEmail(user, { dateKey, briefing, insights, force }) {
  if (!defaultBriefingDeliveryPrefs(user).emailEnabled) {
    await logDelivery({ userId: user._id, dateKey, channel: "email", status: "skipped", error: "disabled" });
    return { channel: "email", status: "skipped", reason: "disabled" };
  }
  if (!force && (await alreadyDelivered(user._id, dateKey, "email"))) {
    return { channel: "email", status: "skipped", reason: "already_sent" };
  }
  if (!user.email) {
    await logDelivery({ userId: user._id, dateKey, channel: "email", status: "failed", error: "no email" });
    return { channel: "email", status: "failed", error: "no email" };
  }
  const {
    briefing: emailBriefing,
    usedInsightsFallback,
    usedConnectedFallback,
    usedPreviewFallback,
  } = resolveBriefingForDelivery(briefing, insights, user, { allowPreview: force });
  if (!emailBriefing?.headline) {
    await logDelivery({
      userId: user._id,
      dateKey,
      channel: "email",
      status: "skipped",
      error: "no briefing or insights — connect Square/QBO, run full sync, then try again",
    });
    return { channel: "email", status: "skipped", reason: "no_content" };
  }

  try {
    const profileUrl = `${getFrontendOrigin()}/profile`;
    const result = await sendDailyBriefingEmail({
      to: user.email,
      ownerName: user.name,
      briefing: emailBriefing,
      insights: usedInsightsFallback || usedConnectedFallback || usedPreviewFallback ? null : insights,
      profileUrl,
    });
    await logDelivery({
      userId: user._id,
      dateKey,
      channel: "email",
      status: "sent",
      messageId: result.messageId || "",
    });
    return {
      channel: "email",
      status: "sent",
      messageId: result.messageId,
      usedInsightsFallback,
      usedConnectedFallback,
      usedPreviewFallback,
    };
  } catch (e) {
    await logDelivery({ userId: user._id, dateKey, channel: "email", status: "failed", error: e.message });
    return { channel: "email", status: "failed", error: e.message };
  }
}

async function deliverInApp(user, { dateKey, briefing, insights, force }) {
  const { briefing: inAppBriefing } = resolveBriefingForDelivery(briefing, insights, user, {
    allowPreview: force,
  });
  if (!inAppBriefing?.headline) {
    await logDelivery({
      userId: user._id,
      dateKey,
      channel: "in_app",
      status: "skipped",
      error: "no briefing or insights",
    });
    return { channel: "in_app", status: "skipped", reason: "no_content" };
  }
  briefing = inAppBriefing;
  if (!force && (await alreadyDelivered(user._id, dateKey, "in_app"))) {
    return { channel: "in_app", status: "skipped", reason: "already_sent" };
  }

  const profileUrl = "/profile";
  const body =
    briefing.sections?.[0]?.body?.slice(0, 200) ||
    "Your daily revenue, cost, and staffing insights are ready.";

  const note = await Notification.create({
    userId: user._id,
    type: "daily_briefing",
    title: briefing.headline,
    body,
    url: profileUrl,
    meta: { dateKey },
  });

  await logDelivery({ userId: user._id, dateKey, channel: "in_app", status: "sent" });
  return { channel: "in_app", status: "sent", notificationId: String(note._id) };
}

async function deliverPush(user, { dateKey, briefing, insights, force }) {
  const prefs = defaultBriefingDeliveryPrefs(user);
  if (!prefs.pushEnabled) {
    await logDelivery({ userId: user._id, dateKey, channel: "push", status: "skipped", error: "disabled" });
    return { channel: "push", status: "skipped", reason: "disabled" };
  }
  if (!force && (await alreadyDelivered(user._id, dateKey, "push"))) {
    return { channel: "push", status: "skipped", reason: "already_sent" };
  }
  if (!isPushConfigured()) {
    await logDelivery({ userId: user._id, dateKey, channel: "push", status: "skipped", error: "vapid_not_configured" });
    return { channel: "push", status: "skipped", reason: "vapid_not_configured" };
  }

  const subs = Array.isArray(user.pushSubscriptions) ? user.pushSubscriptions : [];
  if (!subs.length) {
    await logDelivery({ userId: user._id, dateKey, channel: "push", status: "skipped", error: "no_subscriptions" });
    return { channel: "push", status: "skipped", reason: "no_subscriptions" };
  }
  const { briefing: pushBriefing } = resolveBriefingForDelivery(briefing, insights, user, {
    allowPreview: force,
  });
  if (!pushBriefing?.headline) {
    await logDelivery({ userId: user._id, dateKey, channel: "push", status: "skipped", error: "no briefing" });
    return { channel: "push", status: "skipped", reason: "no_content" };
  }

  const profileUrl = `${getFrontendOrigin()}/profile`;
  const payload = buildPushPayload({ briefing: pushBriefing, profileUrl });
  let sent = 0;
  let failed = 0;
  const staleEndpoints = [];

  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth },
    };
    const result = await sendWebPushToSubscription(subscription, payload);
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      if (result.statusCode === 404 || result.statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      }
    }
  }

  if (staleEndpoints.length) {
    user.pushSubscriptions = subs.filter((s) => !staleEndpoints.includes(s.endpoint));
    await user.save();
  }

  if (sent > 0) {
    await logDelivery({ userId: user._id, dateKey, channel: "push", status: "sent", messageId: `${sent} device(s)` });
    return { channel: "push", status: "sent", sent, failed };
  }

  await logDelivery({
    userId: user._id,
    dateKey,
    channel: "push",
    status: "failed",
    error: `all ${failed} failed`,
  });
  return { channel: "push", status: "failed", failed };
}

/**
 * Send daily briefing via email, in-app notification, and web push.
 */
async function deliverDailyBriefingForUser(
  user,
  { force = false, generateIfMissing = true, forceGenerate = false } = {}
) {
  if (!user?._id) throw new Error("User is required.");
  const dateKey = dateKeyUtc();
  const { briefing, insights, generateError } = await ensureBriefingContent(user, {
    generateIfMissing,
    forceGenerate,
  });

  const results = await Promise.all([
    deliverEmail(user, { dateKey, briefing, insights, force }),
    deliverInApp(user, { dateKey, briefing, insights, force }),
    deliverPush(user, { dateKey, briefing, insights, force }),
  ]);

  user.briefingDelivery = user.briefingDelivery || {};
  user.briefingDelivery.lastDeliveredAt = new Date();
  user.briefingDelivery.lastDeliveryDateKey = dateKey;
  await user.save();

  const logs = await BriefingDeliveryLog.find({ userId: user._id, dateKey }).lean();

  const integrations = getIntegrationSummary(user);
  const noIntegrations = !integrations.square.connected && !integrations.quickbooks.connected;
  const emailResult = results.find((r) => r.channel === "email");
  const usedConnectedFallback = Boolean(emailResult?.usedConnectedFallback);
  const usedPreviewFallback = Boolean(emailResult?.usedPreviewFallback);
  const usedInsightsFallback =
    Boolean(emailResult?.usedInsightsFallback) ||
    (!briefing?.headline && hasDeliverableContent(briefing, insights));

  return {
    dateKey,
    briefing: briefing ? { headline: briefing.headline, dateKey: briefing.dateKey } : null,
    generateError:
      generateError ||
      (usedPreviewFallback
        ? ""
        : noIntegrations
          ? "Connect Square or QuickBooks in Integrations above for a full briefing."
          : !hasDeliverableContent(briefing, insights) && !usedConnectedFallback
            ? "Run full sync, then Recompute insights (or Generate briefing) for the full summary."
            : usedConnectedFallback
              ? "Sent a sync-status email — add test sales in Square sandbox or generate a briefing for the full summary."
              : ""),
    usedInsightsFallback,
    usedConnectedFallback,
    usedPreviewFallback,
    integrations,
    results,
    logs: logs.map((l) => ({
      channel: l.channel,
      status: l.status,
      error: l.error || "",
      sentAt: l.sentAt,
    })),
  };
}

async function getDeliveryStatusForUser(userId) {
  const dateKey = dateKeyUtc();
  const logs = await BriefingDeliveryLog.find({ userId, dateKey }).lean();
  const user = await User.findById(userId).lean();
  return {
    dateKey,
    prefs: user ? serializeDeliveryPrefs(user) : null,
    todayLogs: logs.map((l) => ({
      channel: l.channel,
      status: l.status,
      error: l.error || "",
      sentAt: l.sentAt,
    })),
  };
}

async function listNotificationsForUser(userId, { limit = 20 } = {}) {
  const items = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
  return items.map((n) => ({
    id: String(n._id),
    type: n.type,
    title: n.title,
    body: n.body,
    url: n.url,
    readAt: n.readAt,
    createdAt: n.createdAt,
  }));
}

async function markNotificationRead(userId, notificationId) {
  const note = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { readAt: new Date() } },
    { new: true }
  ).lean();
  return note ? { id: String(note._id), readAt: note.readAt } : null;
}

function getIntegrationSummary(user) {
  const list = user?.integrations || [];
  const square = list.find((x) => x.provider === "square");
  const qbo = list.find((x) => x.provider === "quickbooks");
  return {
    square: {
      connected: squareIntegrationReady(square),
      lastSyncedAt: square?.sync?.lastSyncedAt || null,
      lastSyncStatus: square?.sync?.lastSyncStatus || "",
    },
    quickbooks: {
      connected: quickbooksIntegrationReady(qbo),
      lastSyncedAt: qbo?.sync?.lastSyncedAt || null,
      lastSyncStatus: qbo?.sync?.lastSyncStatus || "",
    },
  };
}

/** Send a plain test email — proves Mailgun works without Square/QBO/briefing. */
async function sendConnectivityTestEmailForUser(user) {
  if (!user?.email) {
    const err = new Error("Your account has no email address.");
    err.status = 400;
    throw err;
  }
  const result = await sendMailgunConnectivityTestEmail({
    to: user.email,
    ownerName: user.name,
  });
  return {
    ok: true,
    to: user.email,
    provider: result.provider,
    messageId: result.messageId || "",
  };
}

module.exports = {
  deliverDailyBriefingForUser,
  getDeliveryStatusForUser,
  serializeDeliveryPrefs,
  defaultBriefingDeliveryPrefs,
  listNotificationsForUser,
  markNotificationRead,
  getIntegrationSummary,
  sendConnectivityTestEmailForUser,
};
