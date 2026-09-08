const express = require("express");
const mongoose = require("mongoose");
const BlogPost = require("../models/BlogPost");
const { serializePost, serializePostSummary } = require("../lib/blog/serialize");

const router = express.Router();
const SUMMARY_FIELDS =
  "_id title slug excerpt featuredImage primaryKeyword category tags author publishedAt updatedAt readingTime featured";
const DETAIL_FIELDS =
  `${SUMMARY_FIELDS} content secondaryKeywords searchIntent metaTitle metaDescription canonicalUrl openGraph schema internalLinks relatedPosts qualityScore +sourceReferences`;

function encodeCursor(post) {
  return Buffer.from(
    JSON.stringify({ publishedAt: post.publishedAt, id: String(post._id) })
  ).toString("base64url");
}

function decodeCursor(value) {
  try {
    const decoded = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const publishedAt = new Date(decoded.publishedAt);
    if (Number.isNaN(publishedAt.getTime()) || !mongoose.isValidObjectId(decoded.id)) {
      throw new Error("invalid");
    }
    return { publishedAt, id: new mongoose.Types.ObjectId(decoded.id) };
  } catch {
    const error = new Error("Invalid pagination cursor.");
    error.status = 400;
    throw error;
  }
}

router.get("/posts", async (req, res) => {
  const parsedLimit = Number.parseInt(req.query.limit || "12", 10);
  const limit = Math.min(50, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 12));
  const filter = { status: "published", publishedAt: { $lte: new Date() } };
  if (req.query.cursor) {
    const cursor = decodeCursor(req.query.cursor);
    filter.$or = [
      { publishedAt: { $lt: cursor.publishedAt } },
      { publishedAt: cursor.publishedAt, _id: { $lt: cursor.id } },
    ];
  }
  const rows = await BlogPost.find(filter)
    .select(SUMMARY_FIELDS)
    .sort({ publishedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return res.json({
    posts: page.map(serializePostSummary),
    pageInfo: {
      hasMore,
      nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    },
  });
});

router.get("/posts/:slug", async (req, res) => {
  const requestedSlug = String(req.params.slug || "").toLowerCase();
  const post = await BlogPost.findOne({
    slug: requestedSlug,
    status: "published",
    publishedAt: { $lte: new Date() },
  })
    .select(DETAIL_FIELDS)
    .populate("relatedPosts", SUMMARY_FIELDS, {
      status: "published",
      publishedAt: { $lte: new Date() },
    })
    .lean();
  if (post) return res.json({ post: serializePost(post) });

  const previous = await BlogPost.findOne({
    previousSlugs: requestedSlug,
    status: "published",
    publishedAt: { $lte: new Date() },
  })
    .select("slug")
    .lean();
  if (previous) return res.json({ redirectTo: previous.slug });
  return res.status(404).json({ error: "Blog post not found." });
});

router.get("/sitemap", async (_req, res) => {
  const posts = await BlogPost.find({
    status: "published",
    publishedAt: { $lte: new Date() },
  })
    .select("canonicalUrl updatedAt publishedAt")
    .sort({ publishedAt: -1 })
    .lean();
  return res.json({
    urls: posts.map((post) => ({
      loc: post.canonicalUrl,
      lastmod: (post.updatedAt || post.publishedAt).toISOString(),
    })),
  });
});

module.exports = router;
module.exports.decodeCursor = decodeCursor;
module.exports.encodeCursor = encodeCursor;
