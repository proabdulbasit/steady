"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoldButton, PageShell } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";
import { INDUSTRY_OPTIONS } from "../../lib/industry-prompts";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, profile, saveProfile, logout, profileLoading, changePassword, deleteAccount } = useSteady();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("restaurant");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");
  const isUnlimited = profile.questionsRemaining === null;

  useEffect(() => {
    setName(profile.name || "");
  }, [profile.name]);

  useEffect(() => {
    setIndustry(profile.industry || "restaurant");
  }, [profile.industry]);

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
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
          <input value={profile.email} disabled style={{ ...inputStyle, opacity: 0.7 }} />
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
            aria-label="Industry"
          >
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: "10px" }}>
            <GoldButton
              onClick={async () => {
                setSaving(true);
                await saveProfile({ name, industry });
                setSaving(false);
              }}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Profile"}
            </GoldButton>
            <button onClick={logout} style={secondaryButton}>Log Out</button>
          </div>
          <div style={{ marginTop: "22px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
            <div style={{ ...headingStyle, fontSize: "18px", marginBottom: "10px" }}>Password</div>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              style={inputStyle}
              autoComplete="current-password"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              style={inputStyle}
              autoComplete="new-password"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={inputStyle}
              autoComplete="new-password"
            />
            {pwdMsg && (
              <div
                style={{
                  ...(pwdMsg.startsWith("Error") ? errorStyle : successStyle),
                  marginBottom: "10px",
                }}
              >
                {pwdMsg}
              </div>
            )}
            <GoldButton
              onClick={async () => {
                setPwdMsg("");
                if (!currentPassword || !newPassword) {
                  setPwdMsg("Error: Fill in current and new passwords.");
                  return;
                }
                if (newPassword.length < 6) {
                  setPwdMsg("Error: New password must be at least 6 characters.");
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setPwdMsg("Error: New passwords do not match.");
                  return;
                }
                setPwdSaving(true);
                try {
                  await changePassword({ currentPassword, newPassword });
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPwdMsg("Password updated.");
                } catch (err) {
                  setPwdMsg(`Error: ${err.message || "Could not update password."}`);
                } finally {
                  setPwdSaving(false);
                }
              }}
              disabled={pwdSaving}
            >
              {pwdSaving ? "Updating..." : "Update password"}
            </GoldButton>
          </div>

          <div style={{ marginTop: "22px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
            <div style={{ ...headingStyle, fontSize: "18px", marginBottom: "10px" }}>Danger zone</div>
            {deleteMsg ? (
              <div style={{ ...(deleteMsg.startsWith("Error") ? errorStyle : successStyle), marginBottom: "10px" }}>{deleteMsg}</div>
            ) : null}
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              style={{
                width: "100%",
                border: "1px solid rgba(229,115,115,0.35)",
                background: "rgba(229,115,115,0.08)",
                color: "#F1B1B1",
                borderRadius: "12px",
                padding: "14px 16px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              Delete account
            </button>
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

      {deleteOpen ? (
        <Modal
          title="Delete account?"
          onClose={() => (deleteBusy ? null : setDeleteOpen(false))}
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteBusy}
                style={{ ...secondaryButton, opacity: deleteBusy ? 0.6 : 1, cursor: deleteBusy ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeleteMsg("");
                  setDeleteBusy(true);
                  try {
                    await deleteAccount();
                    setDeleteMsg("Account deleted.");
                    setDeleteOpen(false);
                    router.push("/register");
                  } catch (err) {
                    setDeleteMsg(`Error: ${err?.message || "Could not delete account."}`);
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
                disabled={deleteBusy}
                style={{
                  border: "none",
                  background: "linear-gradient(135deg,#E45A5A,#B83C3C)",
                  color: "#0F0D0A",
                  borderRadius: "12px",
                  padding: "14px 18px",
                  cursor: deleteBusy ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 800,
                  opacity: deleteBusy ? 0.6 : 1,
                }}
              >
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          }
        >
          <div style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>
            This will permanently delete your account and all saved chats.
            <div style={{ marginTop: "8px", color: "var(--ink-3)", fontSize: "13px" }}>This cannot be undone.</div>
          </div>
        </Modal>
      ) : null}
    </PageShell>
  );
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(560px, 94vw)",
          background: "var(--bg-elev)",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)" }}>{title}</div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "12px",
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--ink-2)",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "16px" }}>{children}</div>
        {footer ? <div style={{ padding: "14px 16px 16px", borderTop: "1px solid var(--line)" }}>{footer}</div> : null}
      </div>
    </div>
  );
}

const cardStyle = { background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "18px", padding: "24px" };
const headingStyle = { fontSize: "22px", color: "var(--ink)", marginBottom: "12px", fontFamily: "Fraunces, serif" };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", padding: "12px 14px", color: "var(--ink)", fontSize: "14px", fontFamily: "inherit", marginBottom: "10px" };
const statLine = { fontSize: "14px", color: "var(--ink-2)", marginBottom: "8px" };
const secondaryButton = { background: "none", border: "1px solid var(--line-strong)", color: "var(--ink-2)", borderRadius: "10px", padding: "14px 18px", cursor: "pointer", fontFamily: "inherit" };
const errorStyle = {
  background: "rgba(229,115,115,0.08)",
  border: "1px solid rgba(229,115,115,0.25)",
  color: "#F1B1B1",
  borderRadius: "12px",
  padding: "12px 14px",
};
const successStyle = {
  background: "rgba(120,176,140,0.1)",
  border: "1px solid rgba(120,176,140,0.35)",
  color: "#C5E8CC",
  borderRadius: "12px",
  padding: "12px 14px",
};
