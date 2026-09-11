import "server-only";

const DEFAULT_REVALIDATE_SECONDS = 900;
const SITE_ORIGIN = "https://worksteady.app";

export const BLOG_LIST_TAG = "blog-posts";
export const BLOG_SITEMAP_TAG = "blog-sitemap";

export class BlogNotFoundError extends Error {
  constructor(slug) {
    super(`Blog post not found: ${slug}`);
    this.name = "BlogNotFoundError";
    this.slug = slug;
  }
}

export class BlogBackendError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message, { cause });
    this.name = "BlogBackendError";
    this.status = status;
  }
}

export function blogPostTag(slug) {
  const safeSlug = normalizeSlug(slug).replace(/[^a-z0-9-]/g, "-").slice(0, 160);
  return `blog-post:${safeSlug || "unknown"}`;
}

export function normalizeSlug(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidBlogSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizeSlug(value));
}

export function absoluteSiteUrl(pathname = "/") {
  const path = String(pathname || "/").replace(/^\/+/, "");
  const url = new URL(`/${path}`, SITE_ORIGIN);
  return url.toString();
}

export function canonicalPostUrl(post) {
  const slug = normalizeSlug(post?.slug);
  const fallback = absoluteSiteUrl(`/${encodeURIComponent(slug)}`);
  if (!post?.canonicalUrl) return fallback;

  try {
    const candidate = new URL(post.canonicalUrl, SITE_ORIGIN);
    if (candidate.origin !== SITE_ORIGIN) return fallback;
    candidate.search = "";
    candidate.hash = "";
    const candidateParts = candidate.pathname.split("/").filter(Boolean);
    const candidateSlug =
      candidateParts.length === 2 && candidateParts[0] === "blog"
        ? candidateParts[1]
        : candidateParts.length === 1
          ? candidateParts[0]
          : "";
    return normalizeSlug(candidateSlug) === slug
      ? absoluteSiteUrl(`/${encodeURIComponent(slug)}`)
      : fallback;
  } catch {
    return fallback;
  }
}

function redirectSlug(value) {
  if (typeof value !== "string") return null;
  if (isValidBlogSlug(value)) return normalizeSlug(value);

  try {
    const target = new URL(value, SITE_ORIGIN);
    if (target.origin !== SITE_ORIGIN) return null;
    const parts = target.pathname.split("/").filter(Boolean);
    const slug = parts.length === 2 && parts[0] === "blog" ? parts[1] : parts[0];
    return parts.length <= 2 && isValidBlogSlug(slug) ? normalizeSlug(slug) : null;
  } catch {
    return null;
  }
}

function backendOrigin() {
  const raw = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!raw) {
    throw new BlogBackendError(
      "The blog service is not configured. Set BACKEND_URL or NEXT_PUBLIC_BACKEND_URL.",
    );
  }

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error("Unsupported backend URL");
    }
    return parsed.origin;
  } catch (cause) {
    throw new BlogBackendError("The configured blog service URL is invalid.", { cause });
  }
}

function backendUrl(pathname, searchParams = {}) {
  const url = new URL(pathname, backendOrigin());
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function requestJson(url, { tags, revalidate = DEFAULT_REVALIDATE_SECONDS, slug, cache } = {}) {
  let response;
  try {
    const init = {
      headers: { Accept: "application/json" },
    };
    if (cache === "no-store") {
      init.cache = "no-store";
    } else {
      init.cache = "force-cache";
      init.next = { revalidate, tags };
    }
    response = await fetch(url, init);
  } catch (cause) {
    throw new BlogBackendError("The blog service could not be reached.", { cause });
  }

  if (response.status === 404 && slug) {
    throw new BlogNotFoundError(slug);
  }
  if (!response.ok) {
    throw new BlogBackendError(`The blog service returned HTTP ${response.status}.`, {
      status: response.status,
    });
  }

  try {
    const data = await response.json();
    if (!data || typeof data !== "object") throw new Error("Expected a JSON object");
    return data;
  } catch (cause) {
    throw new BlogBackendError("The blog service returned an invalid response.", {
      status: response.status,
      cause,
    });
  }
}

export async function getBlogPosts({ limit = 10, cursor } = {}) {
  const safeLimit = Math.min(24, Math.max(1, Number.parseInt(limit, 10) || 10));
  const safeCursor =
    typeof cursor === "string" && cursor.length <= 2048 ? cursor : undefined;
  const data = await requestJson(
    backendUrl("/api/blog/posts", { limit: safeLimit, cursor: safeCursor }),
    { tags: [BLOG_LIST_TAG], cache: "no-store" },
  );

  if (!Array.isArray(data.posts)) {
    throw new BlogBackendError("The blog service response did not include a posts array.");
  }

  return {
    posts: data.posts,
    nextCursor:
      typeof data.nextCursor === "string"
        ? data.nextCursor
        : typeof data.pageInfo?.nextCursor === "string"
          ? data.pageInfo.nextCursor
          : null,
  };
}

export async function getBlogPost(slug) {
  const normalized = normalizeSlug(slug);
  if (!normalized || normalized.length > 200) {
    throw new BlogBackendError("The requested blog slug is invalid.");
  }

  const data = await requestJson(
    backendUrl(`/api/blog/posts/${encodeURIComponent(normalized)}`),
    { tags: [BLOG_LIST_TAG, blogPostTag(normalized)], slug: normalized },
  );

  const redirectTo = redirectSlug(data.redirectTo);
  if (redirectTo) {
    return { redirectTo };
  }
  if (!data.post || typeof data.post !== "object") {
    throw new BlogBackendError("The blog service response did not include a post.");
  }
  return { post: data.post };
}

export async function getBlogSitemap() {
  const data = await requestJson(backendUrl("/api/blog/sitemap"), {
    tags: [BLOG_LIST_TAG, BLOG_SITEMAP_TAG],
    revalidate: 3600,
  });
  const posts = Array.isArray(data.posts)
    ? data.posts
    : Array.isArray(data.urls)
      ? data.urls.map((entry) => {
          const loc = typeof entry?.loc === "string" ? entry.loc : "";
          let slug = "";
          try {
            slug = new URL(loc, SITE_ORIGIN).pathname.split("/").filter(Boolean).at(-1) || "";
          } catch {
            slug = "";
          }
          return {
            slug,
            canonicalUrl: loc,
            updatedAt: entry?.lastmod,
            publishedAt: entry?.lastmod,
          };
        })
      : null;
  if (!posts) {
    throw new BlogBackendError("The blog sitemap response did not include a posts array.");
  }
  return posts;
}
