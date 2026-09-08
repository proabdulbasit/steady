const crypto = require("node:crypto");
const path = require("node:path");
const dotenv = require("dotenv");
const { getSiteBaseUrl } = require("./constants");
const { normalizeText } = require("./duplicate");
const { buildBlogSchema } = require("./schema");
const { markdownWordCount } = require("./quality");

function loadBackendEnv() {
  const backendRoot = path.resolve(__dirname, "..", "..", "..");
  const repositoryRoot = path.resolve(backendRoot, "..");
  for (const file of [
    path.join(backendRoot, ".env"),
    path.join(backendRoot, ".env.local"),
    path.join(repositoryRoot, ".env"),
    path.join(repositoryRoot, ".env.local"),
  ]) {
    dotenv.config({ path: file });
  }
}

function isDryRun() {
  return /^(1|true|yes)$/i.test(process.env.DRY_RUN || "");
}

function clampContentCount(value = process.env.CONTENT_COUNT) {
  const parsed = Number.parseInt(value || "3", 10);
  return Math.min(3, Math.max(1, Number.isFinite(parsed) ? parsed : 3));
}

function contentHash(content) {
  return crypto.createHash("sha256").update(normalizeText(content)).digest("hex");
}

function calculateReadingTime(content) {
  return Math.max(1, Math.ceil(markdownWordCount(content) / 220));
}

function safeStringArray(value, limit = 20) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item).trim()).filter(Boolean))]
    .slice(0, limit);
}

function normalizeReferences(value) {
  return (Array.isArray(value) ? value : [])
    .filter((source) => source?.title && /^https:\/\//i.test(source?.url || ""))
    .map((source) => ({
      title: String(source.title).trim(),
      url: String(source.url).trim(),
      publisher: String(source.publisher || "").trim(),
      accessedAt: new Date(),
    }))
    .filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index)
    .slice(0, 12);
}

function normalizeGeneratedPost(generated, opportunity, options = {}) {
  const baseUrl = options.baseUrl || getSiteBaseUrl();
  const slug = options.slug;
  const now = options.now || new Date();
  const post = {
    title: String(generated.title || opportunity.titleSuggestion || opportunity.keyword).trim(),
    slug,
    excerpt: String(generated.excerpt || "").trim(),
    content: String(generated.content || "").trim(),
    featuredImage: options.featuredImage || generated.featuredImage || {},
    primaryKeyword: String(generated.primaryKeyword || opportunity.keyword).trim(),
    secondaryKeywords: safeStringArray(
      generated.secondaryKeywords || opportunity.secondaryKeywords
    ),
    searchIntent: generated.searchIntent || opportunity.searchIntent || "informational",
    category: String(generated.category || opportunity.cluster || "Business Operations").trim(),
    tags: safeStringArray(generated.tags, 10),
    author: {
      name: "WorkSteady Editorial Team",
      url: baseUrl,
      bio: "Practical operations guidance for small-business teams.",
    },
    status: "draft",
    metaTitle: String(generated.metaTitle || generated.title || "").trim(),
    metaDescription: String(generated.metaDescription || generated.excerpt || "").trim(),
    canonicalUrl: `${baseUrl}/${slug}`,
    openGraph: {
      title: String(generated.openGraph?.title || generated.metaTitle || generated.title || "").trim(),
      description: String(
        generated.openGraph?.description || generated.metaDescription || generated.excerpt || ""
      ).trim(),
      image: options.featuredImage?.url || "",
      type: "article",
    },
    publishedAt: options.publishedAt || now,
    updatedAt: now,
    readingTime: calculateReadingTime(generated.content),
    internalLinks: (Array.isArray(generated.internalLinks) ? generated.internalLinks : [])
      .filter((link) => link?.href && link?.anchor)
      .map((link) => ({ href: String(link.href), anchor: String(link.anchor) }))
      .slice(0, 12),
    sourceReferences: normalizeReferences(generated.sourceReferences),
    normalizedKeyword: normalizeText(generated.primaryKeyword || opportunity.keyword),
    contentHash: contentHash(generated.content),
    featured: Boolean(generated.featured),
    createdBy: "automation",
  };
  post.schema = buildBlogSchema({
    ...post,
    wordCount: markdownWordCount(post.content),
  }, { baseUrl });
  return post;
}

