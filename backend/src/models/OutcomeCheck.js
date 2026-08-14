const mongoose = require("mongoose");

const OutcomeCheckSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    source: {
      type: String,
      enum: ["chat", "tool_action", "tool_audit", "tool_savings", "document_upload"],
      default: "chat",
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      index: true,
    },
    adviceExcerpt: { type: String, default: "", trim: true },
    userPromptExcerpt: { type: String, default: "", trim: true },
    dueAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "worked", "partially", "didnt_work", "didnt_try", "dismissed"],
      default: "pending",
      index: true,
    },
    respondedAt: { type: Date, default: null },
    note: { type: String, default: "", trim: true },
    followUpEmailSentAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

OutcomeCheckSchema.index({ userId: 1, status: 1, dueAt: 1 });
OutcomeCheckSchema.index({ userId: 1, conversationId: 1, status: 1 });

module.exports = mongoose.models.OutcomeCheck || mongoose.model("OutcomeCheck", OutcomeCheckSchema);
