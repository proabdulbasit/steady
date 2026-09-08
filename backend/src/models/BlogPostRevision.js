const mongoose = require("mongoose");

const blogPostRevisionSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogPost",
      required: true,
      index: true,
    },
    revisionNumber: { type: Number, required: true, min: 1 },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KeywordOpportunity",
      default: null,
    },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String, required: true },
    createdBy: {
      type: String,
      enum: ["automation", "editor"],
      default: "automation",
    },
  },
  { timestamps: true, updatedAt: false }
);

blogPostRevisionSchema.index(
  { postId: 1, revisionNumber: 1 },
  { unique: true }
);
blogPostRevisionSchema.index(
  { opportunityId: 1, postId: 1 },
  {
    unique: true,
    partialFilterExpression: { opportunityId: { $type: "objectId" } },
  }
);

module.exports =
  mongoose.models.BlogPostRevision ||
  mongoose.model("BlogPostRevision", blogPostRevisionSchema);
