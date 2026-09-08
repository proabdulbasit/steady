import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlogCard } from "../../components/blog-feed";
import {
  BlogNotFoundError,
  canonicalPostUrl,
  getBlogPost,
  normalizeSlug,
} from "../../lib/blog-server";
import styles from "./article.module.css";

export const revalidate = 900;

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = validDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function authorDetails(post) {
  const author = post?.author;
  if (author && typeof author === "object") {
    return {
      name: author.name || post.byline || "WorkSteady Editorial Team",
      url: safeExternalUrl(author.url),
    };
  }
  return {
    name: author || post?.byline || "WorkSteady Editorial Team",
    url: null,
  };
}

function safeExternalUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function imageDetails(post) {
  const image =
    post?.featuredImage && typeof post.featuredImage === "object"
      ? post.featuredImage
      : null;
  const url = typeof post?.featuredImage === "string"
    ? post.featuredImage
    : image?.url;
  const width = Number(post?.featuredImageWidth || image?.width);
  const height = Number(post?.featuredImageHeight || image?.height);
  if (
    typeof url !== "string" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return {
    url,
    width,
    height,
    alt: post.featuredImageAlt || image?.alt || "",
  };
}

function sourceDetails(post) {
  const values = Array.isArray(post?.sources)
    ? post.sources
    : Array.isArray(post?.sourceReferences)
      ? post.sourceReferences
    : Array.isArray(post?.references)
      ? post.references
      : [];

  return values.flatMap((source, index) => {
    if (typeof source === "string") {
      const url = safeExternalUrl(source);
      return url ? [{ title: `Source ${index + 1}`, url, publisher: "" }] : [];
    }
    const url = safeExternalUrl(source?.url || source?.href);
    if (!url) return [];
    return [{
      title: source.title || source.name || `Source ${index + 1}`,
      url,
      publisher: source.publisher || source.siteName || "",
    }];
  });
}

function markdownBody(post) {
  for (const value of [post?.contentMarkdown, post?.content, post?.body]) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function readingTime(value) {
  if (!value) return "";
  return typeof value === "number" ? `${value} min read` : value;
}

function articleHref(href) {
  if (typeof href !== "string") return href;
  const match = href.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:[?#].*)?$/i);
  return match ? `/${match[1].toLowerCase()}` : href;
}

function safeJsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

async function loadArticle(rawSlug) {
  const normalized = normalizeSlug(rawSlug);
  if (String(rawSlug) !== normalized) {
    permanentRedirect(`/${encodeURIComponent(normalized)}`);
  }

  try {
    const result = await getBlogPost(normalized);
    if (result.redirectTo) {
      permanentRedirect(`/${encodeURIComponent(result.redirectTo)}`);
    }

    const postSlug = normalizeSlug(result.post?.slug || normalized);
    if (postSlug !== normalized) {
      permanentRedirect(`/${encodeURIComponent(postSlug)}`);
    }
    return result.post;
  } catch (error) {
    if (error instanceof BlogNotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  const normalized = normalizeSlug(slug);
  if (query && Object.keys(query).length > 0) {
    permanentRedirect(`/${encodeURIComponent(normalized)}`);
  }
  const post = await loadArticle(slug);
  const author = authorDetails(post);
  const image = imageDetails(post);
  const canonical = canonicalPostUrl(post);
  const description =
    post.metaDescription || post.excerpt || "Practical guidance for small business owners.";
  const ogTitle = post.openGraph?.title || post.ogTitle || post.metaTitle || post.title;
  const ogDescription =
    post.openGraph?.description || post.ogDescription || description;
  const ogImage = post.openGraph?.image || post.ogImage || image?.url;
  const noindex = post.noindex === true || post.robots?.index === false;

  return {
    title: post.metaTitle || post.title,
    description,
    alternates: { canonical },
    authors: [{ name: author.name, ...(author.url ? { url: author.url } : {}) }],
    robots: {
      index: !noindex,
      follow: !noindex,
      googleBot: { index: !noindex, follow: !noindex },
    },
    openGraph: {
      type: "article",
      url: canonical,
      title: ogTitle,
      description: ogDescription,
      siteName: "WorkSteady",
      publishedTime: validDate(post.publishedAt)?.toISOString(),
      modifiedTime: validDate(post.updatedAt || post.modifiedAt)?.toISOString(),
      authors: [author.name],
      section: post.category,
      images: ogImage
        ? [{
            url: ogImage,
            ...(image && ogImage === image.url
              ? { width: image.width, height: image.height, alt: image.alt }
              : {}),
          }]
        : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: post.metaTitle || post.title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function ArticlePage({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  const normalized = normalizeSlug(slug);

  if (query && Object.keys(query).length > 0) {
    permanentRedirect(`/${encodeURIComponent(normalized)}`);
  }

  const post = await loadArticle(slug);
  const author = authorDetails(post);
  const image = imageDetails(post);
  const sources = sourceDetails(post);
  const content = markdownBody(post);
  const canonical = canonicalPostUrl(post);
  const publishedIso = validDate(post.publishedAt)?.toISOString();
  const modifiedIso = validDate(post.updatedAt || post.modifiedAt)?.toISOString();
  const related = (Array.isArray(post.relatedPosts) ? post.relatedPosts : [])
    .filter((item) => item?.slug && item?.title && normalizeSlug(item.slug) !== normalized)
    .slice(0, 3);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": post.schemaType === "Article" ? "Article" : "BlogPosting",
    headline: post.title,
    description: post.excerpt || post.metaDescription,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    datePublished: publishedIso,
    dateModified: modifiedIso || publishedIso,
    author: author.name === "WorkSteady Editorial Team"
      ? { "@type": "Organization", name: "WorkSteady", url: "https://worksteady.app/" }
      : { "@type": "Person", name: author.name, ...(author.url ? { url: author.url } : {}) },
    publisher: {
      "@type": "Organization",
      name: "WorkSteady",
      url: "https://worksteady.app/",
    },
    image: image
      ? {
          "@type": "ImageObject",
          url: image.url,
          width: image.width,
          height: image.height,
          caption: image.alt || undefined,
        }
      : undefined,
    articleSection: post.category,
    isAccessibleForFree: true,
    citation: sources.map((source) => source.url),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://worksteady.app/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://worksteady.app/blog",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: canonical,
      },
    ],
  };

  return (
    <main className={styles.main}>
      <article className={styles.article}>
        <header className={styles.header}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/blog">Blog</Link>
            <span aria-hidden="true">/</span>
            <span className={styles.breadcrumbCurrent} aria-current="page">{post.title}</span>
          </nav>
          {post.category && <div className={`eyebrow ${styles.category}`}>{post.category}</div>}
          <h1 className={styles.title}>{post.title}</h1>
          {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
          <div className={styles.byline}>
            <span>By <strong>{author.name}</strong></span>
            {publishedIso && (
              <span>
                Published <time dateTime={publishedIso}>{formatDate(post.publishedAt)}</time>
              </span>
            )}
            {modifiedIso && modifiedIso !== publishedIso && (
              <span>
                Updated <time dateTime={modifiedIso}>{formatDate(post.updatedAt || post.modifiedAt)}</time>
              </span>
            )}
            {post.readingTime && <span>{readingTime(post.readingTime)}</span>}
          </div>
        </header>

        {image && (
          <Image
            src={image.url}
            alt={image.alt}
            width={image.width}
            height={image.height}
            className={styles.heroImage}
            sizes="(max-width: 1168px) calc(100vw - 48px), 1120px"
            priority
          />
        )}

        <div className={styles.bodyGrid}>
          <div className={styles.prose}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node: _node, ...props }) => <h2 {...props} />,
                a: ({ node: _node, href, ...props }) => {
                  const normalizedHref = articleHref(href);
                  const external =
                    typeof normalizedHref === "string" &&
                    /^https?:\/\//i.test(normalizedHref);
                  return (
                    <a
                      href={normalizedHref}
                      {...props}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    />
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>

          <aside className={styles.aside} aria-label="Editorial disclosure">
            <span className={styles.asideLabel}>How this was made</span>
            This article was generated and published through WorkSteady&apos;s automated
            editorial workflow. Review the cited sources and use professional judgment
            before acting on legal, tax, or financial topics.
          </aside>
        </div>

        {sources.length > 0 && (
          <section className={styles.references} aria-labelledby="sources-heading">
            <h2 className={styles.referencesTitle} id="sources-heading">Sources</h2>
            <ol className={styles.sourceList}>
              {sources.map((source) => (
                <li key={source.url}>
                  <a
                    className={styles.sourceLink}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title}
                  </a>
                  {source.publisher && (
                    <span className={styles.sourcePublisher}> — {source.publisher}</span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className={`cta-band ${styles.cta}`} aria-labelledby="article-cta-heading">
          <div className={styles.ctaInner}>
            <div>
              <div className="eyebrow">Your next move</div>
              <h2 className={styles.ctaTitle} id="article-cta-heading">
                Get a direct answer for your business.
              </h2>
              <p className={styles.ctaCopy}>
                Tell WorkSteady what is happening and get one practical action you can take today.
              </p>
            </div>
            <Link href="/chat" className="btn btn-primary">Ask WorkSteady →</Link>
          </div>
        </section>
      </article>

      {related.length > 0 && (
        <section className={styles.related} aria-labelledby="related-heading">
          <div className="container">
            <div className={styles.relatedHead}>
              <div className="eyebrow">Keep reading</div>
              <h2 className={styles.relatedTitle} id="related-heading">Related guidance</h2>
            </div>
            <div className={styles.relatedGrid}>
              {related.map((item) => <BlogCard key={item.slug} post={item} />)}
            </div>
          </div>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
    </main>
  );
}
