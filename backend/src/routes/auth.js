const express = require("express");
const User = require("../models/User");
const { comparePassword, hashPassword, signUserToken } = require("../lib/auth");
const { attachSessionToUser, ensureBusinessIntegrationSlots, getUserByEmail, getUserById, serializeUser } = require("../lib/user-service");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name = "", email = "", password = "", sessionId = "" } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: await hashPassword(password),
    role:
      process.env.ADMIN_EMAIL &&
      email.toLowerCase().trim() === process.env.ADMIN_EMAIL.toLowerCase().trim()
        ? "admin"
        : "user",
    sessionIds: sessionId ? [sessionId] : [],
    // New accounts must explicitly choose Free/Pro/Business before chat access.
    planSelected: false,
  });

  ensureBusinessIntegrationSlots(user);
  await user.save();

  return res.json({
    token: signUserToken(user),
    user: serializeUser(user),
  });
});

router.post("/login", async (req, res) => {
  const { email = "", password = "", sessionId = "" } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const matches = await comparePassword(password, user.passwordHash);
  if (!matches) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  await attachSessionToUser(user, sessionId);
  ensureBusinessIntegrationSlots(user);
  await user.save();

  return res.json({
    token: signUserToken(user),
    user: serializeUser(user),
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  ensureBusinessIntegrationSlots(user);
  if (user.isModified()) {
    await user.save();
  }

  return res.json({ user: serializeUser(user) });
});

module.exports = router;
