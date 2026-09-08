const crypto = require("node:crypto");
const mongoose = require("mongoose");
const {
  buildGenerationPrompt,
  claimOpportunities,
  clampContentCount,
  isDryRun,
  loadBackendEnv,
  normalizeGeneratedPost,
  runEditorialCritic,
} = require("../src/lib/blog/pipeline");

loadBackendEnv();

const { connectToDatabase } = require("../src/lib/db");
const BlogPost = require("../src/models/BlogPost");
const KeywordOpportunity = require("../src/models/KeywordOpportunity");
const BlogPostRevision = require("../src/models/BlogPostRevision");
const BlogAutomationRun = require("../src/models/BlogAutomationRun");
const { GroqClient } = require("../src/lib/blog/groq");
const { createUniqueSlug } = require("../src/lib/blog/slug");
const { findClosestDuplicate } = require("../src/lib/blog/duplicate");
const {
  validateQuality,
  validateReachableSources,
  markdownWordCount,
} = require("../src/lib/blog/quality");
const { buildBlogSchema } = require("../src/lib/blog/schema");
const { generateFeaturedImage, promptFingerprint } = require("../src/lib/blog/image");
const { getSiteBaseUrl } = require("../src/lib/blog/constants");

function qualityThreshold() {
  const parsed = Number.parseInt(process.env.BLOG_QUALITY_THRESHOLD || "82", 10);
  return Math.min(100, Math.max(70, Number.isFinite(parsed) ? parsed : 82));
}

function isSystemicError(error) {
  return (
    ["AbortError", "MongooseError", "MongoServerError"].includes(error?.name) ||
    [401, 403, 408, 429].includes(error?.status) ||
    error?.status >= 500 ||
    /Missing (GROQ|REPLICATE|CLOUDINARY|MONGODB)|request failed|polling failed/i.test(
      error?.message || ""
    )
  );
}

async function markOpportunity(opportunityId, values) {
  return KeywordOpportunity.updateOne(
    { _id: opportunityId },
    {
      $set: values,
      $unset: { lockId: 1, lockedAt: 1, lockExpiresAt: 1 },
    }
  );
}

async function nextRevisionNumber(postId) {
  const latest = await BlogPostRevision.findOne({ postId })
    .sort({ revisionNumber: -1 })
    .select("revisionNumber")
    .lean();
  return (latest?.revisionNumber || 0) + 1;
}

function revisionSnapshot(post) {
  const snapshot = { ...post };
  delete snapshot._id;
  delete snapshot.__v;
  return snapshot;
}

function selectRelatedPostIds(postData, allPosts, existingPost) {
  const linkedSlugs = new Set(
    (postData.internalLinks || []).flatMap((link) => {
      try {
        const parts = new URL(link.href, getSiteBaseUrl()).pathname
          .split("/")
          .filter(Boolean);
        return parts.length === 1 ? [parts[0]] : [];
      } catch {
        return [];
      }
    })
  );
  return allPosts
    .filter(
      (post) =>
        post.status === "published" &&
        String(post._id) !== String(existingPost?._id) &&
        (linkedSlugs.has(post.slug) || post.category === postData.category)
    )
    .sort((left, right) => {
      const linkedDifference =
        Number(linkedSlugs.has(right.slug)) - Number(linkedSlugs.has(left.slug));
      if (linkedDifference) return linkedDifference;
      return new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0);
    })
    .slice(0, 3)
    .map((post) => post._id);
}

