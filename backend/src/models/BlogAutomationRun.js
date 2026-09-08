const mongoose = require("mongoose");

const automationRunSchema = new mongoose.Schema(
  {
    runType: { type: String, enum: ["daily", "weekly"], required: true, index: true },
    status: {
      type: String,
      enum: ["running", "succeeded", "partial", "failed", "dry_run"],
      default: "running",
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    dryRun: { type: Boolean, default: false },
    counts: {
      researched: { type: Number, default: 0 },
      claimed: { type: Number, default: 0 },
      generated: { type: Number, default: 0 },
      published: { type: Number, default: 0 },
      needsReview: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    errors: {
      type: [
        {
          stage: { type: String, required: true },
          opportunityId: { type: mongoose.Schema.Types.ObjectId, default: null },
          message: { type: String, required: true },
          systemic: { type: Boolean, default: false },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

automationRunSchema.index({ runType: 1, startedAt: -1 });

module.exports =
  mongoose.models.BlogAutomationRun ||
  mongoose.model("BlogAutomationRun", automationRunSchema);
