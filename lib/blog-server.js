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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function requestJson(
  url,
  {
    tags,
    revalidate = DEFAULT_REVALIDATE_SECONDS,
    slug,
    cache,
    timeoutMs = 15000,
    retries = 3,
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    let response;
    try {
      const init = {
        headers: { Accept: "application/json" },
      };
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        init.signal = AbortSignal.timeout(timeoutMs);
      }
      if (cache === "no-store") {
        init.cache = "no-store";
      } else {
        init.cache = "force-cache";
        init.next = { revalidate, tags };
      }
      response = await fetch(url, init);
    } catch (cause) {
      lastError = new BlogBackendError("The blog service could not be reached.", { cause });
      if (attempt < retries) {
        await sleep(400 * attempt);
        continue;
      }
      throw lastError;
    }

    if (response.status === 404 && slug) {
      throw new BlogNotFoundError(slug);
    }

    if (!response.ok) {
      lastError = new BlogBackendError(`The blog service returned HTTP ${response.status}.`, {
        status: response.status,
      });
      if (attempt < retries && isRetryableStatus(response.status)) {
        await sleep(400 * attempt);
        continue;
      }
      throw lastError;
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

  throw lastError || new BlogBackendError("The blog service could not be reached.");
}

export async function getBlogPosts({
  limit = 10,
  cursor,
  page,
  allowCdnFallback = false,
} = {}) {
  const safeLimit = Math.min(24, Math.max(1, Number.parseInt(limit, 10) || 10));
  const safeCursor =
    typeof cursor === "string" && cursor.length <= 2048 ? cursor : undefined;
  const parsedPage = Number.parseInt(page, 10);
  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : undefined;
  const query = {
    limit: safeLimit,
    cursor: safePage ? undefined : safeCursor,
    page: safePage,
  };

  let data;
  try {
    data = await requestJson(backendUrl("/api/blog/posts", query), {
      tags: [BLOG_LIST_TAG],
      // Cache successful listings so brief backend blips do not blank /blog.
      revalidate: 120,
      timeoutMs: 15000,
      retries: 3,
    });
  } catch (error) {
    // Last resort on the public site: reuse a CDN-cached Next.js API response.
    if (!allowCdnFallback || !(error instanceof BlogBackendError)) throw error;
    const fallbackUrl = new URL("/api/blog/posts", SITE_ORIGIN);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        fallbackUrl.searchParams.set(key, String(value));
      }
    }
    try {
      data = await requestJson(fallbackUrl, {
        cache: "no-store",
        timeoutMs: 10000,
        retries: 1,
      });
    } catch {
      throw error;
    }
  }

  if (!Array.isArray(data.posts)) {
    throw new BlogBackendError("The blog service response did not include a posts array.");
  }

  const total = Number.isFinite(Number(data.total)) ? Number(data.total) : data.posts.length;
  const totalPages = Number.isFinite(Number(data.totalPages))
    ? Number(data.totalPages)
    : Math.max(1, Math.ceil(total / safeLimit) || 1);

  return {
    posts: data.posts,
    page: Number.isFinite(Number(data.page)) ? Number(data.page) : safePage || 1,
    pageSize: Number.isFinite(Number(data.pageSize)) ? Number(data.pageSize) : safeLimit,
    total,
    totalPages: total ? totalPages : 0,
    nextCursor:
      typeof data.nextCursor === "string"
        ? data.nextCursor
        : typeof data.pageInfo?.nextCursor === "string"
          ? data.pageInfo.nextCursor
          : null,
  };
}

export async function getBlogPost(slug, { allowCdnFallback = false } = {}) {
  const normalized = normalizeSlug(slug);
  if (!normalized || normalized.length > 200) {
    throw new BlogBackendError("The requested blog slug is invalid.");
  }

  const backendPath = `/api/blog/posts/${encodeURIComponent(normalized)}`;
  let data;
  try {
    data = await requestJson(backendUrl(backendPath), {
      tags: [BLOG_LIST_TAG, blogPostTag(normalized)],
      slug: normalized,
      revalidate: DEFAULT_REVALIDATE_SECONDS,
      timeoutMs: 15000,
      retries: 3,
    });
  } catch (error) {
    if (!allowCdnFallback || error instanceof BlogNotFoundError) throw error;
    if (!(error instanceof BlogBackendError)) throw error;
    try {
      data = await requestJson(new URL(backendPath, SITE_ORIGIN), {
        cache: "no-store",
        timeoutMs: 10000,
        retries: 1,
        slug: normalized,
      });
    } catch {
      throw error;
    }
  }

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
    timeoutMs: 4000,
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
