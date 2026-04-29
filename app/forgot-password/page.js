"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell, GoldButton } from "../../components/steady-ui";
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

  async function handleSubmit() {
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
    <PageShell
      center
      eyebrow="Password"
      title="Forgot your password?"
      description="Enter the email on your Steady account. If we find it, we will send you a secure link to set a new password."
    >
      <div style={{ width: "100%", maxWidth: "440px", margin: "0 auto" }}>
        <div style={authCard}>
          {done ? (
            <>
              <p style={{ fontSize: "15px", color: "#D4C9B8", lineHeight: "1.6", margin: "0 0 16px" }}>
                If an account exists for that email address, check your inbox for a reset link. It may take a minute to arrive.
              </p>
              <GoldButton onClick={() => router.push("/login")} style={{ width: "100%", minHeight: "48px" }}>
                Back to sign in
              </GoldButton>
            </>
          ) : (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                style={inputStyle}
                autoComplete="email"
              />
              {error && <div style={errorStyle}>{error}</div>}
              <GoldButton onClick={handleSubmit} disabled={loading} style={{ width: "100%", minHeight: "48px" }}>
                {loading ? "Sending..." : "Send reset link"}
              </GoldButton>
              <div style={{ marginTop: "14px", color: "#6A6058", fontSize: "14px", textAlign: "center" }}>
                <Link href="/login" style={{ color: "#C8A96E" }}>
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}

const authCard = {
  padding: "24px",
  background: "#15120E",
  border: "1px solid #252018",
  borderRadius: "16px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "#191510",
  border: "1px solid #2A2520",
  borderRadius: "10px",
  padding: "12px 14px",
  color: "#E8DFD0",
  fontSize: "14px",
  fontFamily: "inherit",
  marginBottom: "10px",
};
const errorStyle = {
  background: "rgba(229,115,115,0.08)",
  border: "1px solid rgba(229,115,115,0.25)",
  color: "#F1B1B1",
  borderRadius: "12px",
  padding: "12px 14px",
  marginBottom: "10px",
};
