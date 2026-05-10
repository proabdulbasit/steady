const mongoose = require("mongoose");

const BusinessMetricDailySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, required: true, index: true }, // square|quickbooks
    date: { type: String, required: true, index: true }, // YYYY-MM-DD (UTC)
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

BusinessMetricDailySchema.index({ userId: 1, provider: 1, date: 1 }, { unique: true });

module.exports =
  mongoose.models.BusinessMetricDaily || mongoose.model("BusinessMetricDaily", BusinessMetricDailySchema);