async function persistCandidate({
  opportunity,
  existingPost,
  mergePosts,
  postData,
  report,
  editorial,
  publish,
}) {
  const now = new Date();
  const qualityScore = Math.min(report.score, editorial.score);
  const status = publish ? "published" : "needs_review";
  const finalData = {
    ...postData,
    status,
    qualityScore,
    publishedAt: publish ? existingPost?.publishedAt || now : existingPost?.publishedAt || null,
    validationReport: {
      ...report,
      hardPass: publish,
      editorial,
      validatedAt: now,
    },
    updatedAt: now,
  };
  finalData.schema = buildBlogSchema(
    { ...finalData, wordCount: markdownWordCount(finalData.content) },
    { baseUrl: getSiteBaseUrl() }
  );

  if (existingPost) {
    // A failed refresh must never take an already-published URL offline.
    // The opportunity carries the needs_review state and error details.
    if (!publish) return existingPost;
    if (publish) {
      for (const revisionPost of [existingPost, ...(mergePosts || [])]) {
        await BlogPostRevision.findOneAndUpdate(
          { opportunityId: opportunity._id, postId: revisionPost._id },
          {
            $setOnInsert: {
              postId: revisionPost._id,
              revisionNumber: await nextRevisionNumber(revisionPost._id),
              opportunityId: opportunity._id,
              snapshot: revisionSnapshot(revisionPost),
              reason: `${opportunity.type} opportunity: ${opportunity.keyword}`,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }
    const updatedPost = await BlogPost.findByIdAndUpdate(
      existingPost._id,
      {
        $set: finalData,
        $addToSet: {
          previousSlugs: {
            $each: [
              ...(existingPost.previousSlugs || []),
              ...(mergePosts || []).map((post) => post.slug),
            ],
          },
        },
      },
      { new: true, runValidators: true }
    );
    if ((mergePosts || []).length) {
      await BlogPost.updateMany(
        { _id: { $in: mergePosts.map((post) => post._id) } },
        { $set: { status: "archived", featured: false } }
      );
    }
    return updatedPost;
  }
  return BlogPost.findOneAndUpdate(
    { opportunityId: opportunity._id },
    { $set: finalData, $setOnInsert: { opportunityId: opportunity._id } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

async function processOpportunity({
  opportunity,
  groq,
  allPosts,
  usedFingerprints,
  usedSourceIds,
  dryRun,
}) {
  const existingPost =
    opportunity.type === "new"
      ? null
      : allPosts.find(
          (post) => String(post._id) === String(opportunity.existingPostId)
        );
  if (opportunity.type !== "new" && !existingPost) {
    throw new Error("Update/consolidation opportunity has no existing post.");
  }
  const mergePostIds = new Set(
    (opportunity.mergePostIds || []).map((postId) => String(postId))
  );
  const mergePosts =
    opportunity.type === "consolidate"
      ? allPosts.filter(
          (post) =>
            mergePostIds.has(String(post._id)) &&
            post.status === "published" &&
            String(post._id) !== String(existingPost?._id)
        )
      : [];
  if (opportunity.type === "consolidate" && !mergePosts.length) {
    throw new Error("Consolidation opportunity has no published posts to merge.");
  }
  const research = await groq.research(`Research this WorkSteady article topic using current,
reliable sources: "${opportunity.keyword}". Questions:
${JSON.stringify(opportunity.questions || [])}
Existing article, if updating:
${existingPost ? JSON.stringify({ title: existingPost.title, content: existingPost.content }) : "none"}
Competing articles to consolidate:
${JSON.stringify(mergePosts.map((post) => ({ title: post.title, content: post.content })))}
Return evidence with direct HTTPS citations. Never invent search volume, product
features, statistics, or customer results.`);
  const generation = await groq.json(
    [
      {
        role: "system",
        content:
          "You are WorkSteady's evidence-led editor. Return strict JSON and follow every supplied content constraint.",
      },
      {
        role: "user",
        content: buildGenerationPrompt(opportunity, research.content, allPosts),
      },
    ],
    { temperature: 0.25, maxTokens: 12000 }
  );
  const generated = generation.data;
  const slug = existingPost
    ? existingPost.slug
    : await createUniqueSlug(generated.title || opportunity.titleSuggestion, async (candidate) => {
        return BlogPost.exists({
          $or: [{ slug: candidate }, { previousSlugs: candidate }],
        });
      });
  let featuredImage = {};
  let imageError = "";
  try {
    featuredImage = await generateFeaturedImage({
      prompt: generated.imagePrompt,
      alt: generated.imageAlt,
      slug,
      usedFingerprints,
      usedSourceIds,
    });
    usedFingerprints.add(featuredImage.promptFingerprint);
    usedSourceIds.add(featuredImage.sourceId.split(":")[0]);
  } catch (error) {
    if (isSystemicError(error)) throw error;
    imageError = error.message;
  }
  const postData = normalizeGeneratedPost(generated, opportunity, {
    slug,
    featuredImage,
    publishedAt: existingPost?.publishedAt,
  });
  postData.relatedPosts = selectRelatedPostIds(postData, allPosts, existingPost);
  if (mergePostIds.size) {
    postData.relatedPosts = postData.relatedPosts.filter(
      (postId) => !mergePostIds.has(String(postId))
    );
  }
  const closest = findClosestDuplicate(
    postData,
    allPosts.filter((post) => String(post._id) !== String(existingPost?._id))
  );
  const report = validateQuality(postData, {
    qualityThreshold: qualityThreshold(),
    minWords: 1200,
  });
  const sourceCheck = await validateReachableSources(postData);
  report.checks.reachableSources = sourceCheck.checked;
  report.checks.brokenSources = sourceCheck.broken.length;
  if (sourceCheck.broken.length) {
    report.errors.push(`Broken or unreachable sources: ${sourceCheck.broken.join("; ")}`);
    report.score = Math.max(0, report.score - 12 * sourceCheck.broken.length);
    report.hardPass = false;
  }
  if (closest.similarity.duplicate) {
    report.errors.push(
      `Potential duplicate of "${closest.post.title}" (score ${closest.similarity.score}).`
    );
    report.score = Math.max(0, report.score - 20);
    report.hardPass = false;
  }
  if (imageError) {
    report.errors.push(`Image generation failed: ${imageError}`);
    report.hardPass = false;
  }
  const editorial = await runEditorialCritic(groq, postData);
  const publish =
    report.hardPass &&
    editorial.pass &&
    editorial.score >= qualityThreshold() &&
    Math.min(report.score, editorial.score) >= qualityThreshold();

  let savedPost = null;
  if (!dryRun) {
    savedPost = await persistCandidate({
      opportunity,
      existingPost,
      mergePosts,
      postData,
      report,
      editorial,
      publish,
    });
    await markOpportunity(opportunity._id, {
      status: publish ? "published" : "needs_review",
      publishedPostId: publish ? savedPost._id : null,
      lastAttemptAt: new Date(),
      lastError: publish
        ? ""
        : [...report.errors, ...editorial.concerns].join(" ").slice(0, 2000),
    });
  }
  if (existingPost) {
    if (publish) {
      Object.assign(existingPost, postData, { status: "published" });
      for (const mergedPost of mergePosts) mergedPost.status = "archived";
    }
  } else {
    allPosts.push({
      ...postData,
      _id: savedPost?._id || `dry-run-${opportunity._id}`,
    });
  }
  return {
    opportunityId: String(opportunity._id),
    title: postData.title,
    publish,
    qualityScore: Math.min(report.score, editorial.score),
    errors: report.errors,
    editorialConcerns: editorial.concerns,
  };
}

async function runDaily(options = {}) {
  const dryRun = options.dryRun ?? isDryRun();
  const count =
    options.count === undefined
      ? clampContentCount()
      : clampContentCount(String(options.count));
  await connectToDatabase();
  let run = null;
  if (!dryRun) {
    run = await BlogAutomationRun.create({
      runType: "daily",
      status: "running",
      dryRun,
      metadata: { requestedCount: count, qualityThreshold: qualityThreshold() },
    });
  }
  const lockId = `daily-${Date.now()}-${crypto.randomUUID()}`;
  let claimed = [];
  try {
    const groq = options.groq || new GroqClient();
    claimed = await claimOpportunities(KeywordOpportunity, count, lockId, {
      dryRun,
    });
    if (run) {
      run.counts.claimed = claimed.length;
      await run.save();
    }
    const allPosts = await BlogPost.find({
      status: { $in: ["published", "needs_review", "draft"] },
    })
      .select("+featuredImage.prompt +sourceReferences +normalizedKeyword +contentHash +previousSlugs")
      .lean();
    const usedFingerprints = new Set(
      allPosts
        .map((post) => post.featuredImage?.prompt)
        .filter(Boolean)
        .map(promptFingerprint)
    );
    const usedSourceIds = new Set(
      allPosts
        .map((post) => post.featuredImage?.sourceId?.split(":")[0])
        .filter(Boolean)
    );
    const results = [];
    for (const opportunity of claimed) {
      try {
        const result = await processOpportunity({
          opportunity,
          groq,
          allPosts,
          usedFingerprints,
          usedSourceIds,
          dryRun,
        });
        results.push(result);
        if (run) {
          run.counts.generated += 1;
          run.counts[result.publish ? "published" : "needsReview"] += 1;
          await run.save();
        }
      } catch (error) {
        if (!dryRun) {
          await markOpportunity(opportunity._id, {
            status: "needs_review",
            lastAttemptAt: new Date(),
            lastError: error.message.slice(0, 2000),
          });
        }
        if (run) {
          run.counts.needsReview += 1;
          run.errors.push({
            stage: "generation",
            opportunityId: opportunity._id,
            message: error.message,
            systemic: isSystemicError(error),
          });
          await run.save();
        }
        if (isSystemicError(error)) throw error;
        results.push({
          opportunityId: String(opportunity._id),
          publish: false,
          errors: [error.message],
        });
      }
    }
    if (run) {
      run.status = run.errors.length ? "partial" : "succeeded";
      run.completedAt = new Date();
      await run.save();
    }
    return { dryRun, claimed: claimed.length, results };
  } catch (error) {
    if (!dryRun) {
      await KeywordOpportunity.updateMany(
        { lockId, status: "processing" },
        {
          $set: {
            status: "needs_review",
            lastAttemptAt: new Date(),
            lastError: error.message.slice(0, 2000),
          },
          $unset: { lockId: 1, lockedAt: 1, lockExpiresAt: 1 },
        }
      ).catch(() => {});
    }
    if (run) {
      run.status = "failed";
      run.completedAt = new Date();
      if (!run.errors.some((item) => item.systemic)) {
        run.errors.push({
          stage: "daily",
          message: error.message,
          systemic: true,
        });
      }
      await run.save().catch(() => {});
    }
    throw error;
  }
}

if (require.main === module) {
  runDaily()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error("[blog-daily]", error);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = {
  isSystemicError,
  processOpportunity,
  qualityThreshold,
  runDaily,
};
