const express = require("express");
const { optionalAuth, requireAuth } = require("../middleware/auth");
const { authorizeQuestion, resolveActor, serializeUser, userHasActiveSubscription } = require("../lib/user-service");

const router = express.Router();

router.get("/status/:sessionId", optionalAuth, async (req, res) => {
  const actor = await resolveActor({
    userId: req.auth?.sub,
    sessionId: req.params.sessionId,
  });

  if (actor.kind === "user") {
    return res.json(serializeUser(actor.user));
  }

  return res.json({
    sessionId: req.params.sessionId,
    planId: "free",
    planName: "Free",
    subscriptionStatus: "inactive",
    currentPeriodEnd: null,
    questionsUsed: 0,
    questionsRemaining: 3,
    dailyQuestionLimit: 3,
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

router.post("/authorize", requireAuth, async (req, res) => {
  const { sessionId, consume } = req.body || {};
  const actor = await resolveActor({
    userId: req.auth?.sub,
    sessionId,
  });
  if (actor.kind !== "user") {
    return res.status(401).json({ error: "Please sign in before chatting." });
  }

  if (actor.user.planSelected === false && !userHasActiveSubscription(actor.user)) {
    return res.status(403).json({ error: "Please choose a plan before chatting." });
  }
  const result = await authorizeQuestion(actor, { consume: Boolean(consume) });

  if (!result.access.allowed) {
    return res.status(403).json({
      error: "Daily question limit reached. Upgrade to continue.",
      ...result.access,
      planId: result.plan.id,
      planName: result.plan.name,
      user: actor.kind === "user" ? serializeUser(actor.user) : null,
    });
  }

  return res.json({
    ...result.access,
    planId: result.plan.id,
    planName: result.plan.name,
    user: actor.kind === "user" ? serializeUser(actor.user) : null,
  });
});

module.exports = router;
