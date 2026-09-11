"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./blog-feed.module.css";

export function formatPostDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function postImage(post) {
  const image =
    post?.featuredImage && typeof post.featuredImage === "object"
      ? post.featuredImage
      : null;
  const src = typeof post?.featuredImage === "string"
    ? post.featuredImage
    : image?.url;
  const width = Number(post?.featuredImageWidth || image?.width);
  const height = Number(post?.featuredImageHeight || image?.height);
  if (
    typeof src !== "string" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return { src, width, height, alt: post.featuredImageAlt || image?.alt || "" };
}

function readingTime(value) {
  if (!value) return "";
  return typeof value === "number" ? `${value} min read` : value;
}

function postHref(post) {
  return `/${encodeURIComponent(String(post.slug || "").toLowerCase())}`;
}

export function BlogCardSkeleton() {
  return (
    <article className={`${styles.card} ${styles.skeletonCard}`} aria-hidden="true">
      <div className={`${styles.imageLink} ${styles.skeletonBlock}`} />
      <div className={styles.cardBody}>
        <div className={styles.skeletonMeta}>
          <span className={`${styles.skeletonLine} ${styles.skeletonDate}`} />
          <span className={`${styles.skeletonLine} ${styles.skeletonReadTime}`} />
        </div>
        <span className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
        <span className={`${styles.skeletonLine} ${styles.skeletonTitleShort}`} />
        <span className={`${styles.skeletonLine} ${styles.skeletonExcerpt}`} />
        <span className={`${styles.skeletonLine} ${styles.skeletonExcerptMid}`} />
        <span className={`${styles.skeletonLine} ${styles.skeletonLink}`} />
      </div>
    </article>
  );
}

export function BlogCardSkeletonGrid({ count = 6 }) {
  return (
    <div className={styles.grid} aria-busy="true" aria-label="Loading articles">
      {Array.from({ length: count }, (_, index) => (
        <BlogCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function BlogCard({ post }) {
  const image = postImage(post);
  const date = formatPostDate(post.publishedAt);
  const href = postHref(post);

  return (
    <article className={styles.card}>
      <Link href={href} className={styles.imageLink} aria-label={`Read ${post.title}`}>
        {image ? (
          <Image
            {...image}
            className={styles.image}
            sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
          />
        ) : (
          <span className={styles.imageFallback} aria-hidden="true">W</span>
        )}
      </Link>

      <div className={styles.cardBody}>
        <div className={styles.meta}>
          {date && <time dateTime={post.publishedAt}>{date}</time>}
          {post.readingTime && <span>{readingTime(post.readingTime)}</span>}
        </div>
        <h3 className={styles.cardTitle}>
          <Link href={href}>{post.title}</Link>
        </h3>
        {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
        <Link href={href} className={styles.readLink}>
          Read more <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

export function TrendingPost({ post }) {
  const image = postImage(post);
  const href = postHref(post);

  return (
    <Link href={href} className={styles.trendingItem}>
      {image ? (
        <Image
          {...image}
          className={styles.trendingImage}
          sizes="72px"
        />
      ) : (
        <span className={styles.trendingFallback} aria-hidden="true">W</span>
      )}
      <span className={styles.trendingTitle}>{post.title}</span>
    </Link>
  );
}

export default function BlogFeed({ initialPosts, initialCursor }) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/blog/posts?limit=9&cursor=${encodeURIComponent(cursor)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("Unable to load more articles");
      const data = await response.json();
      const seen = new Set(posts.map((post) => post.slug));
      const additions = Array.isArray(data.posts)
        ? data.posts.filter((post) => post?.slug && !seen.has(post.slug))
        : [];
      setPosts((current) => [...current, ...additions]);
      setCursor(typeof data.nextCursor === "string" ? data.nextCursor : data.pageInfo?.nextCursor || null);
    } catch {
      setError("More articles could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {posts.length > 0 ? (
        <div className={styles.grid}>
          {posts.map((post) => <BlogCard key={post.slug} post={post} />)}
          {loading && [0, 1, 2].map((index) => <BlogCardSkeleton key={`loading-${index}`} />)}
        </div>
      ) : (
        <p className={styles.empty}>More practical guidance is on the way.</p>
      )}

      <div className={styles.pagination} aria-live="polite">
        {error && <p className={styles.loadError}>{error}</p>}
        {cursor && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "Loading…" : "Next"}
          </button>
        )}
      </div>
    </>
  );
}
