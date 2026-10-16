import { BlogBackendError, getBlogSitemap } from "../../../../lib/blog-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const posts = await getBlogSitemap();
    return Response.json(
      {
        posts,
        urls: posts.map((post) => ({
          loc: post.canonicalUrl,
          lastmod: post.updatedAt || post.publishedAt,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    const status =
      error instanceof BlogBackendError && Number.isInteger(error.status)
        ? error.status
        : 503;
    return Response.json(
      { error: "Blog sitemap is temporarily unavailable.", posts: [], urls: [] },
      { status: status >= 400 && status < 600 ? status : 503 },
    );
  }
}
