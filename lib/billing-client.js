import { loadStripe } from "@stripe/stripe-js";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

let stripePromise;

function getBackendUrl(path) {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Request failed.");
  }

  return data;
}

export async function fetchSubscriptionStatus(sessionId) {
  const response = await fetch(getBackendUrl(`/api/billing/status/${sessionId}`), {
    cache: "no-store",
  });

  return parseResponse(response);
}

export async function createCheckoutSession({ sessionId, planId, authToken }) {
  const response = await fetch(getBackendUrl("/api/billing/create-checkout-session"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      sessionId,
      planId,
    }),
  });

  return parseResponse(response);
}

export async function createPortalSession({ sessionId, authToken }) {
  const response = await fetch(getBackendUrl("/api/billing/create-portal-session"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      sessionId,
    }),
  });

  return parseResponse(response);
}

export async function redirectToCheckout(planId, sessionId, authToken) {
  if (!STRIPE_PUBLISHABLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
  }

  stripePromise ||= loadStripe(STRIPE_PUBLISHABLE_KEY);
  const stripe = await stripePromise;

  if (!stripe) {
    throw new Error("Unable to initialize Stripe.");
  }

  const { sessionId: checkoutSessionId } = await createCheckoutSession({ sessionId, planId, authToken });
  const result = await stripe.redirectToCheckout({ sessionId: checkoutSessionId });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function syncCheckoutSession(checkoutSessionId, authToken) {
  const response = await fetch(getBackendUrl("/api/billing/sync-checkout-session"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ checkoutSessionId }),
  });

  return parseResponse(response);
}

export async function changePlan(planId, authToken) {
  const response = await fetch(getBackendUrl("/api/billing/change-plan"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ planId }),
  });

  return parseResponse(response);
}
