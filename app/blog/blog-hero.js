import styles from "./blog.module.css";

export default function BlogHero() {
  return (
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
  );
}
