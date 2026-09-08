const { getSiteBaseUrl } = require("./constants");

function iso(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter((item) => item !== undefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, compact(item)])
        .filter(([, item]) => item !== undefined && item !== "")
    );
  }
  return value === null || value === "" || value === undefined ? undefined : value;
}

function buildBlogSchema(post, { baseUrl = getSiteBaseUrl() } = {}) {
  const canonical = post.canonicalUrl || `${baseUrl}/${post.slug}`;
  const imageUrls = [
    post.featuredImage?.url,
    ...(post.featuredImage?.variants || []).map((variant) => variant.url),
  ].filter(Boolean);
  const article = compact({
    "@context": "https://schema.org",
    "@type": ["Article", "BlogPosting"],
    "@id": `${canonical}#article`,
    headline: post.title,
    description: post.metaDescription || post.excerpt,
    image: imageUrls,
    datePublished: iso(post.publishedAt),
    dateModified: iso(post.updatedAt || post.publishedAt),
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: {
      "@type": "Organization",
      name: post.author?.name || "WorkSteady Editorial Team",
      url: post.author?.url || baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "WorkSteady",
      url: baseUrl,
    },
    articleSection: post.category,
    keywords: [post.primaryKeyword, ...(post.secondaryKeywords || [])]
      .filter(Boolean)
      .join(", "),
    wordCount: post.wordCount,
    isAccessibleForFree: true,
    citation: (post.sourceReferences || []).map((source) => source.url).filter(Boolean),
  });
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${baseUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: canonical,
      },
    ],
  };
  return { article, breadcrumb };
}

module.exports = {
  buildBlogSchema,
};
