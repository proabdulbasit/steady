import { BlogBackendError, getBlogPosts } from "../../../../lib/blog-server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "9";
  const cursor = searchParams.get("cursor") || undefined;

  try {
    const result = await getBlogPosts({ limit, cursor });
    return Response.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
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
