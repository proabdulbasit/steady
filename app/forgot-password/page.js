"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoldButton } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword, isAuthenticated, profileLoading } = useSteady();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profileLoading) return;
    if (isAuthenticated) {
      router.replace("/profile");
    }
  }, [isAuthenticated, profileLoading, router]);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setLoading(true);
    setError("");
    try {
      await forgotPassword(email.trim());
      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ padding: "64px 24px 96px" }}>
      <div className="auth-split">
        <aside className="auth-side">
          <div>
            <div className="eyebrow" style={{ color: "var(--gold-2)", marginBottom: 14 }}>
              Password
            </div>
            <h1 className="h2 serif" style={{ color: "var(--on-feature)", margin: "0 0 14px" }}>
              Forgot your password?
            </h1>
            <p style={{ color: "var(--on-feature-2)", margin: 0, fontSize: 15, lineHeight: 1.6 }}>
              Enter the email on your Steady account. If we find it, we will send you a secure link to set a new password.
            </p>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 28 }}>
            {["Reset links expire for your security", "Check spam if you do not see the email", "Use the same email you use to sign in"].map((i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--on-feature-2)", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--gold-2)" }}>✓</span> {i}
              </div>
            ))}
          </div>
        </aside>

        {done ? (
          <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 36 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Check your inbox</div>
            <h2 className="h3 serif" style={{ margin: "0 0 22px" }}>Reset link sent</h2>
            <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 22px" }}>
              If an account exists for that email address, check your inbox for a reset link. It may take a minute to arrive.
            </p>
            <GoldButton type="button" onClick={() => router.push("/login")} style={{ width: "100%" }}>
              Back to sign in →
            </GoldButton>
            <div style={{ marginTop: 16, color: "var(--ink-3)", fontSize: 14, textAlign: "center" }}>
              Wrong email?{" "}
              <button
                type="button"
                onClick={() => {
                  setDone(false);
                  setEmail("");
                }}
                style={{
                  color: "var(--gold)",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  textDecoration: "underline",
                }}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 36 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Reset</div>
            <h2 className="h3 serif" style={{ margin: "0 0 22px" }}>Send a reset link</h2>

            <label className="label" htmlFor="fp-email">
              Email
            </label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              className="input"
              style={{ marginBottom: 14 }}
            />

            {error ? (
              <div
                style={{
                  background: "var(--danger-soft)",
                  border: "1px solid var(--danger)",
                  color: "var(--danger)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  marginBottom: 12,
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            ) : null}

            <GoldButton type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Sending..." : "Send reset link →"}
            </GoldButton>

            <div style={{ marginTop: 16, color: "var(--ink-3)", fontSize: 14, textAlign: "center" }}>
              <Link href="/login" style={{ color: "var(--gold)", fontWeight: 600 }}>
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
