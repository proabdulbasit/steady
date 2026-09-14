const mongoose = require("mongoose");
const {
  FALLBACK_SOURCES,
  isDryRun,
  loadBackendEnv,
  safeStringArray,
} = require("../src/lib/blog/pipeline");

loadBackendEnv();

const { connectToDatabase } = require("../src/lib/db");
const BlogPost = require("../src/models/BlogPost");
const KeywordOpportunity = require("../src/models/KeywordOpportunity");
const BlogAutomationRun = require("../src/models/BlogAutomationRun");
const { GroqClient } = require("../src/lib/blog/groq");
const { duplicateScore, normalizeText } = require("../src/lib/blog/duplicate");

function maxOpportunities() {
  const parsed = Number.parseInt(process.env.MAX_KEYWORD_OPPORTUNITIES || "5", 10);
  return Math.min(5, Math.max(1, Number.isFinite(parsed) ? parsed : 5));
}

function compactResearchContext(posts = [], opportunities = []) {
  return {
    posts: (Array.isArray(posts) ? posts : []).slice(0, 24).map((post) => ({
      slug: post.slug,
      title: post.title,
      keyword: post.primaryKeyword,
    })),
    opportunities: (Array.isArray(opportunities) ? opportunities : [])
      .slice(0, 40)
      .map((item) => ({
        keyword: item.keyword,
        type: item.type,
        status: item.status,
      })),
  };
}

const SEED_TOPICS = [
  {
    keyword: "collecting overdue invoices",
    titleSuggestion: "How small businesses can collect overdue invoices without losing customers",
    cluster: "Cash Flow",
  },
  {
    keyword: "restaurant food cost percentage",
    titleSuggestion: "A practical way to track restaurant food cost without a full-time bookkeeper",
    cluster: "Operations",
  },
  {
    keyword: "hiring your first employee",
    titleSuggestion: "What to do before you hire your first employee",
    cluster: "Staffing",
  },
  {
    keyword: "small business sales tax",
    titleSuggestion: "A simple sales-tax checklist for small-business owners",
    cluster: "Finance",
  },
  {
    keyword: "service business pricing",
    titleSuggestion: "How to price a service business without guessing",
    cluster: "Revenue",
  },
  {
    keyword: "retail inventory shrinkage",
    titleSuggestion: "How small retailers can cut inventory shrinkage this month",
    cluster: "Operations",
  },
  {
    keyword: "customer refund policy",
    titleSuggestion: "Write a refund policy that protects cash and keeps customers",
    cluster: "Customers",
  },
  {
    keyword: "vendor payment terms",
    titleSuggestion: "How to negotiate vendor payment terms when cash is tight",
    cluster: "Cash Flow",
  },
  {
    keyword: "employee handbook essentials",
    titleSuggestion: "The employee handbook pages a small business actually needs",
    cluster: "Staffing",
  },
  {
    keyword: "late payroll tax deposits",
    titleSuggestion: "What to do if payroll tax deposits are running late",
    cluster: "Finance",
  },
];

function pickSeedOpportunities(posts = [], opportunities = [], count = 1) {
  const used = new Set(
    [
      ...posts.map((post) => normalizeText(post.primaryKeyword || post.title)),
      ...opportunities.map((item) => item.normalizedKeyword || normalizeText(item.keyword)),
    ].filter(Boolean)
  );
  return SEED_TOPICS.map((topic) =>
    normalizeOpportunity(
      {
        ...topic,
        type: "new",
        searchIntent: "informational",
        rationale: `Practical next steps on ${topic.keyword} for owners running a real business.`,
        businessRelevance: 86,
        evidence: FALLBACK_SOURCES,
      },
      new Map()
    )
  )
    .filter(Boolean)
    .filter((candidate) => !used.has(candidate.normalizedKeyword))
    .slice(0, Math.max(1, count));
}

