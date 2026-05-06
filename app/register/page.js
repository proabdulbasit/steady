"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoldButton } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";
import { INDUSTRY_OPTIONS } from "../../lib/industry-prompts";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, profileLoading } = useSteady();
  const [form, setForm] = useState({ name: "", email: "", password: "", industry: "restaurant" });
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
      await register(form);
      router.push("/pricing");
    } catch (err) {
      setError(err.message || "Unable to register.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ padding: "64px 24px 96px" }}>
      <div className="auth-split">
        <aside className="auth-side">
          <div>
            <div className="eyebrow" style={{ color: "var(--gold-2)", marginBottom: 14 }}>Create your account</div>
            <h1 className="h2 serif" style={{ color: "var(--on-feature)", margin: "0 0 14px" }}>
              Steady — built around your business, not a browser session.
            </h1>
            <p style={{ color: "var(--on-feature-2)", margin: 0, fontSize: 15, lineHeight: 1.6 }}>
              An account keeps your subscription, daily usage and saved chats attached to you across every device.
            </p>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 28 }}>
            {["Personal profile and plan", "Saved usage stats", "Stripe-linked billing", "Industry-aware answers from day one"].map((i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--on-feature-2)", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--gold-2)" }}>✓</span> {i}
              </div>
            ))}
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 36 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Register</div>
          <h2 className="h3 serif" style={{ margin: "0 0 22px" }}>Get started in under a minute</h2>

          <label className="label" htmlFor="name">Full name</label>
          <input id="name" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Jane Owner" className="input" style={{ marginBottom: 12 }} />

          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="you@business.com" className="input" style={{ marginBottom: 12 }} />

          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} placeholder="At least 8 characters" className="input" style={{ marginBottom: 12 }} />

          <label className="label" htmlFor="industry">Industry</label>
          <select id="industry" value={form.industry} onChange={(e) => setForm((c) => ({ ...c, industry: e.target.value }))} className="input select" style={{ appearance: "none", cursor: "pointer", marginBottom: 14 }}>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>

          {error && (
            <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 14 }}>
              {error}
            </div>
          )}

          <GoldButton type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Creating account..." : "Create account →"}
          </GoldButton>

          <div style={{ marginTop: 16, color: "var(--ink-3)", fontSize: 14, textAlign: "center" }}>
            Already have an account? <Link href="/login" style={{ color: "var(--gold)", fontWeight: 600 }}>Sign in</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
