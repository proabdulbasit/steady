const webpush = require("web-push");

function getVapidPublicKey() {
  return typeof process.env.VAPID_PUBLIC_KEY === "string" ? process.env.VAPID_PUBLIC_KEY.trim() : "";
}

function getVapidPrivateKey() {
  return typeof process.env.VAPID_PRIVATE_KEY === "string" ? process.env.VAPID_PRIVATE_KEY.trim() : "";
}

function isPushConfigured() {
  return !!(getVapidPublicKey() && getVapidPrivateKey());
}

function configureWebPush() {
  if (!isPushConfigured()) return false;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@steady.local";
  webpush.setVapidDetails(subject, getVapidPublicKey(), getVapidPrivateKey());
  return true;
}

async function sendWebPushToSubscription(subscription, payload) {
  if (!configureWebPush()) {
    return { ok: false, skipped: true, error: "VAPID keys not configured" };
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || "push failed", statusCode: e?.statusCode };
  }
}

module.exports = {
  getVapidPublicKey,
  isPushConfigured,
  sendWebPushToSubscription,
};
