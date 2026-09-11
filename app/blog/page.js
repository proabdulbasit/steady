import BlogFeed from "../../components/blog-feed";
import { getBlogPosts } from "../../lib/blog-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BlogPage() {
  const { posts, nextCursor } = await getBlogPosts({ limit: 9 });
  const validPosts = posts.filter((post) => post?.slug && post?.title);
  return <BlogFeed initialPosts={validPosts} initialCursor={nextCursor} />;
}
