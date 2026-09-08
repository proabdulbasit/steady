"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./blog-feed.module.css";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function imageProps(post) {
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

export function BlogCard({ post, featured = false }) {
  const image = imageProps(post);
  const date = formatDate(post.publishedAt);
  const href = `/${encodeURIComponent(String(post.slug || "").toLowerCase())}`;

  return (
    <article className={featured ? styles.featuredCard : styles.card}>
      <Link
        href={href}
        className={featured ? styles.featuredImageLink : styles.imageLink}
        aria-label={`Read ${post.title}`}
      >
        {image ? (
          <Image
            {...image}
            className={styles.image}
            sizes={featured ? "(max-width: 860px) 100vw, 56vw" : "(max-width: 760px) 100vw, 33vw"}
            priority={featured}
          />
        ) : (
          <span className={styles.imageFallback} aria-hidden="true">W</span>
        )}
      </Link>

      <div className={featured ? styles.featuredBody : styles.cardBody}>
        <div className={styles.meta}>
          {post.category && <span className={styles.category}>{post.category}</span>}
          {date && <time dateTime={post.publishedAt}>{date}</time>}
          {post.readingTime && <span>{readingTime(post.readingTime)}</span>}
        </div>
        {featured ? (
          <h2 className={styles.featuredTitle}>
            <Link href={href}>{post.title}</Link>
          </h2>
        ) : (
          <h3 className={styles.cardTitle}>
            <Link href={href}>{post.title}</Link>
          </h3>
        )}
        {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
        <Link href={href} className={styles.readLink} aria-label={`Read ${post.title}`}>
          Read article <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
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
      setCursor(typeof data.nextCursor === "string" ? data.nextCursor : null);
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
            {loading ? "Loading…" : "Load more articles"}
          </button>
        )}
      </div>
    </>
  );
}
