"use client";

import { useEffect, useState } from "react";
import { GoldButton } from "./steady-ui";
import { fetchBusinessInsightsDashboard, refreshBusinessInsightsDashboard } from "../lib/briefing-client";

const PILLARS = [
  { key: "revenue", label: "Revenue", icon: "📈" },
  { key: "costs", label: "Costs", icon: "💰" },
  { key: "staffing", label: "Staffing", icon: "👥" },
];

function toneColor(tone) {
  if (tone === "positive") return "var(--gold)";
  if (tone === "negative") return "var(--danger)";
  if (tone === "info") return "var(--ink-3)";
  return "var(--ink-2)";
}

function PillarCard({ pillar }) {
  if (!pillar) return null;
  const isEmpty = pillar.status === "no_data";

  return (
    <article
      style={{
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "16px 18px",
        background: "color-mix(in srgb, var(--bg-soft) 35%, transparent)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{pillar.headline || "—"}</h4>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: isEmpty ? "var(--ink-3)" : "var(--gold)",
          }}
        >
          {pillar.status === "ready" ? "Ready" : pillar.status === "limited" ? "Limited data" : "No data"}
        </span>
      </div>

      <p style={{ margin: "10px 0 14px", fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6 }}>{pillar.summary}</p>

      {pillar.metrics?.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: pillar.highlights?.length ? 12 : 0,
          }}
        >
          {pillar.metrics.map((m) => (
            <div
              key={`${m.label}-${m.value}`}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "color-mix(in srgb, var(--bg) 60%, transparent)",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{m.value}</div>
              {m.hint ? <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{m.hint}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {pillar.highlights?.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: "var(--ink-3)" }}>
          {pillar.highlights.map((h, i) => (
            <li key={i} style={{ color: toneColor(h.tone), marginBottom: 6 }}>
              {h.text}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function BriefingInsightsPanel({ authToken, errorStyle }) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [alertsCreated, setAlertsCreated] = useState(null);

  async function loadLatest() {
    if (!authToken) return;
    setError("");
    setLoading(true);
    try {
      const data = await fetchBusinessInsightsDashboard({ authToken });
      setDashboard(data.dashboard || null);
    } catch (e) {
      setError(e?.message || "Could not load insights.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  return (
    <section className="profile-admin-panel surface-chrome card-section" style={{ gridColumn: "1 / -1" }}>
      <div className="profile-admin-panel-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="profile-admin-panel-kicker">Daily briefing</div>
          <h2 className="profile-admin-panel-title serif">Revenue, cost &amp; staffing insights</h2>
          <p className="profile-admin-panel-meta" style={{ maxWidth: "72ch" }}>
            Plain-English breakdown from your synced Square and QuickBooks data — not generic tips. Revenue and staffing
            use sales volume; costs use your P&amp;L when QuickBooks is connected.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!authToken || loading || refreshing}
            onClick={loadLatest}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <GoldButton
            type="button"
            className="btn-sm"
            disabled={!authToken || refreshing}
            onClick={async () => {
              if (!authToken) return;
              setError("");
              setRefreshing(true);
              try {
                const data = await refreshBusinessInsightsDashboard({ authToken });
                setDashboard(data.dashboard || null);
                setAlertsCreated(data.alertsCreated ?? 0);
              } catch (e) {
                setError(e?.message || "Could not refresh insights.");
              } finally {
                setRefreshing(false);
              }
            }}
          >
            {refreshing ? "Computing..." : "Recompute insights"}
          </GoldButton>
        </div>
      </div>

      {error ? <div style={{ ...errorStyle, marginBottom: 12 }}>{error}</div> : null}

      {alertsCreated != null ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-3)" }}>
          Rule-based alerts created/updated: <strong style={{ color: "var(--ink)" }}>{alertsCreated}</strong> (only when
          thresholds like big revenue drops are met).
        </p>
      ) : null}

      {dashboard?.computedAt ? (
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--ink-3)" }}>
          Last computed {new Date(dashboard.computedAt).toLocaleString()}
          {dashboard.dateKey ? ` · ${dashboard.dateKey}` : ""}
        </p>
      ) : null}

      {!dashboard ? (
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55 }}>
          {loading
            ? "Loading insights..."
            : "No insights yet. Run a full sync, then tap Recompute insights."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {PILLARS.map(({ key, label, icon }) => (
            <div key={key}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                  marginBottom: 8,
                }}
              >
                {icon} {label}
              </div>
              <PillarCard pillar={dashboard[key]} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
