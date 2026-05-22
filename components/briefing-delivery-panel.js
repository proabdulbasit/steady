"use client";

import { useEffect, useState } from "react";
import { GoldButton } from "./steady-ui";
import {
  fetchBriefingDeliveryStatus,
  fetchBriefingNotifications,
  markBriefingNotificationRead,
  sendBriefingDeliveryNow,
  sendMailgunTestEmail,
  subscribeBriefingPush,
  unsubscribeBriefingPush,
  updateBriefingDeliveryPreferences,
} from "../lib/briefing-client";
import { registerBriefingPush } from "../lib/push-subscribe";

function channelLabel(channel) {
  if (channel === "email") return "Email";
  if (channel === "push") return "Push";
  if (channel === "in_app") return "In-app";
  return channel;
}

export function BriefingDeliveryPanel({ authToken, errorStyle, successStyle }) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [prefs, setPrefs] = useState(null);
  const [todayLogs, setTodayLogs] = useState([]);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [testEmailBusy, setTestEmailBusy] = useState(false);

  async function load() {
    if (!authToken) return;
    setError("");
    setLoading(true);
    try {
      const [statusData, notifData] = await Promise.all([
        fetchBriefingDeliveryStatus({ authToken }),
        fetchBriefingNotifications({ authToken }),
      ]);
      setPrefs(statusData.prefs || null);
      setTodayLogs(statusData.todayLogs || []);
      setVapidPublicKey(statusData.vapidPublicKey || null);
      setPushConfigured(Boolean(statusData.pushConfigured));
      setNotifications(Array.isArray(notifData.notifications) ? notifData.notifications : []);
    } catch (e) {
      setError(e?.message || "Could not load delivery status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  async function togglePref(key, value) {
    if (!authToken) return;
    setError("");
    try {
      const body = key === "emailEnabled" ? { emailEnabled: value, pushEnabled: prefs?.pushEnabled } : { emailEnabled: prefs?.emailEnabled, pushEnabled: value };
      const data = await updateBriefingDeliveryPreferences({ authToken, ...body });
      setPrefs(data.prefs || null);
    } catch (e) {
      setError(e?.message || "Could not update preferences.");
    }
  }

  return (
    <section className="profile-admin-panel surface-chrome card-section" style={{ gridColumn: "1 / -1" }}>
      <div className="profile-admin-panel-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="profile-admin-panel-kicker">Daily briefing</div>
          <h2 className="profile-admin-panel-title serif">Email &amp; push delivery</h2>
          <p className="profile-admin-panel-meta" style={{ maxWidth: "72ch" }}>
            Sends your daily briefing by email (Mailgun), creates an in-app notification, and can alert this browser
            with push when enabled.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!authToken || loading || sending} onClick={load}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <GoldButton
            type="button"
            className="btn-sm"
            disabled={!authToken || sending}
            onClick={async () => {
              if (!authToken) return;
              setError("");
              setMsg("");
              setSending(true);
              try {
                const data = await sendBriefingDeliveryNow({ authToken, force: true });
                const parts = (data.results || []).map((r) => `${r.channel} ${r.status}`).join(", ");
                if (data.generateError && !(data.results || []).some((r) => r.status === "sent")) {
                  setError(data.generateError);
                }
                let hint = "";
                if (data.usedPreviewFallback) {
                  hint = " (preview email sent — connect Square/QBO for real briefing)";
                } else if (data.usedConnectedFallback) {
                  hint = " (sync-status email — connect data or generate briefing for full summary)";
                } else if (data.usedInsightsFallback) {
                  hint = " (sent insights summary — generate AI briefing for full email)";
                }
                if (data.syncResult?.providers?.length) {
                  const syncParts = data.syncResult.providers
                    .map((p) => `${p.provider} ${p.status}`)
                    .join(", ");
                  hint = `${hint} Synced: ${syncParts}.`.trim();
                }
                setMsg(`Delivery: ${parts || "done"}${hint}`);
                if (data.generateError && (data.results || []).some((r) => r.status === "sent")) {
                  setError("");
                }
                await load();
              } catch (e) {
                setError(e?.message || "Delivery failed.");
              } finally {
                setSending(false);
              }
            }}
          >
            {sending ? "Sending..." : "Send test now"}
          </GoldButton>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!authToken || testEmailBusy}
            onClick={async () => {
              if (!authToken) return;
              setError("");
              setMsg("");
              setTestEmailBusy(true);
              try {
                const data = await sendMailgunTestEmail({ authToken });
                setMsg(
                  `Mailgun test sent to ${data.to || "your email"}${data.messageId ? ` (id: ${data.messageId})` : ""}. Check inbox + Mailgun logs.`
                );
              } catch (e) {
                setError(e?.message || "Test email failed.");
              } finally {
                setTestEmailBusy(false);
              }
            }}
          >
            {testEmailBusy ? "Sending..." : "Test Mailgun only"}
          </button>
        </div>
      </div>

      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-3)", lineHeight: 1.55 }}>
        <strong>Send test now</strong> always sends an email (preview if Square/QBO are not connected yet). For revenue,
        costs, and staffing numbers, connect integrations and run <strong>Full sync now</strong>.
      </p>

      {error ? <div style={{ ...errorStyle, marginBottom: 12 }}>{error}</div> : null}
      {msg ? <div style={{ ...successStyle, marginBottom: 12 }}>{msg}</div> : null}

      <div style={{ display: "grid", gap: 14, marginBottom: 16 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: "var(--ink-2)" }}>
          <input
            type="checkbox"
            checked={prefs?.emailEnabled !== false}
            disabled={!authToken || loading}
            onChange={(e) => togglePref("emailEnabled", e.target.checked)}
          />
          Email daily briefing to <strong style={{ color: "var(--ink)" }}>{prefs ? "your account email" : "…"}</strong>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: "var(--ink-2)" }}>
          <input
            type="checkbox"
            checked={prefs?.pushEnabled !== false}
            disabled={!authToken || loading}
            onChange={(e) => togglePref("pushEnabled", e.target.checked)}
          />
          Browser push notifications
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!authToken || pushBusy || !pushConfigured || !vapidPublicKey}
            onClick={async () => {
              if (!authToken || !vapidPublicKey) return;
              setPushBusy(true);
              setError("");
              try {
                await registerBriefingPush({
                  authToken,
                  vapidPublicKey,
                  subscribeApi: subscribeBriefingPush,
                });
                setMsg("Push enabled for this browser.");
                await load();
              } catch (e) {
                setError(e?.message || "Could not enable push.");
              } finally {
                setPushBusy(false);
              }
            }}
          >
            {pushBusy ? "Enabling..." : "Enable push on this device"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!authToken || pushBusy}
            onClick={async () => {
              setPushBusy(true);
              try {
                await unsubscribeBriefingPush({ authToken });
                setMsg("Push subscriptions cleared.");
                await load();
              } catch (e) {
                setError(e?.message || "Could not unsubscribe.");
              } finally {
                setPushBusy(false);
              }
            }}
          >
            Clear push devices
          </button>
        </div>
        {!pushConfigured ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>
            Push requires <code>VAPID_PUBLIC_KEY</code> and <code>VAPID_PRIVATE_KEY</code> on the backend (run{" "}
            <code>npx web-push generate-vapid-keys</code>).
          </p>
        ) : null}
      </div>

      {todayLogs.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>Today&apos;s delivery log</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6 }}>
            {todayLogs.map((l) => (
              <li key={l.channel}>
                <strong>{channelLabel(l.channel)}</strong>: {l.status}
                {l.error ? ` — ${l.error}` : ""}
                {l.sentAt ? ` · ${new Date(l.sentAt).toLocaleString()}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>In-app notifications</div>
        {!notifications.length ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)" }}>No notifications yet. Use Send test now after generating a briefing.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  opacity: n.readAt ? 0.65 : 1,
                  background: "color-mix(in srgb, var(--bg-soft) 30%, transparent)",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{n.title}</div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>{n.body}</p>
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{new Date(n.createdAt).toLocaleString()}</span>
                  {!n.readAt ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        await markBriefingNotificationRead({ authToken, id: n.id });
                        await load();
                      }}
                    >
                      Mark read
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--gold)" }}>Read</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
