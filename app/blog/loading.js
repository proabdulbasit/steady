import styles from "./states.module.css";

export default function BlogLoading() {
  return (
    <main className={styles.state} aria-busy="true" aria-label="Loading articles">
      <div className={styles.skeleton}>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonCard} />
      </div>
    </main>
  );
}
