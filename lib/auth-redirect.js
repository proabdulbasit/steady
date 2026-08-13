import { PLAN_IDS } from "./plans";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export function hasActiveSubscription(profile) {
  if (!profile) return false;
  if (profile.hasActiveSubscription) return true;
  const planId = profile.planId || PLAN_IDS.FREE;
  return planId !== PLAN_IDS.FREE && ACTIVE_SUBSCRIPTION_STATUSES.has(profile.subscriptionStatus);
}

/** True once the user has chosen a plan or already has a live subscription. */
export function canAccessApp(profile) {
  if (!profile) return false;
  if (hasActiveSubscription(profile)) return true;
  return profile.planSelected !== false;
}

export function getPostAuthPath(profile) {
  return canAccessApp(profile) ? "/chat" : "/pricing";
}
