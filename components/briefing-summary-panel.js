"use client";

import { useEffect, useState } from "react";
import { GoldButton } from "./steady-ui";
import { fetchLatestBriefingSummary, generateBriefingSummary } from "../lib/briefing-client";

export function BriefingSummaryPanel({ authToken, errorStyle }) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [briefing, setBriefing] = useState(null);
  const [dateKey, setDateKey] = useState("");

  async function loadLatest() {
    if (!authToken) return;
    setError("");
    setLoading(true);
    try {
      const data = await fetchLatestBriefingSummary({ authToken });
      setBriefing(data.briefing || null);
      setDateKey(data.dateKey || "");
    } catch (e) {
      setError(e?.message || "Could not load briefing.");
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
          <h2 className="profile-admin-panel-title serif">Your business summary</h2>
          <p className="profile-admin-panel-meta" style={{ maxWidth: "72ch" }}>
            AI turns your synced Square and QuickBooks data into a short daily update in plain English — revenue,
            costs, staffing notes, and what to focus on this week.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!authToken || loading || generating}
            onClick={loadLatest}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <GoldButton
            type="button"
            className="btn-sm"
            disabled={!authToken || generating}
            onClick={async () => {
              if (!authToken) return;
              setError("");
              setGenerating(true);
              try {
                const data = await generateBriefingSummary({ authToken, force: true });
                setBriefing(data.briefing || null);
                setDateKey(data.dateKey || "");
              } catch (e) {
                setError(e?.message || "Could not generate briefing.");
              } finally {
                setGenerating(false);
              }
            }}
          >
            {generating ? "Writing..." : briefing ? "Regenerate today" : "Generate briefing"}
          </GoldButton>
        </div>
      </div>

      {error ? <div style={{ ...errorStyle, marginBottom: 12 }}>{error}</div> : null}

      {!briefing ? (
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55 }}>
          {loading
            ? "Loading..."
            : "No briefing yet. Run a full sync above, then tap Generate briefing. You need Square or QuickBooks data synced first."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)", letterSpacing: "0.04em" }}>
              {briefing.dateKey || dateKey}
              {briefing.generatedAt ? ` · ${new Date(briefing.generatedAt).toLocaleString()}` : ""}
            </p>
            <h3
              style={{
                margin: "10px 0 0",
                fontSize: "clamp(20px, 2.4vw, 26px)",
                fontWeight: 500,
                color: "var(--ink)",
                lineHeight: 1.25,
                fontFamily: "var(--font-serif, Georgia, serif)",
              }}
            >
              {briefing.headline}
            </h3>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {(briefing.sections || []).map((section) => (
              <article
                key={section.id || section.title}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: "14px 16px",
                  background: "color-mix(in srgb, var(--bg-soft) 35%, transparent)",
                }}
              >
                <h4 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                  {section.title}
                </h4>
                <div
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "var(--ink-3)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {section.body}
                </div>
              </article>
            ))}
          </div>

          <details style={{ fontSize: 13, color: "var(--ink-3)" }}>
            <summary style={{ cursor: "pointer", color: "var(--ink-2)", fontWeight: 600 }}>Full text</summary>
            <pre
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "color-mix(in srgb, var(--bg-soft) 50%, transparent)",
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {briefing.plainText || "—"}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
