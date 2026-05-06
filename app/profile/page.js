"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoldButton, GhostButton, PageShell } from "../../components/steady-ui";
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
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
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

  function openPasswordModal() {
    setPwdMsg("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordModalOpen(true);
  }

  function closePasswordModal() {
    if (pwdSaving) return;
    setPasswordModalOpen(false);
    setPwdMsg("");
  }

  async function submitPasswordChange() {
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
      setPwdMsg("");
      setPasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwdMsg(`Error: ${err.message || "Could not update password."}`);
    } finally {
      setPwdSaving(false);
    }
  }

  if (!isAuthenticated) return null;

  const integrationsConnected = profile.integrations?.filter((item) => item.status === "connected").length || 0;

  return (
    <PageShell
      eyebrow="Profile"
      title="Your account and plan"
      description="Manage your account details, view your current subscription, and monitor daily usage."
    >
      <div className="profile-admin">
        {/* Quick stats — admin-style summary */}
        <div className="profile-admin-stats">
          <AdminStat label="Plan" value={profile.planName || "—"} hint="Subscription" />
          <AdminStat
            label="Usage today"
            value={isUnlimited ? "Unlimited" : String(profile.questionsUsed ?? "—")}
            hint={isUnlimited ? "No daily cap on your tier" : `${profile.questionsRemaining ?? 0} remaining today`}
          />
          <AdminStat
            label="Status"
            value={formatStatus(profile.subscriptionStatus)}
            hint={`${integrationsConnected} integration${integrationsConnected === 1 ? "" : "s"} connected`}
          />
        </div>

        <div className="profile-admin-grid">
          {/* Account & security */}
          <section className="profile-admin-panel surface-chrome card-section">
            <div className="profile-admin-panel-head">
              <div>
                <div className="profile-admin-panel-kicker">Settings</div>
                <h2 className="profile-admin-panel-title serif">Account</h2>
                <p className="profile-admin-panel-meta">Public profile fields used across Steady.</p>
              </div>
            </div>

            <div className="profile-admin-fields">
              <div>
                <label className="label" htmlFor="profile-name">Full name</label>
                <input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="input"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="label" htmlFor="profile-email">Email</label>
                <input id="profile-email" value={profile.email} disabled className="input" style={{ opacity: 0.72 }} />
              </div>
              <div>
                <label className="label" htmlFor="profile-industry">Industry</label>
                <select
                  id="profile-industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="input select"
                  style={{ appearance: "none", cursor: "pointer" }}
                  aria-label="Industry"
                >
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="profile-admin-actions">
              <GoldButton
                onClick={async () => {
                  setSaving(true);
                  await saveProfile({ name, industry });
                  setSaving(false);
                }}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save changes"}
              </GoldButton>
              <GhostButton type="button" onClick={logout}>
                Log out
              </GhostButton>
            </div>

            <div className="profile-admin-divider" />

            <div className="profile-admin-subsection">
              <div className="profile-admin-subsection-head">
                <div>
                  <div className="profile-admin-panel-kicker">Security</div>
                  <h3 className="profile-admin-subtitle serif">Password</h3>
                  <p className="profile-admin-panel-meta">Use a strong password you don’t reuse elsewhere.</p>
                </div>
                <GhostButton type="button" className="btn-sm" onClick={openPasswordModal}>
                  Change password
                </GhostButton>
              </div>
            </div>

            <div className="profile-admin-divider" />

            <div className="profile-admin-subsection">
              <div className="profile-admin-panel-kicker">Danger zone</div>
              <h3 className="profile-admin-subtitle serif">Delete account</h3>
              <p className="profile-admin-panel-meta">Permanently remove your account and saved chats. This cannot be undone.</p>
              {deleteMsg ? (
                <div style={{ ...(deleteMsg.startsWith("Error") ? errorStyle : successStyle), marginTop: 12 }}>{deleteMsg}</div>
              ) : null}
              <button type="button" onClick={() => setDeleteOpen(true)} className="profile-admin-danger-btn">
                Delete account
              </button>
            </div>
          </section>

          {/* Plan & usage */}
          <section className="profile-admin-panel surface-chrome card-section">
            <div className="profile-admin-panel-head">
              <div>
                <div className="profile-admin-panel-kicker">Billing</div>
                <h2 className="profile-admin-panel-title serif">Plan &amp; usage</h2>
                <p className="profile-admin-panel-meta">Subscription status and daily question limits.</p>
              </div>
              <span className="profile-admin-plan-chip">{profile.planName}</span>
            </div>

            <dl className="profile-admin-metrics">
              <div className="profile-admin-metric">
                <dt>Subscription</dt>
                <dd>{formatStatus(profile.subscriptionStatus)}</dd>
              </div>
              <div className="profile-admin-metric">
                <dt>Used today</dt>
                <dd>{isUnlimited ? "Unlimited" : String(profile.questionsUsed ?? "—")}</dd>
              </div>
              <div className="profile-admin-metric">
                <dt>Remaining today</dt>
                <dd>{isUnlimited ? "Unlimited" : String(profile.questionsRemaining ?? "—")}</dd>
              </div>
              <div className="profile-admin-metric">
                <dt>Integrations</dt>
                <dd>{integrationsConnected} connected</dd>
              </div>
            </dl>

            <GoldButton type="button" onClick={() => router.push("/pricing")} style={{ width: "100%", marginTop: 8 }}>
              Manage plan
            </GoldButton>
          </section>
        </div>
      </div>

      {passwordModalOpen ? (
        <Modal
          title="Change password"
          onClose={closePasswordModal}
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={pwdSaving}
                style={{ ...secondaryButtonModal, opacity: pwdSaving ? 0.55 : 1, cursor: pwdSaving ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <GoldButton type="button" onClick={submitPasswordChange} disabled={pwdSaving}>
                {pwdSaving ? "Updating..." : "Update password"}
              </GoldButton>
            </div>
          }
        >
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55 }}>
              Enter your current password once, then your new password twice to confirm.
            </p>
            <div>
              <label className="label" htmlFor="pwd-current">Current password</label>
              <input
                id="pwd-current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="label" htmlFor="pwd-new">New password</label>
              <input
                id="pwd-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="label" htmlFor="pwd-confirm">Confirm new password</label>
              <input
                id="pwd-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
              />
            </div>
            {pwdMsg ? (
              <div style={{ ...(pwdMsg.startsWith("Error") ? errorStyle : successStyle), margin: 0 }}>{pwdMsg}</div>
            ) : null}
          </div>
        </Modal>
      ) : null}

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
                style={{ ...secondaryButtonModal, opacity: deleteBusy ? 0.6 : 1, cursor: deleteBusy ? "not-allowed" : "pointer" }}
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
                  color: "#fff",
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

      <style>{`
        .profile-admin {
          display: grid;
          gap: 22px;
        }
        .profile-admin-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .profile-admin-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        .profile-admin-panel.card-section {
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }
        .profile-admin-panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 20px;
        }
        .profile-admin-panel-kicker {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 8px;
        }
        .profile-admin-panel-title {
          font-size: clamp(22px, 2.2vw, 26px);
          font-weight: 500;
          color: var(--ink);
          margin: 0 0 8px;
          line-height: 1.15;
        }
        .profile-admin-panel-meta {
          margin: 0;
          font-size: 14px;
          color: var(--ink-3);
          line-height: 1.55;
          max-width: 44ch;
        }
        .profile-admin-plan-chip {
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 8px 12px;
          border-radius: var(--radius-pill);
          background: var(--gold-soft);
          border: 1px solid var(--gold-ring);
          color: var(--gold);
        }
        .profile-admin-fields {
          display: grid;
          gap: 14px;
        }
        .profile-admin-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 20px;
        }
        .profile-admin-divider {
          height: 1px;
          background: var(--line);
          margin: 26px 0;
        }
        .profile-admin-subsection-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .profile-admin-subtitle {
          font-size: 18px;
          font-weight: 500;
          color: var(--ink);
          margin: 0 0 8px;
        }
        .profile-admin-metrics {
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0;
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          overflow: hidden;
          background: color-mix(in srgb, var(--bg-soft) 40%, transparent);
        }
        .profile-admin-metric {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: baseline;
          padding: 14px 16px;
          border-bottom: 1px solid var(--line);
        }
        .profile-admin-metric:last-child {
          border-bottom: none;
        }
        .profile-admin-metric dt {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-3);
        }
        .profile-admin-metric dd {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
          text-align: right;
        }
        .profile-admin-stat-card {
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          padding: 16px 18px;
          background: color-mix(in srgb, var(--bg-soft) 35%, transparent);
        }
        .profile-admin-stat-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-3);
          margin-bottom: 8px;
        }
        .profile-admin-stat-value {
          font-family: "Fraunces", Georgia, serif;
          font-size: clamp(18px, 2vw, 22px);
          color: var(--ink);
          line-height: 1.15;
          margin-bottom: 6px;
        }
        .profile-admin-stat-hint {
          font-size: 13px;
          color: var(--ink-3);
          margin: 0;
          line-height: 1.45;
        }
        .profile-admin-danger-btn {
          width: 100%;
          margin-top: 14px;
          border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
          background: var(--danger-soft);
          color: var(--danger);
          border-radius: 12px;
          padding: 14px 16px;
          cursor: pointer;
          font-family: inherit;
          font-weight: 700;
          font-size: 14px;
          transition: background 150ms ease, border-color 150ms ease;
        }
        .profile-admin-danger-btn:hover {
          border-color: color-mix(in srgb, var(--danger) 55%, transparent);
          background: color-mix(in srgb, var(--danger) 14%, transparent);
        }
        @media (max-width: 980px) {
          .profile-admin-stats {
            grid-template-columns: 1fr;
          }
          .profile-admin-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

function AdminStat({ label, value, hint }) {
  return (
    <div className="profile-admin-stat-card">
      <div className="profile-admin-stat-label">{label}</div>
      <div className="profile-admin-stat-value">{value}</div>
      {hint ? <p className="profile-admin-stat-hint">{hint}</p> : null}
    </div>
  );
}

function formatStatus(raw) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
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
        className="surface-chrome"
        style={{
          width: "min(480px, 94vw)",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
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

const secondaryButtonModal = {
  background: "none",
  border: "1px solid var(--line-strong)",
  color: "var(--ink-2)",
  borderRadius: "12px",
  padding: "14px 18px",
  cursor: "pointer",
  fontFamily: "inherit",
};
const errorStyle = {
  background: "rgba(229,115,115,0.08)",
  border: "1px solid rgba(229,115,115,0.25)",
  color: "var(--danger)",
  borderRadius: "12px",
  padding: "12px 14px",
};
const successStyle = {
  background: "rgba(120,176,140,0.1)",
  border: "1px solid rgba(120,176,140,0.35)",
  color: "var(--ink-2)",
  borderRadius: "12px",
  padding: "12px 14px",
};
