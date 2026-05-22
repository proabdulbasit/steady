"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GoldButton, GhostButton, PageShell } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";
import { INDUSTRY_OPTIONS } from "../../lib/industry-prompts";
import {
  disconnectIntegration,
  fetchInsightsList,
  fetchIntegrationContext,
  fetchIntegrationsStatus,
  refreshInsightsComputation,
  startIntegrationOAuth,
  syncIntegrationNow,
} from "../../lib/integrations-client";
import { fetchBriefingProcessingStatus } from "../../lib/briefing-client";
import { BriefingProcessingPanel } from "../../components/briefing-processing-panel";
import { BriefingSummaryPanel } from "../../components/briefing-summary-panel";
import { BriefingInsightsPanel } from "../../components/briefing-insights-panel";
import { BriefingDeliveryPanel } from "../../components/briefing-delivery-panel";

function formatUsdFromCents(cents) {
  const n = Number(cents || 0) / 100;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatMaybeNumber(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v);
}

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, profile, saveProfile, logout, profileLoading, changePassword, deleteAccount, authToken } = useSteady();
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
  const [integrationsBusy, setIntegrationsBusy] = useState("");
  const [integrationsError, setIntegrationsError] = useState("");
  const [integrationsStatus, setIntegrationsStatus] = useState(null);
  const [dataPreviewLoading, setDataPreviewLoading] = useState(false);
  const [dataPreviewError, setDataPreviewError] = useState("");
  const [dataPreviewContext, setDataPreviewContext] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [insightsList, setInsightsList] = useState([]);
  /** When set, user has successfully called GET /api/insights at least once (may be 0 rows). */
  const [insightsLoadedAt, setInsightsLoadedAt] = useState(null);
  const [insightsLastCount, setInsightsLastCount] = useState(null);
  const [lastRecomputeResult, setLastRecomputeResult] = useState(null);
  const [processingLoading, setProcessingLoading] = useState(false);
  const [processingBusy, setProcessingBusy] = useState(false);
  const [processingError, setProcessingError] = useState("");
  const [processingStatus, setProcessingStatus] = useState(null);
  const [lastManualRun, setLastManualRun] = useState(null);
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

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    (async () => {
      setProcessingLoading(true);
      setProcessingError("");
      try {
        const [statusData, integrationsData] = await Promise.all([
          fetchBriefingProcessingStatus({ authToken }),
          fetchIntegrationsStatus({ authToken }),
        ]);
        if (cancelled) return;
        setProcessingStatus(statusData);
        setIntegrationsStatus(integrationsData);
      } catch (e) {
        if (!cancelled) setProcessingError(e?.message || "Could not load processing status.");
      } finally {
        if (!cancelled) setProcessingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

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

  // Hooks must run before any conditional return (Rules of Hooks).
  const integrationRows = useMemo(() => {
    const map = new Map((profile.integrations || []).map((x) => [x.provider, x]));
    return [
      { provider: "square", label: "Square", item: map.get("square") || { provider: "square", status: "disconnected" } },
      { provider: "quickbooks", label: "QuickBooks", item: map.get("quickbooks") || { provider: "quickbooks", status: "disconnected" } },
    ];
  }, [profile.integrations]);

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

          {/* Integrations */}
          <section className="profile-admin-panel surface-chrome card-section" style={{ gridColumn: "1 / -1" }}>
            <div className="profile-admin-panel-head" style={{ marginBottom: 14 }}>
              <div>
                <div className="profile-admin-panel-kicker">Integrations</div>
                <h2 className="profile-admin-panel-title serif">Connect your data</h2>
                <p className="profile-admin-panel-meta" style={{ maxWidth: "72ch" }}>
                  Link Square and QuickBooks so Steady can use real sales + financial data. You can disconnect anytime.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!authToken || Boolean(integrationsBusy)}
                onClick={async () => {
                  if (!authToken) return;
                  setIntegrationsError("");
                  try {
                    const data = await fetchIntegrationsStatus({ authToken });
                    setIntegrationsStatus(data);
                  } catch (e) {
                    setIntegrationsError(e?.message || "Could not load integrations.");
                  }
                }}
              >
                Refresh
              </button>
            </div>

            {integrationsError ? (
              <div style={{ ...errorStyle, marginBottom: 12 }}>{integrationsError}</div>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
              {integrationRows.map((row) => {
                const status = row.item?.status || "disconnected";
                const isConnected = status === "connected";
                const lastSyncedAt = integrationsStatus?.providers?.[row.provider]?.lastSyncedAt || "";
                const lastSyncStatus = integrationsStatus?.providers?.[row.provider]?.lastSyncStatus || "";
                return (
                  <div
                    key={row.provider}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      padding: "14px 14px",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "center",
                      background: "color-mix(in srgb, var(--bg-soft) 40%, transparent)",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 750, color: "var(--ink)" }}>{row.label}</div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 750,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: isConnected ? "var(--gold)" : "var(--ink-3)",
                          }}
                        >
                          {status}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                        {isConnected ? (
                          <>
                            {lastSyncedAt ? `Last sync: ${new Date(lastSyncedAt).toLocaleString()}` : "Not synced yet."}
                            {lastSyncStatus ? ` • ${lastSyncStatus}` : ""}
                          </>
                        ) : (
                          "Not connected."
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {isConnected ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={!authToken || integrationsBusy === row.provider}
                            onClick={async () => {
                              if (!authToken) return;
                              setIntegrationsError("");
                              setIntegrationsBusy(row.provider);
                              try {
                                await syncIntegrationNow({ provider: row.provider, authToken });
                                const data = await fetchIntegrationsStatus({ authToken });
                                setIntegrationsStatus(data);
                              } catch (e) {
                                setIntegrationsError(e?.message || "Sync failed.");
                              } finally {
                                setIntegrationsBusy("");
                              }
                            }}
                          >
                            {integrationsBusy === row.provider ? "Syncing..." : "Sync now"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={!authToken || integrationsBusy === row.provider}
                            onClick={async () => {
                              if (!authToken) return;
                              setIntegrationsError("");
                              setIntegrationsBusy(row.provider);
                              try {
                                await disconnectIntegration({ provider: row.provider, authToken });
                                const data = await fetchIntegrationsStatus({ authToken });
                                setIntegrationsStatus(data);
                              } catch (e) {
                                setIntegrationsError(e?.message || "Disconnect failed.");
                              } finally {
                                setIntegrationsBusy("");
                              }
                            }}
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <GoldButton
                          type="button"
                          className="btn-sm"
                          disabled={!authToken || integrationsBusy === row.provider}
                          onClick={async () => {
                            if (!authToken) return;
                            setIntegrationsError("");
                            setIntegrationsBusy(row.provider);
                            try {
                              const data = await startIntegrationOAuth({ provider: row.provider, authToken });
                              if (data?.url) {
                                window.location.href = data.url;
                              } else {
                                throw new Error("Missing authorize url.");
                              }
                            } catch (e) {
                              setIntegrationsError(e?.message || "Could not start OAuth.");
                              setIntegrationsBusy("");
                            }
                          }}
                        >
                          {integrationsBusy === row.provider ? "Opening..." : `Connect ${row.label}`}
                        </GoldButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Phase 5 — automated scheduled data processing */}
          <BriefingProcessingPanel
            authToken={authToken}
            processingStatus={processingStatus}
            setProcessingStatus={setProcessingStatus}
            processingLoading={processingLoading}
            setProcessingLoading={setProcessingLoading}
            processingBusy={processingBusy}
            setProcessingBusy={setProcessingBusy}
            processingError={processingError}
            setProcessingError={setProcessingError}
            lastManualRun={lastManualRun}
            setLastManualRun={setLastManualRun}
            setIntegrationsStatus={setIntegrationsStatus}
            errorStyle={errorStyle}
          />

          <BriefingSummaryPanel authToken={authToken} errorStyle={errorStyle} />

          <BriefingInsightsPanel authToken={authToken} errorStyle={errorStyle} />

          <BriefingDeliveryPanel authToken={authToken} errorStyle={errorStyle} successStyle={successStyle} />

          {/* Normalized metrics + canonical summary for AI */}
          <section className="profile-admin-panel surface-chrome card-section" style={{ gridColumn: "1 / -1" }}>
            <div className="profile-admin-panel-head" style={{ marginBottom: 14 }}>
              <div>
                <div className="profile-admin-panel-kicker">Testing</div>
                <h2 className="profile-admin-panel-title serif">AI-ready data preview</h2>
                <p className="profile-admin-panel-meta" style={{ maxWidth: "72ch" }}>
                  Loads the same structured context as GET <code>/api/integrations/context</code>—Square + QuickBooks metrics
                  after you run Sync. Use this to validate normalization before prompts use it.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!authToken || dataPreviewLoading}
                  onClick={async () => {
                    setDataPreviewError("");
                    setDataPreviewLoading(true);
                    try {
                      const res = await fetchIntegrationContext({ authToken });
                      setDataPreviewContext(res.context || null);
                    } catch (e) {
                      setDataPreviewContext(null);
                      setDataPreviewError(e?.message || "Could not load context.");
                    } finally {
                      setDataPreviewLoading(false);
                    }
                  }}
                >
                  {dataPreviewLoading ? "Loading..." : "Load preview"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!dataPreviewContext}
                  onClick={() => {
                    setDataPreviewContext(null);
                    setDataPreviewError("");
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            {dataPreviewError ? <div style={{ ...errorStyle, marginBottom: 12 }}>{dataPreviewError}</div> : null}
            {!dataPreviewContext ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)" }}>Tap Load preview after syncing.</p>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <AdminStat label="Window" value={`${dataPreviewContext.windowDays ?? "—"} days`} hint="UTC daily keys" />
                  <AdminStat
                    label="Square (window)"
                    value={formatUsdFromCents(dataPreviewContext.square?.summary?.netRevenueCents)}
                    hint={`${dataPreviewContext.square?.summary?.paymentCount ?? 0} payments • ${dataPreviewContext.square?.summary?.orderCount ?? 0} orders`}
                  />
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--ink)" }}>Sources</strong>
                  <div>Square merchant: {dataPreviewContext.sources?.square?.profile?.businessName || "—"}</div>
                  <div>Square locations: {(dataPreviewContext.sources?.square?.locationIds || []).length}</div>
                  <div>QuickBooks realm: {dataPreviewContext.sources?.quickbooks?.realmId || "—"}</div>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--ink)" }}>QuickBooks latest snapshot (profit and loss)</strong>
                  <div>
                    Net income:{" "}
                    {formatMaybeNumber(dataPreviewContext.quickbooks?.latestProfitAndLoss?.profitAndLoss?.netIncome)}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, color: "var(--ink)" }}>canonicalSummary</div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid var(--line)",
                      background: "color-mix(in srgb, var(--bg-soft) 50%, transparent)",
                      fontSize: 12,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: 240,
                      overflow: "auto",
                    }}
                  >
                    {dataPreviewContext.canonicalSummary || "—"}
                  </pre>
                </div>
              </div>
            )}
          </section>

          {/* Insights */}
          <section className="profile-admin-panel surface-chrome card-section" style={{ gridColumn: "1 / -1" }}>
            <div className="profile-admin-panel-head" style={{ marginBottom: 14 }}>
              <div>
                <div className="profile-admin-panel-kicker">Testing</div>
                <h2 className="profile-admin-panel-title serif">Insights</h2>
                <p className="profile-admin-panel-meta" style={{ maxWidth: "72ch" }}>
                  Loads GET <code>/api/insights</code>. An empty list after Reload means the request worked but no
                  insight documents exist yet—usually rules did not fire (flat sandbox data). Use Recompute after sync
                  to create rows when thresholds match.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!authToken || insightsLoading}
                  onClick={async () => {
                    setInsightsError("");
                    setInsightsLoading(true);
                    try {
                      const res = await fetchInsightsList({ authToken });
                      const list = Array.isArray(res.insights) ? res.insights : [];
                      setInsightsList(list);
                      setInsightsLastCount(list.length);
                      setInsightsLoadedAt(Date.now());
                    } catch (e) {
                      setInsightsList([]);
                      setInsightsError(e?.message || "Could not load insights.");
                    } finally {
                      setInsightsLoading(false);
                    }
                  }}
                >
                  {insightsLoading ? "Loading..." : "Reload list"}
                </button>
                <GoldButton
                  type="button"
                  className="btn-sm"
                  disabled={!authToken || insightsLoading}
                  onClick={async () => {
                    setInsightsError("");
                    setInsightsLoading(true);
                    try {
                      const refRes = await refreshInsightsComputation({ authToken });
                      setLastRecomputeResult(refRes?.result ?? null);
                      const res = await fetchInsightsList({ authToken });
                      const list = Array.isArray(res.insights) ? res.insights : [];
                      setInsightsList(list);
                      setInsightsLastCount(list.length);
                      setInsightsLoadedAt(Date.now());
                    } catch (e) {
                      setInsightsError(e?.message || "Could not refresh insights.");
                    } finally {
                      setInsightsLoading(false);
                    }
                  }}
                >
                  Recompute insights
                </GoldButton>
              </div>
            </div>
            {insightsError ? <div style={{ ...errorStyle, marginBottom: 12 }}>{insightsError}</div> : null}
            {lastRecomputeResult != null ? (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-3)" }}>
                Last recompute: created or updated{" "}
                <strong style={{ color: "var(--ink)" }}>{String(lastRecomputeResult.created ?? 0)}</strong> insight
                rule hit(s). (Many runs produce 0 if metrics are flat.)
              </p>
            ) : null}
            {insightsLoadedAt != null ? (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-2)" }}>
                List loaded {new Date(insightsLoadedAt).toLocaleString()} ·{" "}
                <strong style={{ color: "var(--ink)" }}>{insightsLastCount ?? insightsList.length}</strong> row(s) from
                the server.
              </p>
            ) : null}
            {!insightsList.length ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55 }}>
                {insightsLoadedAt == null
                  ? "Tap Reload list to fetch from the API (check Network if nothing changes—set NEXT_PUBLIC_BACKEND_URL)."
                  : "You have 0 insight documents. Sync Square/QuickBooks, open AI preview to confirm metrics, then Recompute. Rules only create rows for large week-over-week revenue drops, refund spikes, order drops, or negative QBO net income."}
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {insightsList.map((it) => (
                  <div
                    key={it._id != null ? String(it._id) : `${it.type}-${it.dateKey || ""}`}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      padding: "12px 14px",
                      background: "color-mix(in srgb, var(--bg-soft) 35%, transparent)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontWeight: 750, color: "var(--ink)" }}>{it.title || it.type}</div>
                      <div style={{ fontSize: 12, letterSpacing: "0.06em", fontWeight: 750, color: "var(--ink-3)" }}>
                        {(it.provider || "").toUpperCase()} · {(it.severity || "info").toUpperCase()}
                      </div>
                    </div>
                    {it.body ? (
                      <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ink-3)", lineHeight: 1.5 }}>
                        {it.body}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
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
