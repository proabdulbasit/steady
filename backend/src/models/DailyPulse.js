const mongoose = require("mongoose");

const DailyPulseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Local calendar day YYYY-MM-DD (owner's day, sent from client). */
    dateKey: { type: String, required: true, index: true },
    /** 0 = Sunday … 6 = Saturday */
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    level: {
      type: String,
      enum: ["busy", "normal", "slow"],
      required: true,
      index: true,
    },
    /** Pattern flag shown after this tap (if any). */
    patternKey: { type: String, default: "", index: true },
    patternMessage: { type: String, default: "" },
    patternDismissedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DailyPulseSchema.index({ userId: 1, dateKey: 1 }, { unique: true });
DailyPulseSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.DailyPulse || mongoose.model("DailyPulse", DailyPulseSchema);
