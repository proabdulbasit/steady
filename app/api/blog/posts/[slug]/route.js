import {
  BlogBackendError,
  BlogNotFoundError,
  getBlogPost,
} from "../../../../../lib/blog-server";

export async function GET(_request, { params }) {
  const { slug } = await params;

  try {
    const result = await getBlogPost(slug);
    return Response.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    if (error instanceof BlogNotFoundError) {
      return Response.json({ error: "Blog post not found." }, { status: 404 });
    }
    const status =
      error instanceof BlogBackendError && Number.isInteger(error.status)
        ? error.status
        : 503;
    return Response.json(
      { error: "Articles are temporarily unavailable." },
      { status: status >= 400 && status < 600 ? status : 503 },
    );
  }
}
