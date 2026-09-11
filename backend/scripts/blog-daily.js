const crypto = require("node:crypto");
const mongoose = require("mongoose");
const {
  FALLBACK_SOURCES,
  buildGenerationPrompt,
  claimOpportunities,
  clampContentCount,
  ensureSourceCitations,
  isDryRun,
  loadBackendEnv,
  normalizeGeneratedPost,
  normalizeReferences,
  runEditorialCritic,
} = require("../src/lib/blog/pipeline");

loadBackendEnv();

const { connectToDatabase } = require("../src/lib/db");
const BlogPost = require("../src/models/BlogPost");
const KeywordOpportunity = require("../src/models/KeywordOpportunity");
const BlogPostRevision = require("../src/models/BlogPostRevision");
const BlogAutomationRun = require("../src/models/BlogAutomationRun");
const { GroqClient, extractHttpsUrls } = require("../src/lib/blog/groq");
const { createUniqueSlug } = require("../src/lib/blog/slug");
const { findClosestDuplicate } = require("../src/lib/blog/duplicate");
const {
  validateQuality,
  validateReachableSources,
  markdownWordCount,
} = require("../src/lib/blog/quality");
const { buildBlogSchema } = require("../src/lib/blog/schema");
const { generateFeaturedImage, promptFingerprint, unsplashFeaturedImage } = require("../src/lib/blog/image");
const { getSiteBaseUrl } = require("../src/lib/blog/constants");

function qualityThreshold() {
  const parsed = Number.parseInt(process.env.BLOG_QUALITY_THRESHOLD || "82", 10);
  return Math.min(100, Math.max(70, Number.isFinite(parsed) ? parsed : 82));
}

function isSystemicError(error) {
  if (error?.status === 413) return false;
  return (
    ["AbortError", "MongooseError", "MongoServerError"].includes(error?.name) ||
    [401, 403, 408, 429].includes(error?.status) ||
    error?.status >= 500 ||
    /Missing (GROQ|REPLICATE|CLOUDINARY|MONGODB)|polling failed/i.test(
      error?.message || ""
    )
  );
}

function sourceFromCitation(citation) {
  const value = typeof citation === "string" ? { url: citation } : citation || {};
  try {
    const url = new URL(value.url);
    if (url.protocol !== "https:") return null;
    const publisher = String(value.publisher || url.hostname.replace(/^www\./, "")).trim();
    return {
      title: String(value.title || publisher).trim(),
      url: url.toString(),
      publisher,
    };
  } catch {
    return null;
  }
}

