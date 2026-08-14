const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getUserById } = require("../lib/user-service");
const { explainAdviceForTeam } = require("../lib/explain-to-team");
const { getPlanConfig, PLAN_IDS } = require("../config/plans");

const router = express.Router();

/**
 * POST /api/explain-to-team
 * Body: { advice: string }
 * Rewrites Steady advice into plain language for sharing with staff.
 * Does not consume daily chat question quota.
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.auth.sub);
    if (!user) return res.status(404).json({ error: "User not found." });

    const plan = getPlanConfig(user.planId || PLAN_IDS.FREE);
    if (!plan.features?.premiumTools) {
      return res.status(403).json({
        error: "Upgrade to Pro or Business to rewrite advice for your team.",
        planId: plan.id,
      });
    }

    const advice = typeof req.body?.advice === "string" ? req.body.advice : "";
    const result = await explainAdviceForTeam({
      advice,
      ownerName: user.name || "",
      industry: user.industry || "",
    });

    return res.json({
      ok: true,
      explanation: result.explanation,
      model: result.model,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || "Unable to rewrite for your team.",
    });
  }
});

module.exports = router;
