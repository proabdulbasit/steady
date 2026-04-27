const express = require("express");
const User = require("../models/User");
const { getStripe } = require("../lib/stripe");
const { getPlanByPriceId, PLAN_IDS } = require("../config/plans");
const { ensureBusinessIntegrationSlots } = require("../lib/user-service");

const router = express.Router();

async function syncSubscription(subscription, fallbackUserId = "") {
  const stripe = getStripe();
  const detailedSubscription =
    subscription.items?.data?.[0]?.price?.id
      ? subscription
      : await stripe.subscriptions.retrieve(subscription.id, {
          expand: ["items.data.price"],
        });

  const priceId = detailedSubscription.items.data[0]?.price?.id || "";
  const fallbackPlanId = detailedSubscription.metadata?.planId || "";
  const plan = getPlanByPriceId(priceId) || (fallbackPlanId ? { id: fallbackPlanId } : null);
  const stripeCustomerId = typeof detailedSubscription.customer === "string"
    ? detailedSubscription.customer
    : detailedSubscription.customer?.id;

  let user = null;
  if (stripeCustomerId) {
    user = await User.findOne({ stripeCustomerId });
  }

  if (!user && fallbackUserId) {
    user = await User.findById(fallbackUserId);
  }

  if (!user) return;

  // When we create Stripe subscriptions via Checkout we attach `planId` to subscription metadata.
  // If the price id isn't mapped (e.g. price_data fallback), don't downgrade the user to Free.
  const nextPlanId = plan?.id || fallbackPlanId || user.planId || PLAN_IDS.FREE;
  user.planId = nextPlanId;
  user.subscriptionStatus = detailedSubscription.status || "inactive";
  user.stripeCustomerId = stripeCustomerId || user.stripeCustomerId;
  user.stripeSubscriptionId = detailedSubscription.id;
  user.currentPeriodEnd = detailedSubscription.current_period_end
    ? new Date(detailedSubscription.current_period_end * 1000)
    : null;

  ensureBusinessIntegrationSlots(user);
  await user.save();
}

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).send("Missing Stripe webhook configuration.");
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId || "";
        const user = userId ? await User.findById(userId) : null;

        if (user) {
          user.email = session.customer_details?.email || user.email;
          user.stripeCustomerId = session.customer || user.stripeCustomerId;
          user.lastCheckoutSessionId = session.id;
          user.planId = session.metadata?.planId || user.planId;
          user.subscriptionStatus = "active";
          if (session.metadata?.sessionId && !user.sessionIds.includes(session.metadata.sessionId)) {
            user.sessionIds.push(session.metadata.sessionId);
          }
          await user.save();
        }

        if (session.subscription) {
          await syncSubscription({ id: session.subscription }, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      default:
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
