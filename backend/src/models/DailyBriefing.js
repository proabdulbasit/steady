const mongoose = require("mongoose");

const BriefingSectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
  },
  { _id: false }
);

const DailyBriefingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true, index: true }, // YYYY-MM-DD UTC
    headline: { type: String, default: "" },
    sections: { type: [BriefingSectionSchema], default: [] },
    plainText: { type: String, default: "" },
    model: { type: String, default: "" },
    dataWindowDays: { type: Number, default: 30 },
    insightsCount: { type: Number, default: 0 },
    status: { type: String, enum: ["ok", "error"], default: "ok" },
    error: { type: String, default: "" },
    generatedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

DailyBriefingSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

module.exports =
  mongoose.models.DailyBriefing || mongoose.model("DailyBriefing", DailyBriefingSchema);
