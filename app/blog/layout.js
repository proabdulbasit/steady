import BlogHero from "./blog-hero";
import styles from "./blog.module.css";

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

export default function BlogLayout({ children }) {
  return (
    <main className={styles.main}>
      <BlogHero />
      <section className={styles.section} aria-labelledby="latest-heading">
        <div className="container">
          <h2 className={styles.srOnly} id="latest-heading">Latest articles</h2>
          {children}
        </div>
      </section>
    </main>
  );
}
