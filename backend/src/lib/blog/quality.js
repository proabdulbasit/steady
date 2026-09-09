const {
  CANONICAL_SITE_PAGES,
  RESERVED_ROOT_SLUGS,
  getSiteBaseUrl,
} = require("./constants");
const { normalizeText } = require("./duplicate");

function markdownWordCount(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function extractMarkdownLinks(markdown) {
  const links = [];
  const pattern = /(?<!!)\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const match of String(markdown || "").matchAll(pattern)) {
    links.push({ anchor: match[1].trim(), href: match[2].trim() });
  }
  return links;
}

function isSafeUrl(value, baseUrl = getSiteBaseUrl()) {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return false;
    return !url.username && !url.password && !/^javascript:/i.test(value);
  } catch {
    return false;
  }
}

function isPlaceholderHost(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    return /^(example\.(com|net|org)|workstead\.app)$/.test(host);
  } catch {
    return true;
  }
}

function isBrokenStatus(status) {
  return status === 404 || status === 410 || status >= 500;
}

function isAllowedInternalUrl(value, baseUrl = getSiteBaseUrl()) {
  try {
    const target = new URL(value, baseUrl);
    const base = new URL(baseUrl);
    if (target.origin !== base.origin) return false;
    const path = target.pathname.replace(/\/+$/, "") || "/";
    const rootSlug = path.split("/").filter(Boolean);
    return (
      CANONICAL_SITE_PAGES.includes(path) ||
      path.startsWith("/tools/") ||
      (rootSlug.length === 1 &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rootSlug[0]) &&
        !RESERVED_ROOT_SLUGS.has(rootSlug[0]))
    );
  } catch {
    return false;
  }
}

function keywordDensity(content, keyword) {
  const body = normalizeText(content);
  const needle = normalizeText(keyword);
  if (!body || !needle) return 0;
  const occurrences = body.split(needle).length - 1;
  return occurrences / Math.max(1, body.split(" ").length);
}

function repeatedParagraphRatio(content) {
  const paragraphs = String(content || "")
    .split(/\n\s*\n/)
    .map(normalizeText)
    .filter((paragraph) => paragraph.split(" ").length >= 8);
  if (!paragraphs.length) return 0;
  return 1 - new Set(paragraphs).size / paragraphs.length;
}

