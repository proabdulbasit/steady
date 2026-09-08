import styles from "../blog/states.module.css";

export default function ArticleLoading() {
  return (
    <main className={styles.state} aria-busy="true" aria-label="Loading article">
      <div className={styles.skeleton}>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonCard} />
      </div>
    </main>
  );
}
