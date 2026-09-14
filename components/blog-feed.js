"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { blogPageHref, visiblePageItems } from "../lib/blog-pagination";
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

function BlogPagination({ page, totalPages }) {
  const router = useRouter();
  const items = visiblePageItems(page, totalPages);
  const previousHref = blogPageHref(page - 1);
  const nextHref = blogPageHref(page + 1);

  function jumpToPage(event) {
    const nextPage = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(nextPage)) return;
    router.push(blogPageHref(nextPage));
  }

  return (
    <nav className={styles.pager} aria-label="Blog pages">
      <div className={styles.pagerRow}>
        {page <= 1 ? (
          <span className={`${styles.pagerNav} ${styles.pagerDisabled}`}>
            <span className={styles.pagerNavIcon} aria-hidden="true">‹</span>
            <span className={styles.pagerNavText}>Previous</span>
          </span>
        ) : (
          <Link href={previousHref} className={styles.pagerNav} aria-label="Previous page">
            <span className={styles.pagerNavIcon} aria-hidden="true">‹</span>
            <span className={styles.pagerNavText}>Previous</span>
          </Link>
        )}

        <ol className={styles.pagerPages}>
          {items.map((item, index) => (
            item === "ellipsis" ? (
              <li key={`ellipsis-${index}`} className={styles.pagerEllipsis} aria-hidden="true">…</li>
            ) : (
              <li key={item}>
                {item === page ? (
                  <span className={`${styles.pagerPage} ${styles.pagerCurrent}`} aria-current="page">
                    {item}
                  </span>
                ) : (
                  <Link href={blogPageHref(item)} className={styles.pagerPage}>
                    {item}
                  </Link>
                )}
              </li>
            )
          ))}
        </ol>

        {page >= totalPages ? (
          <span className={`${styles.pagerNav} ${styles.pagerDisabled}`}>
            <span className={styles.pagerNavText}>Next</span>
            <span className={styles.pagerNavIcon} aria-hidden="true">›</span>
          </span>
        ) : (
          <Link href={nextHref} className={styles.pagerNav} aria-label="Next page">
            <span className={styles.pagerNavText}>Next</span>
            <span className={styles.pagerNavIcon} aria-hidden="true">›</span>
          </Link>
        )}
      </div>

      <label className={styles.pagerJump}>
        <span>Go to page</span>
        <select
          className={styles.pagerSelect}
          value={page}
          onChange={jumpToPage}
          aria-label="Go to page"
        >
          {Array.from({ length: totalPages }, (_, index) => (
            <option key={index + 1} value={index + 1}>{index + 1}</option>
          ))}
        </select>
        <span>of {totalPages}</span>
      </label>
    </nav>
  );
}

export default function BlogFeed({ initialPosts, page = 1, totalPages = 0 }) {
  return (
    <>
      {initialPosts.length > 0 ? (
        <div className={styles.grid}>
          {initialPosts.map((post) => <BlogCard key={post.slug} post={post} />)}
        </div>
      ) : (
        <p className={styles.empty}>More practical guidance is on the way.</p>
      )}

      {totalPages > 0 && initialPosts.length > 0 && (
        <BlogPagination page={page} totalPages={totalPages} />
      )}
    </>
  );
}
