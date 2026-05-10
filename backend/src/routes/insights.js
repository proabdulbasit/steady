const express = require("express");
const { requireAuth } = require("../middleware/auth");
const Insight = require("../models/Insight");
const { deriveInsightsForUser } = require("../lib/insights");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const items = await Insight.find({ userId }).sort({ createdAt: -1 }).limit(25).lean();
  return res.json({ ok: true, insights: items });
});

router.post("/refresh", requireAuth, async (req, res) => {
  const userId = req.auth.sub;
  const result = await deriveInsightsForUser(userId);
  return res.json({ ok: true, result });
});

module.exports = router;

