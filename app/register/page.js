"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageShell, GoldButton } from "../../components/steady-ui";
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
    if (isAuthenticated) {
      router.replace("/pricing");
    }
  }, [isAuthenticated, profileLoading, router]);

  async function handleSubmit() {
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
    <PageShell center eyebrow="Register" title="Create your Steady account" description="Use a real account so subscriptions and usage tracking stay attached to you, not one browser session.">
      <div className="auth-layout" style={{ width: "100%", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "18px", alignItems: "stretch" }}>
        <div style={panelStyle}>
          <div style={panelTitle}>What you get</div>
          <div style={panelText}>A professional account structure with saved profile, persistent subscription state, plan controls, and access to premium tools when you upgrade.</div>
          <div style={featureGrid}>
            {["Personal profile page", "Saved plan and usage stats", "Stripe-linked account billing", "Business integrations on the right plan"].map((item) => (
              <div key={item} style={featureItem}>{item}</div>
            ))}
          </div>
        </div>
        <div style={authCard}>
          <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Full name" style={inputStyle} />
          <input value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="Email" style={inputStyle} />
          <input type="password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} placeholder="Password" style={inputStyle} />
          <select
            value={form.industry}
            onChange={(e) => setForm((c) => ({ ...c, industry: e.target.value }))}
            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
            aria-label="Industry"
          >
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          {error && <div style={errorStyle}>{error}</div>}
          <GoldButton onClick={handleSubmit} disabled={loading} style={{ width: "100%", minHeight: "48px" }}>{loading ? "Creating account..." : "Create Account"}</GoldButton>
          <div style={{ marginTop: "14px", color: "#6A6058", fontSize: "14px" }}>Already have an account? <Link href="/login" style={{ color: "#C8A96E" }}>Sign in</Link></div>
        </div>
      </div>
      <style>{responsiveAuthCss}</style>
    </PageShell>
  );
}

const authCard = { padding: "24px", background: "#15120E", border: "1px solid #252018", borderRadius: "16px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "#191510", border: "1px solid #2A2520", borderRadius: "10px", padding: "12px 14px", color: "#E8DFD0", fontSize: "14px", fontFamily: "inherit", marginBottom: "10px" };
const errorStyle = { background: "rgba(229,115,115,0.08)", border: "1px solid rgba(229,115,115,0.25)", color: "#F1B1B1", borderRadius: "12px", padding: "12px 14px", marginBottom: "10px" };
const panelStyle = { background: "#15120E", border: "1px solid #252018", borderRadius: "16px", padding: "24px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" };
const panelTitle = { fontSize: "24px", color: "#E8DFD0", marginBottom: "10px" };
const panelText = { fontSize: "14px", color: "#6A6058", lineHeight: "1.7", marginBottom: "18px" };
const featureGrid = { display: "grid", gap: "10px" };
const featureItem = { background: "#191510", border: "1px solid #2A2520", borderRadius: "12px", padding: "14px", color: "#D4C9B8", fontSize: "14px" };
const responsiveAuthCss = `
  @media (max-width: 900px) {
    .auth-layout {
      grid-template-columns: 1fr !important;
    }
  }
`;
