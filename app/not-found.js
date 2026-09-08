import Link from "next/link";
import styles from "./blog/states.module.css";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className={styles.state}>
      <div className={styles.panel}>
        <div className="eyebrow">404</div>
        <h1 className={styles.title}>That page is not here.</h1>
        <p className={styles.copy}>
          The address may have changed, or the article may no longer be available.
        </p>
        <div className={styles.actions}>
          <Link href="/blog" className="btn btn-primary">Browse the journal</Link>
          <Link href="/" className="btn btn-ghost">Back home</Link>
        </div>
      </div>
    </main>
  );
}
