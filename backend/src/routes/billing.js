const express = require("express");
const { optionalAuth, requireAuth } = require("../middleware/auth");
const { getPlanConfig, PLAN_IDS } = require("../config/plans");
const { getStripe } = require("../lib/stripe");
const { attachSessionToUser, getUserById, resolveActor, serializeUser } = require("../lib/user-service");

const router = express.Router();
const PLAN_PRICES = {
  [PLAN_IDS.PRO]: {
    unitAmount: 2000,
    productName: "Steady Pro",
  },
  [PLAN_IDS.BUSINESS]: {
    unitAmount: 6900,
    productName: "Steady Business",
  },
};

router.get("/status/:sessionId", optionalAuth, async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId." });
  }

  const actor = await resolveActor({
    userId: req.auth?.sub,
    sessionId,
  });

  if (actor.kind === "user") {
    return res.json(serializeUser(actor.user));
  }

  return res.json({
    sessionId,
    planId: PLAN_IDS.FREE,
    planName: "Free",
    subscriptionStatus: "inactive",
    currentPeriodEnd: null,
    questionsUsed: 0,
    questionsRemaining: 5,
    dailyQuestionLimit: 5,
    features: {
      premiumTools: false,
      dataIntegrations: false,
      prioritySupport: false,
    },
    hasActiveSubscription: false,
    role: "guest",
    name: "Guest",
    email: "",
    integrations: [],
  });
});

router.post("/create-checkout-session", optionalAuth, async (req, res) => {
  const { sessionId, planId } = req.body || {};
  if (!sessionId || !planId) {
    return res.status(400).json({ error: "sessionId and planId are required." });
  }

  if (planId === PLAN_IDS.FREE) {
    return res.status(400).json({ error: "Free plan does not require checkout." });
  }

  const plan = getPlanConfig(planId);
  const actor = await resolveActor({
    userId: req.auth?.sub,
    sessionId,
  });

  if (actor.kind !== "user") {
    return res.status(401).json({ error: "Please sign in before purchasing a subscription." });
  }

  const user = actor.user;
  await attachSessionToUser(user, sessionId);
  const stripe = getStripe();
  const fallbackPrice = PLAN_PRICES[planId];

  if (!plan.priceId && !fallbackPrice) {
    return res.status(500).json({ error: `Unsupported plan: ${planId}.` });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: user.stripeCustomerId || undefined,
    customer_email: user.email || undefined,
    line_items: [
      plan.priceId
        ? {
            price: plan.priceId,
            quantity: 1,
          }
        : {
            price_data: {
              currency: "usd",
              recurring: {
                interval: "month",
              },
              unit_amount: fallbackPrice.unitAmount,
              product_data: {
                name: fallbackPrice.productName,
              },
            },
            quantity: 1,
          },
    ],
    subscription_data: {
      metadata: {
        sessionId,
        planId,
        userId: user._id.toString(),
      },
    },
    success_url: `${process.env.FRONTEND_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/?checkout=cancelled`,
    allow_promotion_codes: true,
    client_reference_id: user._id.toString(),
    metadata: {
      sessionId,
      planId,
      userId: user._id.toString(),
    },
  });

  user.lastCheckoutSessionId = checkoutSession.id;
  await user.save();

  return res.json({ sessionId: checkoutSession.id });
});

router.post("/sync-checkout-session", requireAuth, async (req, res) => {
  const { checkoutSessionId } = req.body || {};
  if (!checkoutSessionId) {
    return res.status(400).json({ error: "checkoutSessionId is required." });
  }

  const user = await getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription", "customer"],
  });

  if (!session) {
    return res.status(404).json({ error: "Checkout session not found." });
  }

  const planIdFromSession = session.metadata?.planId || "";
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id || "";

  if (!subscriptionId) {
    return res.status(400).json({ error: "Checkout session does not include a subscription." });
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  // Ensure subscription metadata carries planId so webhook sync works even with fallback `price_data`.
  if (planIdFromSession && (!subscription.metadata || subscription.metadata.planId !== planIdFromSession)) {
    await stripe.subscriptions.update(subscriptionId, {
      metadata: {
        ...(subscription.metadata || {}),
        planId: planIdFromSession,
        userId: user._id.toString(),
      },
    });
  }

  const stripeCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || "";

  user.planId = planIdFromSession || user.planId;
  user.planSelected = true;
  user.subscriptionStatus = subscription.status || user.subscriptionStatus || "inactive";
  user.stripeCustomerId = stripeCustomerId || user.stripeCustomerId;
  user.stripeSubscriptionId = subscription.id;
  user.currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
  user.lastCheckoutSessionId = checkoutSessionId;
  await user.save();

  return res.json({ profile: serializeUser(user) });
});

router.post("/change-plan", requireAuth, async (req, res) => {
  const { planId } = req.body || {};
  if (!planId) {
    return res.status(400).json({ error: "planId is required." });
  }

  if (planId === PLAN_IDS.FREE) {
    const user = await getUserById(req.auth.sub);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.stripeSubscriptionId) {
      return res.status(400).json({ error: "Use the billing portal to cancel or downgrade to Free." });
    }

    user.planId = PLAN_IDS.FREE;
    user.planSelected = true;
    user.subscriptionStatus = "inactive";
    user.currentPeriodEnd = null;
    await user.save();

    return res.json({ profile: serializeUser(user) });
  }

  const plan = getPlanConfig(planId);
  if (!plan?.priceId) {
    return res.status(500).json({ error: "Missing Stripe price id for this plan. Set STRIPE_PRO_PRICE_ID / STRIPE_BUSINESS_PRICE_ID in backend env." });
  }

  const user = await getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  if (!user.stripeSubscriptionId) {
    return res.status(400).json({ error: "No active subscription found for this account." });
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
    expand: ["items.data.price"],
  });

  const itemId = subscription.items?.data?.[0]?.id;
  if (!itemId) {
    return res.status(500).json({ error: "Subscription is missing line items." });
  }

  const updated = await stripe.subscriptions.update(subscription.id, {
    proration_behavior: "create_prorations",
    items: [
      {
        id: itemId,
        price: plan.priceId,
      },
    ],
    metadata: {
      ...(subscription.metadata || {}),
      planId,
      userId: user._id.toString(),
    },
  });

  user.planId = planId;
  user.planSelected = true;
  user.subscriptionStatus = updated.status || user.subscriptionStatus || "inactive";
  user.currentPeriodEnd = updated.current_period_end ? new Date(updated.current_period_end * 1000) : user.currentPeriodEnd;
  await user.save();

  return res.json({ profile: serializeUser(user) });
});

router.post("/create-portal-session", optionalAuth, async (req, res) => {
  const { sessionId } = req.body || {};
  const actor = await resolveActor({
    userId: req.auth?.sub,
    sessionId,
  });

  if (actor.kind !== "user") {
    return res.status(401).json({ error: "Please sign in first." });
  }

  const user = actor.user;
  if (!user.stripeCustomerId) {
    return res.status(404).json({ error: "No Stripe customer found for this account." });
  }

  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/`,
  });

  return res.json({ url: portalSession.url });
});

module.exports = router;
