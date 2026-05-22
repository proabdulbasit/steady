const mongoose = require("mongoose");

const ProviderResultSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    status: { type: String, default: "skipped" }, // ok|error|skipped
    message: { type: String, default: "" },
    detail: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const DataProcessingRunSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    trigger: { type: String, enum: ["scheduled", "manual"], default: "manual", index: true },
    status: { type: String, enum: ["running", "success", "partial", "failed"], default: "running", index: true },
    providers: { type: [ProviderResultSchema], default: [] },
    insightsCreated: { type: Number, default: 0 },
    error: { type: String, default: "" },
    startedAt: { type: Date, default: Date.now, index: true },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DataProcessingRunSchema.index({ userId: 1, startedAt: -1 });

module.exports =
  mongoose.models.DataProcessingRun || mongoose.model("DataProcessingRun", DataProcessingRunSchema);
