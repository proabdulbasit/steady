const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { getUserById, serializeUser } = require("../lib/user-service");
const User = require("../models/User");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  return res.json({ profile: serializeUser(user) });
});

router.patch("/me", requireAuth, async (req, res) => {
  const { name = "" } = req.body || {};
  const user = await getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  user.name = name.trim();
  await user.save();

  return res.json({ profile: serializeUser(user) });
});

router.get("/admin/users", requireAdmin, async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(100);
  return res.json({
    users: users.map((user) => serializeUser(user)),
  });
});

module.exports = router;