function normalizeOpportunity(item, postsBySlug) {
  const type = ["new", "update", "consolidate"].includes(item.type)
    ? item.type
    : "new";
  const existing = type === "new" ? null : postsBySlug.get(item.existingPostSlug);
  if (type !== "new" && !existing) return null;
  const mergePosts =
    type === "consolidate"
      ? safeStringArray(item.consolidatePostSlugs)
          .map((slug) => postsBySlug.get(slug))
          .filter(
            (post, index, all) =>
              post &&
              String(post._id) !== String(existing?._id) &&
              all.findIndex((candidate) => String(candidate?._id) === String(post._id)) ===
                index
          )
      : [];
  if (type === "consolidate" && !mergePosts.length) return null;
  const keyword = String(item.keyword || "").trim();
  const normalizedKeyword = normalizeText(keyword);
  const titleSuggestion = String(item.titleSuggestion || keyword).trim();
  const cluster = String(item.cluster || "Business Operations").trim();
  const rationale = String(
    item.rationale || `Practical guidance on ${keyword} for small-business owners.`
  ).trim();
  const relevance = Number.isFinite(Number(item.businessRelevance))
    ? Math.round(Number(item.businessRelevance))
    : 80;
  if (!keyword || !titleSuggestion || !cluster || !rationale) return null;
  if (!normalizedKeyword) return null;
  if (relevance < 60 || relevance > 100) return null;
  const evidence = (Array.isArray(item.evidence) ? item.evidence : [])
    .filter((source) => source?.title && /^https:\/\//.test(source?.url || ""))
    .map((source) => ({
      title: String(source.title),
      url: String(source.url),
      publisher: String(source.publisher || ""),
    }))
    .slice(0, 2);
  const sourced = evidence.length ? evidence : FALLBACK_SOURCES.slice(0, 2);
  return {
    keyword,
    normalizedKeyword,
    titleSuggestion,
    type,
    searchIntent: ["informational", "commercial", "transactional", "navigational"].includes(
      item.searchIntent
    )
      ? item.searchIntent
      : "informational",
    cluster,
    secondaryKeywords: safeStringArray(item.secondaryKeywords),
    questions: safeStringArray(item.questions),
    rationale,
    businessRelevance: relevance,
    evidence: sourced,
    existingPostId: existing?._id || null,
    mergePostIds: mergePosts.map((post) => post._id),
  };
}

async function runWeekly(options = {}) {
  const dryRun = options.dryRun ?? isDryRun();
  const groq = options.groq || new GroqClient({ weekly: true });
  await connectToDatabase();
  let run = null;
  if (!dryRun) {
    run = await BlogAutomationRun.create({
      runType: "weekly",
      status: "running",
      dryRun,
      metadata: { maxOpportunities: maxOpportunities() },
    });
  }
  try {
    const [posts, opportunities] = await Promise.all([
      BlogPost.find({ status: { $in: ["published", "needs_review", "draft"] } })
        .select("_id title slug excerpt primaryKeyword category updatedAt")
        .sort({ updatedAt: -1 })
        .limit(80)
        .lean(),
      KeywordOpportunity.find({
        status: { $in: ["approved", "processing", "needs_review", "published"] },
      })
        .select("keyword normalizedKeyword type status existingPostId mergePostIds")
        .sort({ updatedAt: -1 })
        .limit(120)
        .lean(),
    ]);
    const context = compactResearchContext(posts, opportunities);
    const structured = await groq.json(
      [
        {
          role: "system",
          content:
            "Use web search to research current, evidence-backed content opportunities for WorkSteady, then return strict JSON. Cite reliable primary HTTPS sources. Never invent search-volume, traffic, ranking, customer, or product data.",
        },
        {
          role: "user",
          content: `Return compact JSON: {"opportunities":[...]} with at most ${maxOpportunities()} entries.
Each entry needs keyword, titleSuggestion, type (new/update/consolidate),
existingPostSlug (required for update/consolidate), consolidatePostSlugs
(required for consolidate and containing the competing posts to merge), searchIntent, cluster,
secondaryKeywords (max 3), questions (max 2), rationale (max 40 words), businessRelevance (60-100 based only
on fit with small-business operations), and evidence (max 2 items as [{title,url,publisher}]).
Keep every string short. Do not include extra keys or unfinished objects.
Focus on practical revenue, cost, staffing, workflow, and daily decision-making
problems for small-business operators. Identify new topics and posts that need
updating or consolidating. Avoid duplicates of the supplied posts and
opportunities.

Existing posts:
${JSON.stringify(context.posts)}

Existing opportunities:
${JSON.stringify(context.opportunities)}`,
        },
      ],
      {
        research: true,
        webSearch: true,
        temperature: 0.1,
        maxTokens: 8000,
      }
    );
    const rawOpportunities = Array.isArray(structured.data?.opportunities)
      ? structured.data.opportunities
      : [];
    const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
    const queuedKeywords = new Set(
      opportunities.map((item) => item.normalizedKeyword).filter(Boolean)
    );
    let candidates = rawOpportunities
      .map((item) => normalizeOpportunity(item, postsBySlug))
      .filter(Boolean)
      .filter((candidate) => {
        if (candidate.type !== "new") return true;
        if (queuedKeywords.has(candidate.normalizedKeyword)) return false;
        return !posts.some((post) => {
          const similarity = duplicateScore(
            {
              title: candidate.titleSuggestion,
              primaryKeyword: candidate.keyword,
              content: candidate.rationale,
            },
            {
              ...post,
              normalizedKeyword: normalizeText(post.primaryKeyword),
              content: post.excerpt || "",
            }
          );
          return similarity.duplicate;
        });
      })
      .slice(0, maxOpportunities());
    let usedSeedTopics = false;
    if (!candidates.length) {
      candidates = pickSeedOpportunities(posts, opportunities, maxOpportunities());
      usedSeedTopics = true;
    }
    console.log(
      JSON.stringify({
        rawOpportunities: rawOpportunities.length,
        queued: candidates.length,
        usedSeedTopics,
      })
    );

    let saved = 0;
    if (!dryRun) {
      for (const candidate of candidates) {
        await KeywordOpportunity.findOneAndUpdate(
          {
            normalizedKeyword: candidate.normalizedKeyword,
            type: candidate.type,
            existingPostId: candidate.existingPostId,
          },
          {
            $set: {
              keyword: candidate.keyword,
              titleSuggestion: candidate.titleSuggestion,
              searchIntent: candidate.searchIntent,
              cluster: candidate.cluster,
              secondaryKeywords: candidate.secondaryKeywords,
              questions: candidate.questions,
              rationale: candidate.rationale,
              businessRelevance: candidate.businessRelevance,
              evidence: candidate.evidence,
              mergePostIds: candidate.mergePostIds,
              researchRunId: run._id,
            },
            $setOnInsert: { status: "approved" },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        saved += 1;
      }
      run.status = "succeeded";
      run.completedAt = new Date();
      run.counts.researched = candidates.length;
      run.metadata.saved = saved;
      run.metadata.researchModel = structured.model;
      await run.save();
    }
    return { dryRun, researched: candidates.length, saved, candidates };
  } catch (error) {
    if (run) {
      run.status = "failed";
      run.completedAt = new Date();
      run.errors.push({ stage: "weekly", message: error.message, systemic: true });
      await run.save().catch(() => {});
    }
    throw error;
  }
}

if (require.main === module) {
  runWeekly()
    .then((result) => {
      console.log(JSON.stringify({ ...result, candidates: undefined }, null, 2));
      if (!result.dryRun && result.saved === 0) {
        console.error("[blog-weekly] No new topics were saved, so publishing has nothing to claim.");
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error("[blog-weekly]", error);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = {
  compactResearchContext,
  maxOpportunities,
  normalizeOpportunity,
  pickSeedOpportunities,
  runWeekly,
};
