const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { getUserById, serializeUser } = require("../lib/user-service");
const User = require("../models/User");
const Conversation = require("../models/Conversation");

const router = express.Router();

const { ALLOWED_INDUSTRIES } = require("../lib/industries");

router.get("/me", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  return res.json({ profile: serializeUser(user) });
});

router.patch("/me", requireAuth, async (req, res) => {
  const { name = "", industry = "", briefingDelivery } = req.body || {};
  const user = await getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  user.name = name.trim();
  if (industry && ALLOWED_INDUSTRIES.has(industry)) {
    user.industry = industry;
  }
  if (briefingDelivery && typeof briefingDelivery === "object") {
    user.briefingDelivery = user.briefingDelivery || {};
    if (typeof briefingDelivery.emailEnabled === "boolean") {
      user.briefingDelivery.emailEnabled = briefingDelivery.emailEnabled;
    }
    if (typeof briefingDelivery.pushEnabled === "boolean") {
      user.briefingDelivery.pushEnabled = briefingDelivery.pushEnabled;
    }
  }
  await user.save();

  return res.json({ profile: serializeUser(user) });
});

router.delete("/me", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const user = await getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  await Conversation.deleteMany({ userId });
  await User.deleteOne({ _id: userId });

  return res.json({ ok: true });
});

router.get("/admin/users", requireAdmin, async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(100);
  return res.json({
    users: users.map((user) => serializeUser(user)),
  });
});

module.exports = router;
