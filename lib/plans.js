export const PLAN_IDS = {
  FREE: "free",
  PRO: "pro",
  BUSINESS: "business",
};

export const PLAN_CONFIG = {
  [PLAN_IDS.FREE]: {
    id: PLAN_IDS.FREE,
    name: "Free",
    priceLabel: "Free",
    monthlyPrice: 0,
    dailyQuestionLimit: 5,
    unlimitedQuestions: false,
    features: {
      premiumTools: false,
      dataIntegrations: false,
      prioritySupport: false,
    },
  },
  [PLAN_IDS.PRO]: {
    id: PLAN_IDS.PRO,
    name: "Pro",
    priceLabel: "$20/month",
    monthlyPrice: 20,
    dailyQuestionLimit: 200,
    unlimitedQuestions: false,
    features: {
      premiumTools: true,
      dataIntegrations: false,
      prioritySupport: true,
    },
  },
  [PLAN_IDS.BUSINESS]: {
    id: PLAN_IDS.BUSINESS,
    name: "Business",
    priceLabel: "$69/month",
    monthlyPrice: 69,
    dailyQuestionLimit: null,
    unlimitedQuestions: true,
    features: {
      premiumTools: true,
      dataIntegrations: true,
      prioritySupport: true,
    },
  },
};

export function getPlanConfig(planId) {
  return PLAN_CONFIG[planId] || PLAN_CONFIG[PLAN_IDS.FREE];
}
