"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GoldButton } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completePasswordReset, isAuthenticated, profileLoading } = useSteady();
  const token = searchParams.get("token")?.trim() || "";
  const emailParam = searchParams.get("email")?.trim() || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profileLoading) return;
    if (isAuthenticated) {
      router.replace("/profile");
    }
  }, [isAuthenticated, profileLoading, router]);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token || !emailParam) {
      setError("This reset link is missing required information.");
      return;
    }

    setLoading(true);
    try {
      await completePasswordReset({ email: emailParam, token, password });
      router.push("/profile");
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  const missingParams = !token || !emailParam;

  return (
    <div className="auth-split">
      <aside className="auth-side">
        <div>
          <div className="eyebrow" style={{ color: "var(--gold-2)", marginBottom: 14 }}>
            Password
          </div>
          <h1 className="h2 serif" style={{ color: "var(--on-feature)", margin: "0 0 14px" }}>
            Choose a new password
          </h1>
          <p style={{ color: "var(--on-feature-2)", margin: 0, fontSize: 15, lineHeight: 1.6 }}>
            Pick a password you do not use on other apps. After saving, we will keep you signed in.
          </p>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 28 }}>
          {["At least 6 characters", "Must match in both fields", "Reset links expire for your security"].map((i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--on-feature-2)", display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ color: "var(--gold-2)" }}>✓</span> {i}
            </div>
          ))}
        </div>
      </aside>

      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 36 }}
      >
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Reset
        </div>
        <h2 className="h3 serif" style={{ margin: "0 0 22px" }}>
          Set your new password
        </h2>

        <label className="label" htmlFor="rp-email">
          Email
        </label>
        <input
          id="rp-email"
          type="email"
          value={emailParam}
          disabled
          readOnly
          className="input"
          style={{ marginBottom: 14, opacity: 0.85 }}
        />

        <label className="label" htmlFor="rp-password">
          New password
        </label>
        <input
          id="rp-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="input"
          style={{ marginBottom: 14 }}
          autoComplete="new-password"
        />

        <label className="label" htmlFor="rp-confirm">
          Confirm new password
        </label>
        <input
          id="rp-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="input"
          style={{ marginBottom: 14 }}
          autoComplete="new-password"
        />

        {missingParams ? (
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
            This reset link looks incomplete. Open the link from your email again, or request a new one.
          </div>
        ) : null}

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

        <GoldButton type="submit" disabled={loading || missingParams} style={{ width: "100%" }}>
          {loading ? "Saving..." : "Set new password →"}
        </GoldButton>

        <div style={{ marginTop: 16, color: "var(--ink-3)", fontSize: 14, textAlign: "center" }}>
          <Link href="/forgot-password" style={{ color: "var(--gold)", fontWeight: 600 }}>
            Request another link
          </Link>
          {" · "}
          <Link href="/login" style={{ color: "var(--gold)", fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="container" style={{ padding: "64px 24px 96px" }}>
      <Suspense
        fallback={
          <div className="auth-split">
            <aside className="auth-side">
              <div className="eyebrow" style={{ color: "var(--gold-2)", marginBottom: 14 }}>
                Password
              </div>
              <h1 className="h2 serif" style={{ color: "var(--on-feature)", margin: "0 0 14px" }}>
                Choose a new password
              </h1>
              <p style={{ color: "var(--on-feature-2)", margin: 0, fontSize: 15 }}>Loading…</p>
            </aside>
            <div className="card" style={{ padding: 36, color: "var(--ink-3)", fontSize: 14 }}>
              Loading reset form…
            </div>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
