"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageShell, GoldButton } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, profileLoading } = useSteady();
  const [form, setForm] = useState({ email: "", password: "" });
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
      await login(form);
      router.push("/pricing");
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell center eyebrow="Sign In" title="Open your Steady account" description="Your plan, profile, daily usage, and billing history live here.">
      <div className="auth-layout" style={{ width: "100%", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "18px", alignItems: "stretch" }}>
        <div style={panelStyle}>
          <div style={panelTitle}>Why sign in</div>
          <div style={panelText}>Keep your subscription attached to your account, see your daily usage, manage your plan, and access your personal profile from any device.</div>
          <div style={featureGrid}>
            {["Profile with plan details", "Daily question tracking", "Stripe billing management", "Business and admin access"].map((item) => (
              <div key={item} style={featureItem}>{item}</div>
            ))}
          </div>
        </div>
        <div style={authCard}>
          <input value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="Email" style={inputStyle} />
          <input type="password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} placeholder="Password" style={inputStyle} />
          <div style={{ textAlign: "right", marginBottom: "10px" }}>
            <Link href="/forgot-password" style={{ color: "#8A8068", fontSize: "13px" }}>
              Forgot password?
            </Link>
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <GoldButton onClick={handleSubmit} disabled={loading} style={{ width: "100%", minHeight: "48px" }}>{loading ? "Signing in..." : "Sign In"}</GoldButton>
          <div style={{ marginTop: "14px", color: "#6A6058", fontSize: "14px" }}>Need an account? <Link href="/register" style={{ color: "#C8A96E" }}>Register</Link></div>
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