async function claimOpportunities(KeywordOpportunity, count, lockId, options = {}) {
  if (options.dryRun) {
    return KeywordOpportunity.find({ status: "approved" })
      .sort({ businessRelevance: -1, createdAt: 1 })
      .limit(count)
      .lean();
  }
  const claimed = [];
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + (options.lockMinutes || 45) * 60000);
  for (let index = 0; index < count; index += 1) {
    const item = await KeywordOpportunity.findOneAndUpdate(
      {
        $or: [
          { status: "approved" },
          { status: "processing", lockExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: { status: "processing", lockId, lockedAt: now, lockExpiresAt },
        $inc: { generationAttempts: 1 },
      },
      {
        new: true,
        sort: { businessRelevance: -1, createdAt: 1 },
      }
    ).lean();
    if (!item) break;
    claimed.push(item);
  }
  return claimed;
}

function buildGenerationPrompt(opportunity, research, existingPosts) {
  const internalTargets = [
    {
      title: "WorkSteady small-business AI guidance",
      href: "/",
      excerpt: "Straight-talking guidance and a clear next move for small-business owners.",
    },
    {
      title: "WorkSteady pricing",
      href: "/pricing",
      excerpt: "Plans for owners who need practical business support.",
    },
    {
      title: "Ask WorkSteady",
      href: "/chat",
      excerpt: "Ask a specific business question and get a practical next move.",
    },
    ...existingPosts.map((post) => ({
      title: post.title,
      href: `/${post.slug}`,
      excerpt: post.excerpt,
    })),
  ];
  return `Create a publication-ready WorkSteady article as strict JSON.

Opportunity:
${JSON.stringify(opportunity)}

Current cited research:
${research}

Allowed internal pages and relevant posts:
${JSON.stringify(internalTargets)}

Return an object with title, excerpt, content (Markdown), primaryKeyword,
secondaryKeywords, searchIntent, category, tags, metaTitle, metaDescription,
openGraph, internalLinks [{href,anchor}], sourceReferences
[{title,url,publisher}], imagePrompt, imageAlt, and featured.

Requirements: at least 1,200 useful words; no Markdown H1; descriptive H2/H3
structure; factual claims linked to HTTPS source references; no fabricated
statistics, customer stories, search volumes, or product capabilities; 2-5
contextual internal links; concrete advice for small-business operators.
The image prompt must be editorial, photorealistic, brand-safe, contain no text
or logos, and be specific to this article.`;
}

async function runEditorialCritic(groq, post) {
  const response = await groq.json(
    [
      {
        role: "system",
        content:
          'You are a strict editorial risk reviewer. Return JSON only as {"pass":boolean,"score":number,"concerns":string[],"summary":string}. Reject unsupported claims, invented facts, weak source support, unsafe advice, plagiarism-like repetition, and misleading WorkSteady product claims.',
      },
      {
        role: "user",
        content: JSON.stringify({
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          sources: post.sourceReferences,
        }),
      },
    ],
    { temperature: 0, maxTokens: 1800 }
  );
  const data = response.data || {};
  return {
    pass: data.pass === true,
    score: Math.max(0, Math.min(100, Number(data.score) || 0)),
    concerns: safeStringArray(data.concerns, 20),
    summary: String(data.summary || ""),
    model: response.model,
  };
}

module.exports = {
  buildGenerationPrompt,
  calculateReadingTime,
  claimOpportunities,
  clampContentCount,
  contentHash,
  isDryRun,
  loadBackendEnv,
  normalizeGeneratedPost,
  normalizeReferences,
  runEditorialCritic,
  safeStringArray,
};
