const PLAN_IDS = {
  FREE: "free",
  PRO: "pro",
  BUSINESS: "business",
};

function normalizeStripePriceId(value) {
  return typeof value === "string" && value.startsWith("price_") ? value : "";
}

const PLAN_CONFIG = {
  [PLAN_IDS.FREE]: {
    id: PLAN_IDS.FREE,
    name: "Free",
    dailyQuestionLimit: 3,
    unlimitedQuestions: false,
    priceId: null,
    features: {
      premiumTools: false,
      dataIntegrations: false,
      prioritySupport: false,
    },
  },
  [PLAN_IDS.PRO]: {
    id: PLAN_IDS.PRO,
    name: "Pro",
    dailyQuestionLimit: 200,
    unlimitedQuestions: false,
    priceId: normalizeStripePriceId(process.env.STRIPE_PRO_PRICE_ID || ""),
    features: {
      premiumTools: true,
      dataIntegrations: true,
      prioritySupport: true,
    },
  },
  [PLAN_IDS.BUSINESS]: {
    id: PLAN_IDS.BUSINESS,
    name: "Business",
    dailyQuestionLimit: null,
    unlimitedQuestions: true,
    priceId: normalizeStripePriceId(process.env.STRIPE_BUSINESS_PRICE_ID || ""),
    features: {
      premiumTools: true,
      dataIntegrations: true,
      prioritySupport: true,
    },
  },
};

function getPlanConfig(planId) {
  return PLAN_CONFIG[planId] || PLAN_CONFIG[PLAN_IDS.FREE];
}

function getPlanByPriceId(priceId) {
  return Object.values(PLAN_CONFIG).find((plan) => plan.priceId && plan.priceId === priceId) || null;
}

module.exports = {
  PLAN_IDS,
  PLAN_CONFIG,
  getPlanConfig,
  getPlanByPriceId,
};
