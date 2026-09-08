"use client";

import Link from "next/link";
import styles from "./states.module.css";

export default function BlogError({ reset }) {
  return (
    <main className={styles.state}>
      <div className={styles.panel}>
        <div className="eyebrow">Connection problem</div>
        <h1 className={styles.title}>The journal is temporarily unavailable.</h1>
        <p className={styles.copy}>
          We could not reach the article service. This is not a missing page; please try again.
        </p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">Back home</Link>
        </div>
      </div>
    </main>
  );
}
