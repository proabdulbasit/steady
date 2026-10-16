import {
  absoluteSiteUrl,
  canonicalPostUrl,
  getBlogPosts,
  getBlogSitemap,
} from "../../../lib/blog-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDate(...values) {
  for (const value of values) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `<url>
<loc>${xmlEscape(loc)}</loc>
<lastmod>${xmlEscape(lastmod)}</lastmod>
<changefreq>${xmlEscape(changefreq)}</changefreq>
<priority>${xmlEscape(priority)}</priority>
</url>`;
}

async function loadArticlePosts() {
  try {
    const posts = await getBlogSitemap();
    if (Array.isArray(posts) && posts.length) return posts;
  } catch (error) {
    console.error("[api/sitemap] getBlogSitemap failed:", error?.message || error);
  }

  // Last resort: paginate the public posts API (works even when backend /sitemap is down).
  const posts = [];
  let page = 1;
  let totalPages = 1;
  try {
    do {
      const result = await getBlogPosts({
        limit: 24,
        page,
        allowCdnFallback: true,
      });
      for (const post of result.posts || []) {
        if (post?.slug) posts.push(post);
      }
      totalPages = Math.max(1, Number(result.totalPages) || 1);
      page += 1;
    } while (page <= totalPages && page <= 100);
  } catch (error) {
    console.error("[api/sitemap] Posts pagination failed:", error?.message || error);
  }
  return posts;
}

async function buildEntries() {
  const now = new Date().toISOString();
  const staticEntries = [
    { path: "/", changefreq: "weekly", priority: "1" },
    { path: "/blog", changefreq: "daily", priority: "0.9" },
    { path: "/pricing", changefreq: "monthly", priority: "0.7" },
    { path: "/privacy", changefreq: "yearly", priority: "0.3" },
    { path: "/terms", changefreq: "yearly", priority: "0.3" },
  ].map((route) =>
    urlEntry({
      loc: absoluteSiteUrl(route.path),
      lastmod: now,
      changefreq: route.changefreq,
      priority: route.priority,
    }),
  );

  const posts = await loadArticlePosts();
  const seen = new Set();
  const articleEntries = [];
  for (const post of posts) {
    if (!post?.slug || seen.has(post.slug)) continue;
    seen.add(post.slug);
    articleEntries.push(
      urlEntry({
        loc: canonicalPostUrl(post),
        lastmod: isoDate(post.updatedAt, post.publishedAt),
        changefreq: "weekly",
        priority: "0.7",
      }),
    );
  }

  return [...staticEntries, ...articleEntries];
}

export async function GET() {
  const entries = await buildEntries();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
