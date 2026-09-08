import BlogFeed, { BlogCard } from "../../components/blog-feed";
import { getBlogPosts } from "../../lib/blog-server";
import styles from "./blog.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 900;

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
  const { posts, nextCursor } = await getBlogPosts({ limit: 10 });
  const validPosts = posts.filter((post) => post?.slug && post?.title);
  const featured =
    validPosts.find((post) => post.featured === true) || validPosts[0] || null;
  const remaining = featured
    ? validPosts.filter((post) => post.slug !== featured.slug)
    : validPosts;

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroInner}>
            <div className={`eyebrow ${styles.eyebrow}`}>The WorkSteady journal</div>
            <h1 className={styles.title}>
              Practical answers for{" "}
              <span className={styles.titleAccent}>real business owners.</span>
            </h1>
            <p className={styles.lede}>
              No corporate filler. Just useful guidance, grounded sources, and a clear
              next move for the people doing the work.
            </p>
          </div>
        </div>
      </section>

      {featured && (
        <section className={styles.featuredSection} aria-labelledby="featured-heading">
          <div className="container">
            <div className="eyebrow" id="featured-heading">Featured guidance</div>
            <BlogCard post={featured} featured />
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="latest-heading">
        <div className="container">
          <div className={styles.sectionHead}>
            <div>
              <div className="eyebrow">Latest articles</div>
              <h2 className={styles.sectionTitle} id="latest-heading">Keep your business moving.</h2>
            </div>
            <p className={styles.sectionCopy}>
              Fresh, focused guidance on the decisions small business owners face every day.
            </p>
          </div>
          <BlogFeed initialPosts={remaining} initialCursor={nextCursor} />
        </div>
      </section>
    </main>
  );
}
