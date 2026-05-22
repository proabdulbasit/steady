const DataProcessingRun = require("../models/DataProcessingRun");
const { syncSquareForUser } = require("../integrations/square");
const { syncQboForUser } = require("../integrations/quickbooks");
const { refreshBusinessInsightsForUser } = require("./business-insights");
const { quickbooksIntegrationReady, squareIntegrationReady } = require("./integration-sync");

function parseIntervalMinutes() {
  const raw = Number(process.env.INTEGRATIONS_SYNC_INTERVAL_MINUTES || 30);
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.min(Math.max(raw, 5), 24 * 60);
}

function isSchedulerEnabled() {
  return process.env.INTEGRATIONS_SYNC_ENABLED === "true";
}

/** In-memory snapshot of the last background cycle (resets on process restart). */
let lastSchedulerCycle = {
  startedAt: null,
  finishedAt: null,
  usersProcessed: 0,
  runsCreated: 0,
  error: "",
};

function getLastSchedulerCycle() {
  return { ...lastSchedulerCycle };
}

function setLastSchedulerCycle(patch) {
  lastSchedulerCycle = { ...lastSchedulerCycle, ...patch };
}

/**
 * Sync all connected integrations for one user, recompute insights, and persist a run log.
 * @param {import("mongoose").Document} user
 * @param {{ trigger?: "scheduled"|"manual" }} opts
 */
async function runDataProcessingForUser(user, { trigger = "manual" } = {}) {
  if (!user?._id) throw new Error("User is required.");

  const run = await DataProcessingRun.create({
    userId: user._id,
    trigger,
    status: "running",
    providers: [],
    startedAt: new Date(),
  });

  const list = user.integrations || [];
  const square = list.find((x) => x.provider === "square" && squareIntegrationReady(x));
  const qbo = list.find((x) => x.provider === "quickbooks" && quickbooksIntegrationReady(x));
  const providerResults = [];

  async function runProvider(provider, fn) {
    try {
      const detail = await fn();
      providerResults.push({
        provider,
        status: "ok",
        message: "synced",
        detail,
      });
    } catch (e) {
      const entry = list.find((x) => x.provider === provider);
      if (entry) {
        entry.sync = entry.sync || {};
        entry.sync.lastSyncedAt = new Date();
        entry.sync.lastSyncStatus = `error: ${e?.message || "sync failed"}`;
      }
      providerResults.push({
        provider,
        status: "error",
        message: e?.message || "sync failed",
        detail: null,
      });
    }
  }

  if (square) {
    await runProvider("square", () => syncSquareForUser({ user, integration: square }));
  } else {
    providerResults.push({ provider: "square", status: "skipped", message: "not connected", detail: null });
  }

  if (qbo) {
    await runProvider("quickbooks", () => syncQboForUser({ user, integration: qbo }));
  } else {
    providerResults.push({ provider: "quickbooks", status: "skipped", message: "not connected", detail: null });
  }

  if (square || qbo) {
    await user.save();
  }

  let insightsCreated = 0;
  const hadSync = providerResults.some((p) => p.status === "ok");
  if (hadSync) {
    try {
      const insightResult = await refreshBusinessInsightsForUser(user._id);
      insightsCreated = Number(insightResult?.alertsCreated || 0);
    } catch (e) {
      providerResults.push({
        provider: "insights",
        status: "error",
        message: e?.message || "insight derivation failed",
        detail: null,
      });
    }
  } else {
    providerResults.push({
      provider: "insights",
      status: "skipped",
      message: "no integrations synced",
      detail: null,
    });
  }

  const errors = providerResults.filter((p) => p.status === "error");
  const oks = providerResults.filter((p) => p.status === "ok");
  let status = "success";
  if (errors.length && oks.length) status = "partial";
  else if (errors.length && !oks.length) status = "failed";
  else if (!oks.length) status = "success"; // all skipped — still a successful no-op run

  run.providers = providerResults;
  run.insightsCreated = insightsCreated;
  run.status = status;
  run.error = errors.map((e) => `${e.provider}: ${e.message}`).join("; ");
  run.finishedAt = new Date();
  await run.save();

  return {
    runId: run._id,
    status: run.status,
    trigger: run.trigger,
    providers: providerResults,
    insightsCreated,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

async function getProcessingStatusForUser(userId) {
  const lastRun = await DataProcessingRun.findOne({ userId }).sort({ startedAt: -1 }).lean();
  const recentRuns = await DataProcessingRun.find({ userId }).sort({ startedAt: -1 }).limit(8).lean();

  return {
    scheduler: {
      enabled: isSchedulerEnabled(),
      intervalMinutes: parseIntervalMinutes(),
      lastCycle: getLastSchedulerCycle(),
    },
    lastRun: lastRun
      ? {
          id: String(lastRun._id),
          trigger: lastRun.trigger,
          status: lastRun.status,
          providers: lastRun.providers || [],
          insightsCreated: lastRun.insightsCreated || 0,
          startedAt: lastRun.startedAt,
          finishedAt: lastRun.finishedAt,
          error: lastRun.error || "",
        }
      : null,
    recentRuns: recentRuns.map((r) => ({
      id: String(r._id),
      trigger: r.trigger,
      status: r.status,
      insightsCreated: r.insightsCreated || 0,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
    })),
  };
}

module.exports = {
  runDataProcessingForUser,
  getProcessingStatusForUser,
  parseIntervalMinutes,
  isSchedulerEnabled,
  getLastSchedulerCycle,
  setLastSchedulerCycle,
};
