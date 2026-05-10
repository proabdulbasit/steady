const User = require("../models/User");
const { syncSquareForUser } = require("./square");
const { syncQboForUser } = require("./quickbooks");
const { deriveInsightsForUser } = require("../lib/insights");
const { quickbooksIntegrationReady, squareIntegrationReady } = require("../lib/integration-sync");

function parseIntervalMinutes() {
  const raw = Number(process.env.INTEGRATIONS_SYNC_INTERVAL_MINUTES || 30);
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.min(Math.max(raw, 5), 24 * 60);
}

async function runOneCycle() {
  const users = await User.find({
    $or: [
      {
        integrations: {
          $elemMatch: {
            provider: "square",
            $or: [
              { status: "connected" },
              { "oauth.accessToken": { $regex: /\S+/ } },
              { "oauth.refreshToken": { $regex: /\S+/ } },
            ],
          },
        },
      },
      {
        integrations: {
          $elemMatch: {
            provider: "quickbooks",
            $or: [
              { status: "connected" },
              { "oauth.accessToken": { $regex: /\S+/ } },
              { "oauth.refreshToken": { $regex: /\S+/ } },
            ],
          },
        },
      },
    ],
  }).limit(50);

  for (const user of users) {
    const list = user.integrations || [];
    const square = list.find((x) => x.provider === "square" && squareIntegrationReady(x));
    const qbo = list.find((x) => x.provider === "quickbooks" && quickbooksIntegrationReady(x));

    if (square) {
      try {
        await syncSquareForUser({ user, integration: square });
        deriveInsightsForUser(user._id).catch(() => null);
      } catch (e) {
        square.sync = square.sync || {};
        square.sync.lastSyncedAt = new Date();
        square.sync.lastSyncStatus = `error: ${e?.message || "sync failed"}`;
        await user.save();
      }
    }
    if (qbo) {
      try {
        await syncQboForUser({ user, integration: qbo });
        deriveInsightsForUser(user._id).catch(() => null);
      } catch (e) {
        qbo.sync = qbo.sync || {};
        qbo.sync.lastSyncedAt = new Date();
        qbo.sync.lastSyncStatus = `error: ${e?.message || "sync failed"}`;
        await user.save();
      }
    }
  }
}

function startIntegrationScheduler() {
  if (process.env.INTEGRATIONS_SYNC_ENABLED !== "true") return null;
  const intervalMin = parseIntervalMinutes();
  const intervalMs = intervalMin * 60 * 1000;

  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      await runOneCycle();
    } finally {
      running = false;
    }
  }

  setTimeout(() => tick().catch(() => null), 4000);
  const id = setInterval(() => tick().catch(() => null), intervalMs);
  return () => clearInterval(id);
}

module.exports = { startIntegrationScheduler };
