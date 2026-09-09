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

const FALLBACK_SOURCES = [
  {
    title: "U.S. Small Business Administration",
    url: "https://www.sba.gov/",
    publisher: "SBA",
  },
  {
    title: "Internal Revenue Service",
    url: "https://www.irs.gov/",
    publisher: "IRS",
  },
  {
    title: "U.S. Bureau of Labor Statistics",
    url: "https://www.bls.gov/",
    publisher: "BLS",
  },
];

function maxGenerationAttempts() {
  const parsed = Number.parseInt(process.env.BLOG_MAX_GENERATION_ATTEMPTS || "5", 10);
  return Math.min(8, Math.max(1, Number.isFinite(parsed) ? parsed : 5));
}

function ensureSourceCitations(content, sources) {
  const markdown = String(content || "").trim();
  const usable = (Array.isArray(sources) ? sources : []).filter((source) => source?.url);
  if (!usable.length) return markdown;
  const missing = usable.filter((source) => !markdown.includes(source.url));
  if (missing.length === 0) return markdown;
  const lines = usable.slice(0, 4).map(
    (source) => `- [${source.title || source.publisher || source.url}](${source.url})`
  );
  return `${markdown}

## Sources and further reading

Use these primary references when checking the guidance above:

${lines.join("\n")}`;
}

function normalizeEditorialScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (numeric <= 10) return Math.round(numeric * 10);
  return Math.max(0, Math.min(100, Math.round(numeric)));
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
    return KeywordOpportunity.find({
      status: { $in: ["approved", "needs_review"] },
      generationAttempts: { $lt: maxGenerationAttempts() },
    })
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
          {
            status: "needs_review",
            generationAttempts: { $lt: maxGenerationAttempts() },
          },
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

function buildGenerationPrompt(opportunity, research, existingPosts, verifiedSources = []) {
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

Verified external sources:
${JSON.stringify(verifiedSources)}

Allowed internal pages and relevant posts:
${JSON.stringify(internalTargets)}

Return an object with title, excerpt, content (Markdown), primaryKeyword,
secondaryKeywords, searchIntent, category, tags, metaTitle, metaDescription,
openGraph, internalLinks [{href,anchor}], sourceReferences
[{title,url,publisher}], imagePrompt, imageAlt, and featured.

Requirements: 1,400-1,800 useful words; no Markdown H1; descriptive H2/H3
structure; cite at least two verified external sources inside the Markdown
using normal [descriptive anchor](exact URL) links. Use only URLs listed under
"Verified external sources" for external links and sourceReferences; never
invent, alter, or guess a URL. Do not use citation-marker syntax such as
bracketed line-number markers. Include no fabricated statistics, customer stories, search volumes,
or product capabilities; add 2-5 contextual links selected exactly from
"Allowed internal pages and relevant posts"; provide concrete advice for
small-business operators.
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
    score: normalizeEditorialScore(data.score),
    concerns: safeStringArray(data.concerns, 20),
    summary: String(data.summary || ""),
    model: response.model,
  };
}

module.exports = {
  FALLBACK_SOURCES,
  buildGenerationPrompt,
  calculateReadingTime,
  claimOpportunities,
  clampContentCount,
  contentHash,
  ensureSourceCitations,
  isDryRun,
  loadBackendEnv,
  maxGenerationAttempts,
  normalizeEditorialScore,
  normalizeGeneratedPost,
  normalizeReferences,
  runEditorialCritic,
  safeStringArray,
};
