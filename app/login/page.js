"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoldButton } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, profileLoading } = useSteady();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profileLoading) return;
    if (isAuthenticated) router.replace("/pricing");
  }, [isAuthenticated, profileLoading, router]);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setLoading(true);
    setError("");
    try {
      await login(form);
      router.push("/pricing");
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ padding: "64px 24px 96px" }}>
      <div className="auth-split">
        <aside className="auth-side">
          <div>
            <div className="eyebrow" style={{ color: "var(--gold-2)", marginBottom: 14 }}>Welcome back</div>
            <h1 className="h2 serif" style={{ color: "#F1E7D7", margin: "0 0 14px" }}>
              Sign back in to your Steady account.
            </h1>
            <p style={{ color: "rgba(241,231,215,0.78)", margin: 0, fontSize: 15, lineHeight: 1.6 }}>
              Your plan, profile, daily usage and billing all live here — across every device.
            </p>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 28 }}>
            {["Profile with plan details", "Daily usage tracking", "Stripe-managed billing", "Admin access where granted"].map((i) => (
              <div key={i} style={{ fontSize: 13, color: "rgba(241,231,215,0.85)", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--gold-2)" }}>✓</span> {i}
              </div>
            ))}
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 36 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Sign in</div>
          <h2 className="h3 serif" style={{ margin: "0 0 22px" }}>Open your account</h2>

          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="you@business.com" className="input" style={{ marginBottom: 14 }} />

          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} placeholder="••••••••" className="input" style={{ marginBottom: 8 }} />

          <div style={{ textAlign: "right", marginBottom: 14 }}>
            <Link href="/forgot-password" style={{ color: "var(--ink-3)", fontSize: 13 }}>Forgot password?</Link>
          </div>

          {error && (
            <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 14 }}>
              {error}
            </div>
          )}

          <GoldButton type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in..." : "Sign in →"}
          </GoldButton>

          <div style={{ marginTop: 16, color: "var(--ink-3)", fontSize: 14, textAlign: "center" }}>
            New to Steady? <Link href="/register" style={{ color: "var(--gold)", fontWeight: 600 }}>Create an account</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
