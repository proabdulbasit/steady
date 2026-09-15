import Link from "next/link";
import styles from "./states.module.css";

export default function BlogUnavailable() {
  return (
    <div className={styles.panel} style={{ margin: "0 auto" }}>
      <div className="eyebrow">Connection problem</div>
      <h2 className={styles.title} style={{ fontSize: "clamp(26px, 4vw, 36px)" }}>
        The journal is temporarily unavailable.
      </h2>
      <p className={styles.copy}>
        We could not reach the article service. This is not a missing page; please try again in a moment.
      </p>
      <div className={styles.actions}>
        <Link href="/blog" className="btn btn-primary">
          Try again
        </Link>
        <Link href="/" className="btn btn-ghost">
          Back home
        </Link>
      </div>
    </div>
  );
}