async function verifiedResearchSources(opportunity, research) {
  const extracted = extractHttpsUrls(research?.content).map((url) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return { title: host, url, publisher: host };
    } catch {
      return null;
    }
  }).filter(Boolean);
  const candidates = normalizeReferences([
    ...(opportunity.evidence || []),
    ...(research.sources || []),
    ...(research.citations || []).map(sourceFromCitation).filter(Boolean),
    ...extracted,
    ...FALLBACK_SOURCES,
  ]);
  const check = await validateReachableSources({ sourceReferences: candidates });
  const reachable = new Set(check.reachable || []);
  return candidates.filter((source) => reachable.has(source.url)).slice(0, 8);
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
  const qualityScore = report.score;
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
    // Unpublished drafts can be replaced so the next retry is not a duplicate of itself.
    if (!publish && existingPost.status === "published") return existingPost;
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
  const existingDraft = allPosts.find(
    (post) => String(post.opportunityId) === String(opportunity._id)
  );
  const existingPost =
    opportunity.type === "new"
      ? existingDraft || null
      : allPosts.find(
          (post) => String(post._id) === String(opportunity.existingPostId)
        ) || existingDraft;
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
  const research = await groq.research(
    `Find 3-5 current HTTPS sources for this small-business topic: "${opportunity.keyword}".
Include official or primary publisher URLs only. Questions: ${(opportunity.questions || []).slice(0, 4).join("; ")}
Return short notes plus the exact URLs.`
  );
  const verifiedSources = await verifiedResearchSources(opportunity, research);
  if (verifiedSources.length < 2) {
    throw new Error(
      `Research returned ${verifiedSources.length} reachable source(s); at least 2 are required.`
    );
  }
  const generation = await groq.json(
    [
      {
        role: "system",
        content:
          "You are WorkSteady's evidence-led editor. Return strict JSON and follow every supplied content constraint.",
      },
      {
        role: "user",
        content: buildGenerationPrompt(
          opportunity,
          String(research.content || "").slice(0, 6000),
          allPosts.map((post) => ({
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
          })),
          verifiedSources
        ),
      },
    ],
    { temperature: 0.25, maxTokens: 12000 }
  );
  const generated = generation.data;
  generated.sourceReferences = verifiedSources;
  generated.content = ensureSourceCitations(generated.content, verifiedSources);
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
      title: generated.title || opportunity.titleSuggestion,
      category: generated.category || opportunity.cluster,
      keyword: generated.primaryKeyword || opportunity.keyword,
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
  if (markdownWordCount(postData.content) < 800) {
    const expansion = await groq.json(
      [
        {
          role: "system",
          content:
            "Expand the article to 1,400-1,800 useful words. Return the same JSON shape. Keep the verified source URLs unchanged and cite them in Markdown.",
        },
        {
          role: "user",
          content: JSON.stringify({
            draft: postData,
            verifiedSources,
          }),
        },
      ],
      { temperature: 0.2, maxTokens: 12000 }
    );
    if (expansion.data?.content) {
      postData.content = ensureSourceCitations(
        expansion.data.content,
        verifiedSources
      );
      postData.sourceReferences = verifiedSources;
    }
  }
  postData.relatedPosts = selectRelatedPostIds(postData, allPosts, existingPost);
  if (mergePostIds.size) {
    postData.relatedPosts = postData.relatedPosts.filter(
      (postId) => !mergePostIds.has(String(postId))
    );
  }
  const closest = findClosestDuplicate(
    postData,
    allPosts.filter(
      (post) =>
        String(post._id) !== String(existingPost?._id) &&
        String(post.opportunityId || "") !== String(opportunity._id) &&
        post.slug !== slug
    )
  );
  const report = validateQuality(postData, {
    qualityThreshold: qualityThreshold(),
    minWords: 800,
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
  const publish = report.hardPass && report.score >= qualityThreshold();

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

async function refreshFallbackImages({
  usedFingerprints,
  usedSourceIds,
  dryRun,
  limit = 3,
}) {
  const posts = await BlogPost.find({
    status: "published",
    "featuredImage.provider": "cloudinary-fallback",
  })
    .select("title slug category primaryKeyword featuredImage")
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean();
  const refreshed = [];
  for (const post of posts) {
    if (dryRun) {
      refreshed.push({ slug: post.slug, dryRun: true });
      continue;
    }
    try {
      const featuredImage = await unsplashFeaturedImage({
        alt: post.featuredImage?.alt,
        slug: post.slug,
        title: post.title,
        category: post.category,
        keyword: post.primaryKeyword,
        usedSourceIds,
      });
      usedFingerprints.add(featuredImage.promptFingerprint);
      usedSourceIds.add(featuredImage.sourceId.split(":")[0]);
      await BlogPost.updateOne(
        { _id: post._id },
        { $set: { featuredImage, updatedAt: new Date() } }
      );
      refreshed.push({ slug: post.slug, provider: featuredImage.provider });
    } catch (error) {
      refreshed.push({ slug: post.slug, error: error.message });
    }
  }
  return refreshed;
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
      .select("+featuredImage.prompt +sourceReferences +normalizedKeyword +contentHash +previousSlugs +opportunityId")
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
    const imageRefreshes = await refreshFallbackImages({
      usedFingerprints,
      usedSourceIds,
      dryRun,
    });
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
    return { dryRun, claimed: claimed.length, results, imageRefreshes };
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
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      const published = (result.results || []).filter((item) => item.publish).length;
      const refreshed = (result.imageRefreshes || []).filter((item) => item.provider).length;
      if (!result.dryRun && published === 0 && refreshed === 0) {
        console.error(
          "[blog-daily] No posts were published. The daily workflow must publish at least one article."
        );
        process.exitCode = 1;
      }
    })
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
  sourceFromCitation,
  verifiedResearchSources,
};
