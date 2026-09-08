const mongoose = require("mongoose");
const {
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
  const parsed = Number.parseInt(process.env.MAX_KEYWORD_OPPORTUNITIES || "24", 10);
  return Math.min(50, Math.max(1, Number.isFinite(parsed) ? parsed : 24));
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
  const relevance = Math.round(Number(item.businessRelevance));
  if (!keyword || !item.titleSuggestion || !item.cluster || !item.rationale) return null;
  if (!normalizedKeyword) return null;
  if (!Number.isFinite(relevance) || relevance < 60 || relevance > 100) return null;
  const evidence = (Array.isArray(item.evidence) ? item.evidence : [])
    .filter((source) => source?.title && /^https:\/\//.test(source?.url || ""))
    .map((source) => ({
      title: String(source.title),
      url: String(source.url),
      publisher: String(source.publisher || ""),
    }))
    .slice(0, 10);
  if (!evidence.length) return null;
  return {
    keyword,
    normalizedKeyword,
    titleSuggestion: String(item.titleSuggestion).trim(),
    type,
    searchIntent: ["informational", "commercial", "transactional", "navigational"].includes(
      item.searchIntent
    )
      ? item.searchIntent
      : "informational",
    cluster: String(item.cluster).trim(),
    secondaryKeywords: safeStringArray(item.secondaryKeywords),
    questions: safeStringArray(item.questions),
    rationale: String(item.rationale).trim(),
    businessRelevance: relevance,
    evidence,
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
        .lean(),
      KeywordOpportunity.find({
        status: { $in: ["approved", "processing", "needs_review", "published"] },
      })
        .select("keyword normalizedKeyword type status existingPostId mergePostIds")
        .lean(),
    ]);
    const research = await groq.research(`Research current, evidence-backed content opportunities for WorkSteady,
a small-business operations product. Focus on practical revenue, cost, staffing,
workflow, and daily decision-making problems. Identify new topics and posts that
need updating or consolidating. Do not claim access to keyword volume, traffic,
rankings, or proprietary SEO metrics.

Existing posts:
${JSON.stringify(posts)}

Existing opportunities:
${JSON.stringify(opportunities)}

Provide citations to reliable HTTPS sources and explain why each topic matters
to small-business operators.`);
    const structured = await groq.json(
      [
        {
          role: "system",
          content:
            "Turn cited research into strict JSON. Never invent search-volume, traffic, ranking, or customer data.",
        },
        {
          role: "user",
          content: `Return {"opportunities": [...]} with at most ${maxOpportunities()} entries.
Each entry needs keyword, titleSuggestion, type (new/update/consolidate),
existingPostSlug (required for update/consolidate), consolidatePostSlugs
(required for consolidate and containing the competing posts to merge), searchIntent, cluster,
secondaryKeywords, questions, rationale, businessRelevance (0-100 based only
on fit with small-business operations), and evidence [{title,url,publisher}].
Avoid duplicates of existing opportunities. Research:
${research.content}`,
        },
      ],
      { temperature: 0.1, maxTokens: 7000 }
    );
    const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
    const queuedKeywords = new Set(
      opportunities.map((item) => item.normalizedKeyword).filter(Boolean)
    );
    const candidates = (structured.data.opportunities || [])
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
      run.metadata.researchModel = research.model;
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
    })
    .catch((error) => {
      console.error("[blog-weekly]", error);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = {
  maxOpportunities,
  normalizeOpportunity,
  runWeekly,
};
