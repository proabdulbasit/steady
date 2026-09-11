import BlogFeed from "../../components/blog-feed";
import { getBlogPosts } from "../../lib/blog-server";
import styles from "./blog.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Small Business Advice",
  description:
    "Practical, plain-spoken guidance for small business owners—from pricing and cash flow to hiring, customers, and day-to-day operations.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "WorkSteady Small Business Advice",
    description:
      "Useful answers and clear next moves for people running real businesses.",
    url: "/blog",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WorkSteady Small Business Advice",
    description:
      "Useful answers and clear next moves for people running real businesses.",
  },
};

export default async function BlogPage() {
  const { posts, nextCursor } = await getBlogPosts({ limit: 9 });
  const validPosts = posts.filter((post) => post?.slug && post?.title);

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroInner}>
            <div className={`eyebrow ${styles.eyebrow}`}>The WorkSteady journal</div>
            <h1 className={styles.title}>Insights &amp; articles</h1>
            <p className={styles.lede}>
              Practical guidance for small-business owners—from cash flow and hiring
              to the decisions you make every day.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="latest-heading">
        <div className="container">
          <h2 className={styles.srOnly} id="latest-heading">Latest articles</h2>
          <BlogFeed initialPosts={validPosts} initialCursor={nextCursor} />
        </div>
      </section>
    </main>
  );
}
