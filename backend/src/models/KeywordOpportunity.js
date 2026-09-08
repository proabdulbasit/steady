const mongoose = require("mongoose");

const keywordOpportunitySchema = new mongoose.Schema(
  {
    keyword: { type: String, required: true, trim: true },
    normalizedKeyword: { type: String, required: true, lowercase: true, trim: true },
    titleSuggestion: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["new", "update", "consolidate"],
      default: "new",
      index: true,
    },
    searchIntent: {
      type: String,
      enum: ["informational", "commercial", "transactional", "navigational"],
      default: "informational",
    },
    cluster: { type: String, required: true, trim: true, index: true },
    secondaryKeywords: { type: [String], default: [] },
    questions: { type: [String], default: [] },
    rationale: { type: String, required: true },
    businessRelevance: { type: Number, required: true, min: 0, max: 100 },
    evidence: {
      type: [
        {
          title: { type: String, required: true },
          url: { type: String, required: true },
          publisher: { type: String, default: "" },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: [
        "approved",
        "processing",
        "published",
        "needs_review",
        "rejected",
      ],
      default: "approved",
      index: true,
    },
    existingPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogPost",
      default: null,
      index: true,
    },
    mergePostIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "BlogPost" }],
      default: [],
    },
    lockId: { type: String, default: "" },
    lockedAt: { type: Date, default: null },
    lockExpiresAt: { type: Date, default: null, index: true },
    generationAttempts: { type: Number, min: 0, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    publishedPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogPost",
      default: null,
    },
    researchRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogAutomationRun",
      default: null,
    },
  },
  { timestamps: true }
);

keywordOpportunitySchema.index(
  { normalizedKeyword: 1, type: 1, existingPostId: 1 },
  { unique: true }
);
keywordOpportunitySchema.index({
  status: 1,
  businessRelevance: -1,
  createdAt: 1,
});

module.exports =
  mongoose.models.KeywordOpportunity ||
  mongoose.model("KeywordOpportunity", keywordOpportunitySchema);
