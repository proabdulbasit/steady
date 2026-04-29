"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell, GoldButton } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completePasswordReset, isAuthenticated, profileLoading } = useSteady();
  const token = searchParams.get("token")?.trim() || "";
  const email = searchParams.get("email")?.trim() || "";
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

  async function handleSubmit() {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token || !email) {
      setError("This reset link is missing required information.");
      return;
    }

    setLoading(true);
    try {
      await completePasswordReset({ email, token, password });
      router.push("/profile");
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  const missingParams = !token || !email;

  return (
    <>
      <div style={authCard}>
        <input value={email} disabled placeholder="Email" style={{ ...inputStyle, opacity: 0.85 }} />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          style={inputStyle}
          autoComplete="new-password"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          style={inputStyle}
          autoComplete="new-password"
        />
        {missingParams && (
          <div style={errorStyle}>
            This reset link looks incomplete. Open the link from your email again, or request a new one.
          </div>
        )}
        {error && <div style={errorStyle}>{error}</div>}
        <GoldButton
          onClick={handleSubmit}
          disabled={loading || missingParams}
          style={{ width: "100%", minHeight: "48px" }}
        >
          {loading ? "Saving..." : "Set new password"}
        </GoldButton>
        <div style={{ marginTop: "14px", color: "#6A6058", fontSize: "14px", textAlign: "center" }}>
          <Link href="/forgot-password" style={{ color: "#C8A96E" }}>
            Request another link
          </Link>
          {" · "}
          <Link href="/login" style={{ color: "#C8A96E" }}>
            Sign in
          </Link>
        </div>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <PageShell
      center
      eyebrow="Password"
      title="Choose a new password"
      description="Pick a password you do not use on other apps. After saving, we will keep you signed in."
    >
      <div style={{ width: "100%", maxWidth: "440px", margin: "0 auto" }}>
        <Suspense
          fallback={
            <div style={{ ...authCard, color: "#6A6058", fontSize: "14px" }}>Loading reset form...</div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
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
