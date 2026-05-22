const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, default: "daily_briefing", index: true },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    url: { type: String, default: "/profile" },
    readAt: { type: Date, default: null, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
