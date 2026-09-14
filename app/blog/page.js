import { Suspense } from "react";
import BlogFeed, { BlogCardSkeletonGrid } from "../../components/blog-feed";
import { getBlogPosts } from "../../lib/blog-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parsePage(value) {
  const page = Number.parseInt(String(value || "1"), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

async function BlogFeedSection({ page }) {
  const result = await getBlogPosts({ limit: 9, page });
  const validPosts = result.posts.filter((post) => post?.slug && post?.title);
  return (
    <BlogFeed
      initialPosts={validPosts}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
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
