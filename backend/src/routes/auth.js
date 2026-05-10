const express = require("express");
const User = require("../models/User");
const { comparePassword, hashPassword, signUserToken } = require("../lib/auth");
const { sendPasswordResetEmail } = require("../lib/mail");
const {
  generateRawResetToken,
  getExpiryMs,
  hashResetToken,
  timingSafeEqualHexHex,
} = require("../lib/reset-token");
const { attachSessionToUser, ensureBusinessIntegrationSlots, getUserByEmail, getUserById, serializeUser } = require("../lib/user-service");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const RESET_SENT_MESSAGE =
  "If an account exists for that email address, check your inbox for a reset link.";

const ALLOWED_INDUSTRIES = new Set([
  "restaurant",
  "pawnshop",
  "auto_shop",
  "retail",
  "salon",
  "cleaning",
  "contractor",
  "food_truck",
  "landscaping",
  "gym",
  "other",
]);

function normalizeIndustry(value) {
  return ALLOWED_INDUSTRIES.has(value) ? value : "restaurant";
}

router.post("/register", async (req, res) => {
  const { name = "", email = "", password = "", sessionId = "", industry = "restaurant" } = req.body || {};
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
    industry: normalizeIndustry(industry),
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

function getFrontendOrigin() {
  const raw = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "";
  return typeof raw === "string" ? raw.replace(/\/$/, "") : "";
}

router.post("/forgot-password", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";

  try {
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const frontend = getFrontendOrigin();
    if (!frontend) {
      console.error("[auth] FRONTEND_URL (or APP_PUBLIC_URL) is not set.");
      return res.status(503).json({
        error:
          "Password reset is not configured yet. Ask your administrator to set FRONTEND_URL and outbound email (Mailgun or SMTP).",
      });
    }

    const user = await getUserByEmail(email);

    // Same response whether or not user exists — avoid account enumeration.
    if (!user) {
      return res.json({ ok: true, message: RESET_SENT_MESSAGE });
    }

    const rawToken = generateRawResetToken();
    user.passwordResetTokenHash = hashResetToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + getExpiryMs());
    await user.save();

    const qp = new URLSearchParams({
      token: rawToken,
      email: user.email,
    });
    const resetUrl = `${frontend}/reset-password?${qp.toString()}`;

    try {
      const sent = await sendPasswordResetEmail({ to: user.email, resetUrl });
      if (!sent) {
        console.error(
          "[auth] Password reset email was not sent. Check Mailgun (domain, API region, MAILGUN_FROM) or SMTP. See Mailgun → Sending → Logs.",
        );
      }
    } catch (mailError) {
      console.error("[auth] Forgot-password email failed:", mailError);
    }

    return res.json({ ok: true, message: RESET_SENT_MESSAGE });
  } catch (err) {
    console.error("[auth] forgot-password", err);
    return res.status(500).json({ error: "Could not process that request." });
  }
});

router.post("/reset-password", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const rawToken = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";

  if (!email || !rawToken || !password) {
    return res.status(400).json({ error: "Email, reset token, and new password are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const user = await getUserByEmail(email);
  if (!user || !user.passwordResetTokenHash || !user.passwordResetExpires) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }

  if (user.passwordResetExpires < new Date()) {
    user.passwordResetTokenHash = "";
    user.passwordResetExpires = null;
    await user.save();
    return res.status(400).json({ error: "This reset link has expired. Request a new one." });
  }

  const incomingHash = hashResetToken(rawToken);
  if (!timingSafeEqualHexHex(incomingHash, user.passwordResetTokenHash)) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }

  user.passwordHash = await hashPassword(password);
  user.passwordResetTokenHash = "";
  user.passwordResetExpires = null;
  await attachSessionToUser(user, sessionId);
  ensureBusinessIntegrationSlots(user);
  await user.save();

  return res.json({
    token: signUserToken(user),
    user: serializeUser(user),
  });
});

router.patch("/password", requireAuth, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  const user = await getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const ok = await comparePassword(currentPassword, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  user.passwordHash = await hashPassword(newPassword);
  ensureBusinessIntegrationSlots(user);
  await user.save();

  return res.json({ ok: true });
});

module.exports = router;
