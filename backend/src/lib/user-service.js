const User = require("../models/User");
const { PLAN_IDS, getPlanConfig } = require("../config/plans");

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeUsage(user) {
  const today = getTodayKey();
  if (!user.usage || user.usage.date !== today) {
    user.usage = {
      date: today,
      questionsUsed: 0,
    };
  }
}

function ensureBusinessIntegrationSlots(user) {
  const providers = ["stripe", "square", "quickbooks", "shopify", "slack"];
  const existing = new Map((user.integrations || []).map((entry) => [entry.provider, entry]));
  user.integrations = providers.map((provider) => existing.get(provider) || { provider, status: "disconnected" });
}

async function findUserBySessionId(sessionId) {
  if (!sessionId) return null;
  return User.findOne({ sessionIds: sessionId });
}

async function getUserById(id) {
  return User.findById(id);
}

async function getUserByEmail(email) {
  return User.findOne({ email: email.toLowerCase().trim() });
}

async function attachSessionToUser(user, sessionId) {
  if (!sessionId) return user;
  if (!user.sessionIds.includes(sessionId)) {
    user.sessionIds.push(sessionId);
  }
  return user;
}

function effectiveIntegrationStatus(entry) {
  if (!entry) return "disconnected";
  const access =
    entry.oauth && typeof entry.oauth.accessToken === "string" ? entry.oauth.accessToken.trim() : "";
  const refresh =
    entry.oauth && typeof entry.oauth.refreshToken === "string" ? entry.oauth.refreshToken.trim() : "";
  if (access || refresh) return "connected";

  if (entry.provider === "square" || entry.provider === "quickbooks") {
    return "disconnected";
  }

  if (entry.status === "connected") return "connected";
  return entry.status || "disconnected";
}

function serializeIntegrationsForClient(user) {
  const list = Array.isArray(user.integrations) ? user.integrations : [];
  return list.map((entry) => ({
    provider: entry.provider,
    status: effectiveIntegrationStatus(entry),
    externalId: entry.externalId || "",
    connectedAt: entry.connectedAt || null,
    merchantId: entry.merchantId || "",
    realmId: entry.realmId || "",
    locationIds: Array.isArray(entry.locationIds) ? entry.locationIds : [],
    sync: {
      lastSyncedAt: entry.sync?.lastSyncedAt || null,
      lastSyncStatus: entry.sync?.lastSyncStatus || "",
      cursor: entry.sync?.cursor || "",
    },
    meta: {},
  }));
}

function serializeUser(user) {
  const plan = getPlanConfig(user.planId);
  normalizeUsage(user);
  ensureBusinessIntegrationSlots(user);

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    industry: user.industry || "restaurant",
    planId: plan.id,
    planName: plan.name,
    planSelected: user.planSelected !== false,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    questionsUsed: user.usage?.questionsUsed || 0,
    questionsRemaining:
      plan.dailyQuestionLimit === null
        ? null
        : Math.max(plan.dailyQuestionLimit - (user.usage?.questionsUsed || 0), 0),
    dailyQuestionLimit: plan.dailyQuestionLimit,
    features: plan.features,
    integrations: serializeIntegrationsForClient(user),
    hasActiveSubscription:
      plan.id !== PLAN_IDS.FREE && ["active", "trialing", "past_due"].includes(user.subscriptionStatus),
    briefingDelivery: {
      emailEnabled: user.briefingDelivery?.emailEnabled !== false,
      pushEnabled: user.briefingDelivery?.pushEnabled !== false,
      lastDeliveredAt: user.briefingDelivery?.lastDeliveredAt || null,
      lastDeliveryDateKey: user.briefingDelivery?.lastDeliveryDateKey || "",
    },
    pushSubscriptionCount: Array.isArray(user.pushSubscriptions) ? user.pushSubscriptions.length : 0,
  };
}

async function getOrCreateGuestContext(sessionId) {
  return {
    kind: "guest",
    sessionId,
    planId: PLAN_IDS.FREE,
    subscriptionStatus: "inactive",
    usage: {
      date: getTodayKey(),
      questionsUsed: 0,
    },
  };
}

async function resolveActor({ userId, sessionId }) {
  let user = null;
  if (userId) {
    user = await getUserById(userId);
  }

  if (!user && sessionId) {
    user = await findUserBySessionId(sessionId);
  }

  if (user) {
    normalizeUsage(user);
    ensureBusinessIntegrationSlots(user);
    return { kind: "user", user };
  }

  return getOrCreateGuestContext(sessionId);
}

async function authorizeQuestion(actor, options = {}) {
  const { consume = false } = options;

  if (actor.kind === "guest") {
    const plan = getPlanConfig(PLAN_IDS.FREE);
    const questionsUsed = actor.usage?.questionsUsed || 0;
    const allowed = questionsUsed < plan.dailyQuestionLimit;

    return {
      actor,
      plan,
      access: {
        allowed,
        questionsUsed,
        questionsRemaining: Math.max(plan.dailyQuestionLimit - questionsUsed, 0),
        dailyLimit: plan.dailyQuestionLimit,
        features: plan.features,
      },
    };
  }

  const { user } = actor;
  normalizeUsage(user);
  const plan = getPlanConfig(user.planId);
  const dailyLimit = plan.dailyQuestionLimit;
  const questionsUsed = user.usage?.questionsUsed || 0;
  const allowed = dailyLimit === null || questionsUsed < dailyLimit;

  if (allowed && dailyLimit !== null && consume) {
    user.usage.questionsUsed += 1;
    await user.save();
  } else if (user.isModified()) {
    await user.save();
  }

  const effectiveQuestionsUsed = user.usage?.questionsUsed || questionsUsed;

  return {
    actor,
    plan,
    access: {
      allowed,
      questionsUsed: effectiveQuestionsUsed,
      questionsRemaining: dailyLimit === null ? null : Math.max(dailyLimit - effectiveQuestionsUsed, 0),
      dailyLimit,
      features: plan.features,
    },
  };
}

module.exports = {
  attachSessionToUser,
  authorizeQuestion,
  effectiveIntegrationStatus,
  ensureBusinessIntegrationSlots,
  findUserBySessionId,
  getUserByEmail,
  getUserById,
  normalizeUsage,
  resolveActor,
  serializeIntegrationsForClient,
  serializeUser,
};
