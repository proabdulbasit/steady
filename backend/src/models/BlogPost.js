const mongoose = require("mongoose");

const imageVariantSchema = new mongoose.Schema(
  {
    aspectRatio: { type: String, enum: ["16:9", "4:3", "1:1"], required: true },
    url: { type: String, required: true },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
  },
  { _id: false }
);

const featuredImageSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    alt: { type: String, default: "" },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    provider: { type: String, default: "" },
    sourceId: { type: String, default: "" },
    variants: { type: [imageVariantSchema], default: [] },
    prompt: { type: String, default: "", select: false },
  },
  { _id: false }
);

const authorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, default: "WorkSteady Editorial Team" },
    url: { type: String, default: "" },
    bio: { type: String, default: "" },
  },
  { _id: false }
);

const sourceReferenceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    publisher: { type: String, default: "" },
    accessedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const validationReportSchema = new mongoose.Schema(
  {
    hardPass: { type: Boolean, default: false },
    score: { type: Number, min: 0, max: 100, default: 0 },
    errors: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    checks: { type: mongoose.Schema.Types.Mixed, default: {} },
    editorial: { type: mongoose.Schema.Types.Mixed, default: {} },
    validatedAt: { type: Date, default: null },
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    featuredImage: { type: featuredImageSchema, default: () => ({}) },
    primaryKeyword: { type: String, required: true, trim: true },
    secondaryKeywords: { type: [String], default: [] },
    searchIntent: {
      type: String,
      enum: ["informational", "commercial", "transactional", "navigational"],
      default: "informational",
    },
    category: { type: String, required: true, trim: true, index: true },
    tags: { type: [String], default: [] },
    author: { type: authorSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["draft", "needs_review", "published", "archived"],
      default: "draft",
      index: true,
    },
    metaTitle: { type: String, required: true, trim: true },
    metaDescription: { type: String, required: true, trim: true },
    canonicalUrl: { type: String, required: true, trim: true },
    openGraph: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      image: { type: String, default: "" },
      type: { type: String, default: "article" },
    },
    publishedAt: { type: Date, default: null, index: true },
    readingTime: { type: Number, min: 1, default: 1 },
    schema: { type: mongoose.Schema.Types.Mixed, default: {} },
    internalLinks: {
      type: [
        {
          href: { type: String, required: true },
          anchor: { type: String, required: true },
        },
      ],
      default: [],
    },
    relatedPosts: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "BlogPost" }],
      default: [],
    },
    sourceReferences: { type: [sourceReferenceSchema], default: [], select: false },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KeywordOpportunity",
      default: null,
      select: false,
    },
    createdBy: {
      type: String,
      enum: ["automation", "editor", "migration"],
      default: "automation",
      select: false,
    },
    qualityScore: { type: Number, min: 0, max: 100, default: 0 },
    validationReport: { type: validationReportSchema, default: () => ({}), select: false },
    previousSlugs: { type: [String], default: [], select: false },
    normalizedKeyword: { type: String, required: true, lowercase: true, trim: true, select: false },
    contentHash: { type: String, required: true, select: false },
    featured: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

blogPostSchema.index({ status: 1, publishedAt: -1, _id: -1 });
blogPostSchema.index({ normalizedKeyword: 1 });
blogPostSchema.index({ contentHash: 1 }, { unique: true });
blogPostSchema.index(
  { opportunityId: 1 },
  { unique: true, partialFilterExpression: { opportunityId: { $type: "objectId" } } }
);
blogPostSchema.index({ title: "text", excerpt: "text", content: "text" });
blogPostSchema.index(
  { previousSlugs: 1 },
  { partialFilterExpression: { "previousSlugs.0": { $exists: true } } }
);

module.exports =
  mongoose.models.BlogPost || mongoose.model("BlogPost", blogPostSchema);
