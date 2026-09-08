import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  BLOG_LIST_TAG,
  BLOG_SITEMAP_TAG,
  blogPostTag,
  isValidBlogSlug,
  normalizeSlug,
} from "../../../../lib/blog-server";

function matchesSecret(candidate, expected) {
  if (!candidate || !expected) return false;
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

export async function POST(request) {
  const expected = process.env.BLOG_REVALIDATE_SECRET;
  if (!expected) {
    return Response.json(
      { error: "Blog revalidation is not configured." },
      { status: 503 },
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // A body is optional when invalidating the complete blog.
  }

  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const provided =
    bearer ||
    request.headers.get("x-blog-revalidate-secret") ||
    request.headers.get("x-revalidate-secret") ||
    body?.secret ||
    "";
  if (!matchesSecret(provided, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const slug = normalizeSlug(body?.slug);
  if (slug && !isValidBlogSlug(slug)) {
    return Response.json({ error: "Invalid slug." }, { status: 400 });
  }

  revalidateTag(BLOG_LIST_TAG, "max");
  revalidateTag(BLOG_SITEMAP_TAG, "max");
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");

  const revalidated = ["/blog", "/sitemap.xml"];
  if (slug) {
    revalidateTag(blogPostTag(slug), "max");
    revalidatePath(`/${slug}`);
    revalidated.push(`/${slug}`);
  }

  return Response.json({ revalidated, now: new Date().toISOString() });
}
