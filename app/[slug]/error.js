"use client";

import Link from "next/link";
import styles from "../blog/states.module.css";

export default function ArticleError({ reset }) {
  return (
    <main className={styles.state}>
      <div className={styles.panel}>
        <div className="eyebrow">Connection problem</div>
        <h1 className={styles.title}>This article could not be loaded.</h1>
        <p className={styles.copy}>
          The article service is temporarily unavailable. Try again without leaving this page.
        </p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/blog" className="btn btn-ghost">Browse the journal</Link>
        </div>
      </div>
    </main>
  );
}
