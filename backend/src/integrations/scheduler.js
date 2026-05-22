const User = require("../models/User");
const {
  runDataProcessingForUser,
  parseIntervalMinutes,
  isSchedulerEnabled,
  setLastSchedulerCycle,
} = require("../lib/data-processing");
const { quickbooksIntegrationReady, squareIntegrationReady } = require("../lib/integration-sync");

async function findUsersWithIntegrations() {
  return User.find({
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
}

function userHasReadyIntegration(user) {
  const list = user.integrations || [];
  return list.some(
    (x) =>
      (x.provider === "square" && squareIntegrationReady(x)) ||
      (x.provider === "quickbooks" && quickbooksIntegrationReady(x))
  );
}

async function runOneCycle() {
  const startedAt = new Date();
  setLastSchedulerCycle({ startedAt, finishedAt: null, usersProcessed: 0, runsCreated: 0, error: "" });

  try {
    const users = await findUsersWithIntegrations();
    let runsCreated = 0;
    let usersProcessed = 0;

    for (const user of users) {
      if (!userHasReadyIntegration(user)) continue;
      usersProcessed += 1;
      try {
        await runDataProcessingForUser(user, { trigger: "scheduled" });
        runsCreated += 1;
      } catch (e) {
        console.error("[scheduler] user processing failed", user._id, e?.message || e);
      }
    }

    setLastSchedulerCycle({
      finishedAt: new Date(),
      usersProcessed,
      runsCreated,
      error: "",
    });
  } catch (e) {
    setLastSchedulerCycle({
      finishedAt: new Date(),
      error: e?.message || "cycle failed",
    });
    throw e;
  }
}

function startIntegrationScheduler() {
  if (!isSchedulerEnabled()) {
    console.log("[scheduler] INTEGRATIONS_SYNC_ENABLED is not true — background sync disabled.");
    return null;
  }

  const intervalMin = parseIntervalMinutes();
  const intervalMs = intervalMin * 60 * 1000;
  console.log(`[scheduler] Automated data processing every ${intervalMin} minute(s).`);

  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      await runOneCycle();
    } catch (e) {
      console.error("[scheduler] cycle error", e?.message || e);
    } finally {
      running = false;
    }
  }

  setTimeout(() => tick().catch(() => null), 4000);
  const id = setInterval(() => tick().catch(() => null), intervalMs);
  return () => clearInterval(id);
}

module.exports = { startIntegrationScheduler, runOneCycle };
