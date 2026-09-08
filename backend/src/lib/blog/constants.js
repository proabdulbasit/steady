const DEFAULT_SITE_BASE_URL = "https://worksteady.app";

const CANONICAL_SITE_PAGES = Object.freeze([
  "/",
  "/pricing",
  "/register",
  "/login",
  "/forgot-password",
  "/privacy",
  "/terms",
  "/chat",
  "/tools/action",
  "/tools/audit",
  "/tools/document-upload",
  "/tools/savings",
  "/blog",
]);

const RESERVED_ROOT_SLUGS = new Set([
  "",
  "admin",
  "api",
  "blog",
  "chat",
  "dashboard",
  "favicon.ico",
  "forgot-password",
  "login",
  "pricing",
  "privacy",
  "profile",
  "register",
  "reset-password",
  "robots.txt",
  "signup",
  "sitemap.xml",
  "sw.js",
  "terms",
  "tools",
  "_next",
]);

const PUBLIC_POST_PROJECTION = Object.freeze({
  title: 1,
  slug: 1,
  excerpt: 1,
  content: 1,
  featuredImage: 1,
  primaryKeyword: 1,
  secondaryKeywords: 1,
  searchIntent: 1,
  category: 1,
  tags: 1,
  author: 1,
  metaTitle: 1,
  metaDescription: 1,
  canonicalUrl: 1,
  openGraph: 1,
  publishedAt: 1,
  updatedAt: 1,
  readingTime: 1,
  schema: 1,
  internalLinks: 1,
  relatedPosts: 1,
  qualityScore: 1,
  featured: 1,
});

function getSiteBaseUrl() {
  return (process.env.SITE_BASE_URL || DEFAULT_SITE_BASE_URL).replace(/\/+$/, "");
}

module.exports = {
  CANONICAL_SITE_PAGES,
  DEFAULT_SITE_BASE_URL,
  PUBLIC_POST_PROJECTION,
  RESERVED_ROOT_SLUGS,
  getSiteBaseUrl,
};
