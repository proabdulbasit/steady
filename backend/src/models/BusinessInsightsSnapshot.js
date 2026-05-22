const mongoose = require("mongoose");

const InsightMetricSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" },
    value: { type: String, default: "" },
    hint: { type: String, default: "" },
  },
  { _id: false }
);

const InsightHighlightSchema = new mongoose.Schema(
  {
    tone: { type: String, enum: ["positive", "negative", "neutral", "info"], default: "neutral" },
    text: { type: String, default: "" },
  },
  { _id: false }
);

const InsightPillarSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["ready", "no_data", "limited"], default: "no_data" },
    headline: { type: String, default: "" },
    summary: { type: String, default: "" },
    metrics: { type: [InsightMetricSchema], default: [] },
    highlights: { type: [InsightHighlightSchema], default: [] },
  },
  { _id: false }
);

const BusinessInsightsSnapshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    revenue: { type: InsightPillarSchema, default: () => ({}) },
    costs: { type: InsightPillarSchema, default: () => ({}) },
    staffing: { type: InsightPillarSchema, default: () => ({}) },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

BusinessInsightsSnapshotSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

module.exports =
  mongoose.models.BusinessInsightsSnapshot ||
  mongoose.model("BusinessInsightsSnapshot", BusinessInsightsSnapshotSchema);