async function validateReachableSources(post, options = {}) {
  const fetchImpl = options.fetch || global.fetch;
  if (typeof fetchImpl !== "function") {
    return { checked: 0, broken: ["Source checking is unavailable."] };
  }
  const timeoutMs = options.timeoutMs || 10000;
  const urls = [
    ...new Set(
      (post.sourceReferences || [])
        .map((source) => source?.url)
        .filter((url) => isSafeUrl(url))
    ),
  ];
  const broken = [];
  const reachable = [];
  for (const url of urls) {
    if (isPlaceholderHost(url)) {
      broken.push(`${url} is a placeholder host`);
      continue;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = { "User-Agent": "WorkSteadyEditorialBot/1.0" };
      let response = await fetchImpl(url, {
        method: "HEAD",
        redirect: "follow",
        headers,
        signal: controller.signal,
      });
      if (isBrokenStatus(response.status) || response.status === 405 || response.status === 403) {
        response = await fetchImpl(url, {
          method: "GET",
          redirect: "follow",
          headers: { ...headers, Range: "bytes=0-1023" },
          signal: controller.signal,
        });
      }
      if (isBrokenStatus(response.status)) {
        broken.push(`${url} returned HTTP ${response.status}`);
      } else {
        reachable.push(url);
      }
    } catch (error) {
      try {
        const response = await fetchImpl(url, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent": "WorkSteadyEditorialBot/1.0",
            Range: "bytes=0-1023",
          },
          signal: controller.signal,
        });
        if (isBrokenStatus(response.status)) {
          broken.push(`${url} returned HTTP ${response.status}`);
        } else {
          reachable.push(url);
        }
      } catch (retryError) {
        broken.push(
          `${url} could not be reached (${retryError.name || error.name || "network error"})`
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }
  return { checked: urls.length, broken, reachable };
}

function validateQuality(post, options = {}) {
  const minWords = options.minWords ?? 900;
  const minH2 = options.minH2 ?? 3;
  const minInternalLinks = options.minInternalLinks ?? 2;
  const minSources = options.minSources ?? 2;
  const qualityThreshold = options.qualityThreshold ?? 80;
  const baseUrl = options.baseUrl || getSiteBaseUrl();
  const errors = [];
  const warnings = [];
  const content = String(post.content || "");
  const wordCount = markdownWordCount(content);
  const h1Count = (content.match(/^#\s+/gm) || []).length;
  const h2Count = (content.match(/^##\s+/gm) || []).length;
  const links = extractMarkdownLinks(content);
  const internalLinks = [
    ...links,
    ...(Array.isArray(post.internalLinks) ? post.internalLinks : []),
  ].filter((link, index, all) => {
    return (
      link &&
      isAllowedInternalUrl(link.href, baseUrl) &&
      all.findIndex((item) => item?.href === link.href) === index
    );
  });
  const sources = Array.isArray(post.sourceReferences)
    ? post.sourceReferences
    : [];
  const sourceUrls = new Set(
    sources.map((source) => String(source.url || "").replace(/[#?].*$/, "").replace(/\/$/, ""))
  );
  const citationLinks = links.filter((link) =>
    sourceUrls.has(String(link.href || "").replace(/[#?].*$/, "").replace(/\/$/, ""))
  );
  const allUrls = [
    post.canonicalUrl,
    post.featuredImage?.url,
    ...links.map((link) => link.href),
    ...sources.map((source) => source.url),
  ].filter(Boolean);
  const invalidUrls = allUrls.filter((url) => !isSafeUrl(url, baseUrl));
  const expectedCanonical = `${baseUrl}/${post.slug}`;
  const density = keywordDensity(content, post.primaryKeyword);
  const repetition = repeatedParagraphRatio(content);

  const required = {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    primaryKeyword: post.primaryKeyword,
    category: post.category,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    canonicalUrl: post.canonicalUrl,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !String(value || "").trim())
    .map(([name]) => name);
  if (missing.length) errors.push(`Missing required fields: ${missing.join(", ")}.`);
  if (wordCount < minWords) errors.push(`Content has ${wordCount} words; minimum is ${minWords}.`);
  if (h1Count) errors.push("Markdown content must not contain an H1 heading.");
  if (h2Count < minH2) errors.push(`Content has ${h2Count} H2 headings; minimum is ${minH2}.`);
  if (density > 0.03) errors.push("Primary keyword density exceeds 3%.");
  else if (density > 0.02) warnings.push("Primary keyword density exceeds 2%.");
  if (repetition > 0.15) errors.push("Content contains excessive repeated paragraphs.");
  if (sources.length < minSources) errors.push(`At least ${minSources} source references are required.`);
  if (citationLinks.length < minSources) {
    errors.push(`At least ${minSources} source references must be cited in the Markdown content.`);
  }
  if (internalLinks.length < minInternalLinks) {
    errors.push(`At least ${minInternalLinks} valid internal links are required.`);
  }
  if (!post.featuredImage?.url || !post.featuredImage?.alt) {
    errors.push("A featured image URL and alt text are required.");
  }
  if (post.canonicalUrl !== expectedCanonical) {
    errors.push(`Canonical URL must be ${expectedCanonical}.`);
  }
  if (invalidUrls.length) errors.push("All content, source, canonical, and image URLs must be safe HTTPS URLs.");
  if (String(post.metaTitle || "").length > 60) warnings.push("Meta title exceeds 60 characters.");
  const metaDescriptionLength = String(post.metaDescription || "").length;
  if (metaDescriptionLength < 120 || metaDescriptionLength > 165) {
    warnings.push("Meta description should be 120–165 characters.");
  }
  if (String(post.excerpt || "").length > 240) warnings.push("Excerpt exceeds 240 characters.");

  const score = Math.max(
    0,
    Math.round(100 - errors.length * 12 - warnings.length * 3)
  );
  return {
    hardPass: errors.length === 0 && score >= qualityThreshold,
    score,
    errors,
    warnings,
    checks: {
      wordCount,
      h1Count,
      h2Count,
      keywordDensity: Number(density.toFixed(4)),
      repeatedParagraphRatio: Number(repetition.toFixed(4)),
      internalLinkCount: internalLinks.length,
      sourceCount: sources.length,
      citationCount: citationLinks.length,
      invalidUrlCount: invalidUrls.length,
      expectedCanonical,
    },
    validatedAt: new Date(),
  };
}

module.exports = {
  extractMarkdownLinks,
  isAllowedInternalUrl,
  isPlaceholderHost,
  isSafeUrl,
  keywordDensity,
  markdownWordCount,
  repeatedParagraphRatio,
  validateReachableSources,
  validateQuality,
};
