const mongoose = require("mongoose");

const InsightSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, default: "", index: true }, // square|quickbooks|mixed
    type: { type: String, required: true, index: true },
    severity: { type: String, default: "info", index: true }, // info|warn|critical
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    dateKey: { type: String, default: "", index: true }, // YYYY-MM-DD anchor
  },
  { timestamps: true }
);

InsightSchema.index({ userId: 1, type: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.models.Insight || mongoose.model("Insight", InsightSchema);

