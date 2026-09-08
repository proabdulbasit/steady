import {
  absoluteSiteUrl,
  canonicalPostUrl,
  getBlogSitemap,
} from "../lib/blog-server";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

function sitemapDate(...values) {
  for (const value of values) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

export default async function sitemap() {
  const generatedAt = new Date();
  const staticRoutes = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/blog", changeFrequency: "daily", priority: 0.9 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.7 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  ].map((route) => ({
    url: absoluteSiteUrl(route.path),
    lastModified: generatedAt,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const posts = await getBlogSitemap();
  const articleRoutes = posts
    .filter((post) => post?.slug)
    .map((post) => ({
      url: canonicalPostUrl(post),
      lastModified: sitemapDate(post.updatedAt, post.publishedAt),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...staticRoutes, ...articleRoutes];
}
