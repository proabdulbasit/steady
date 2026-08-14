const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: {
      type: [
        {
          kind: { type: String, enum: ["image", "file", "csv", "pdf"], required: true },
          name: { type: String, required: true },
          type: { type: String, default: "" },
          size: { type: Number, default: 0 },
          // For images we store base64 so chat reload can render + re-send.
          mediaType: { type: String, default: "" },
          base64: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "", trim: true },
    pinned: { type: Boolean, default: false, index: true },
    pinnedAt: { type: Date, default: null },
    messages: { type: [MessageSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);

