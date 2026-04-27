"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoldButton, PageShell } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, profile, saveProfile, logout, profileLoading } = useSteady();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const isUnlimited = profile.questionsRemaining === null;

  useEffect(() => {
    setName(profile.name || "");
  }, [profile.name]);

  useEffect(() => {
    if (!profileLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [profileLoading, isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <PageShell eyebrow="Profile" title="Your account and plan" description="Manage your account details, view your current subscription, and monitor daily usage.">
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "16px" }}>
        <div style={cardStyle}>
          <div style={headingStyle}>Account</div>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          <input value={profile.email} disabled style={{ ...inputStyle, opacity: 0.7 }} />
          <div style={{ color: "#6A6058", marginBottom: "16px" }}>Role: {profile.role}</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <GoldButton
              onClick={async () => {
                setSaving(true);
                await saveProfile({ name });
                setSaving(false);
              }}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Profile"}
            </GoldButton>
            <button onClick={logout} style={secondaryButton}>Log Out</button>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={headingStyle}>Plan & Usage</div>
          <div style={statLine}><strong>{profile.planName}</strong></div>
          <div style={statLine}>Subscription: {profile.subscriptionStatus}</div>
          <div style={statLine}>Used today: {isUnlimited ? "Unlimited" : profile.questionsUsed}</div>
          <div style={statLine}>Remaining today: {isUnlimited ? "Unlimited" : profile.questionsRemaining}</div>
          <div style={statLine}>Connected integrations: {profile.integrations?.filter((item) => item.status === "connected").length || 0}</div>
          <GoldButton onClick={() => router.push("/pricing")} style={{ width: "100%", marginTop: "10px" }}>Manage Plan</GoldButton>
        </div>
      </div>
    </PageShell>
  );
}

const cardStyle = { background: "#15120E", border: "1px solid #252018", borderRadius: "18px", padding: "24px" };
const headingStyle = { fontSize: "22px", color: "#E8DFD0", marginBottom: "12px" };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "#191510", border: "1px solid #2A2520", borderRadius: "10px", padding: "12px 14px", color: "#E8DFD0", fontSize: "14px", fontFamily: "inherit", marginBottom: "10px" };
const statLine = { fontSize: "14px", color: "#D4C9B8", marginBottom: "8px" };
const secondaryButton = { background: "none", border: "1px solid #2A2520", color: "#8A7E70", borderRadius: "10px", padding: "14px 18px", cursor: "pointer", fontFamily: "inherit" };
