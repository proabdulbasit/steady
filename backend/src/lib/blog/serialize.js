function serializeImage(image) {
  if (!image) return null;
  return {
    url: image.url || "",
    alt: image.alt || "",
    width: image.width || null,
    height: image.height || null,
    variants: (image.variants || []).map((variant) => ({
      aspectRatio: variant.aspectRatio,
      url: variant.url,
      width: variant.width || null,
      height: variant.height || null,
    })),
  };
}

function serializePostSummary(post) {
  return {
    id: String(post._id),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    featuredImage: serializeImage(post.featuredImage),
    primaryKeyword: post.primaryKeyword,
    category: post.category,
    tags: post.tags || [],
    author: post.author || null,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    readingTime: post.readingTime,
    featured: Boolean(post.featured),
  };
}

function serializePost(post) {
  return {
    ...serializePostSummary(post),
    content: post.content,
    secondaryKeywords: post.secondaryKeywords || [],
    searchIntent: post.searchIntent,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    canonicalUrl: post.canonicalUrl,
    openGraph: post.openGraph || {},
    schema: post.schema || {},
    internalLinks: post.internalLinks || [],
    sourceReferences: (post.sourceReferences || []).map((source) => ({
      title: source.title,
      url: source.url,
      publisher: source.publisher || "",
      accessedAt: source.accessedAt,
    })),
    relatedPosts: (post.relatedPosts || []).map((related) => {
      if (related && typeof related === "object" && related.slug) {
        return serializePostSummary(related);
      }
      return String(related);
    }),
    qualityScore: post.qualityScore,
  };
}

module.exports = {
  serializeImage,
  serializePost,
  serializePostSummary,
};
