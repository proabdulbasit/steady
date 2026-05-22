const mongoose = require("mongoose");

const BriefingDeliveryLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    channel: { type: String, enum: ["email", "push", "in_app"], required: true, index: true },
    status: { type: String, enum: ["sent", "skipped", "failed"], default: "sent", index: true },
    error: { type: String, default: "" },
    messageId: { type: String, default: "" },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

BriefingDeliveryLogSchema.index({ userId: 1, dateKey: 1, channel: 1 }, { unique: true });

module.exports =
  mongoose.models.BriefingDeliveryLog ||
  mongoose.model("BriefingDeliveryLog", BriefingDeliveryLogSchema);
