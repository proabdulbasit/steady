import { Suspense } from "react";
import BlogFeed, { BlogCardSkeletonGrid } from "../../components/blog-feed";
import { BlogBackendError, getBlogPosts } from "../../lib/blog-server";
import BlogUnavailable from "./blog-unavailable";

export const revalidate = 120;

function parsePage(value) {
  const page = Number.parseInt(String(value || "1"), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

async function BlogFeedSection({ page }) {
  try {
    const result = await getBlogPosts({ limit: 9, page, allowCdnFallback: true });
    const validPosts = result.posts.filter((post) => post?.slug && post?.title);
    return (
      <BlogFeed
        initialPosts={validPosts}
        page={result.page}
        totalPages={result.totalPages}
      />
    );
  } catch (error) {
    if (error instanceof BlogBackendError) {
      console.error("[blog] Listing unavailable:", error.message);
      return <BlogUnavailable />;
    }
    throw error;
  }
}

export default async function BlogPage({ searchParams }) {
  const params = await searchParams;
  const page = parsePage(params?.page);

  return (
    <Suspense fallback={<BlogCardSkeletonGrid count={6} />}>
      <BlogFeedSection page={page} />
    </Suspense>
  );
}
