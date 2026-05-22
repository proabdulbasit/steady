"use client";

import { GoldButton } from "./steady-ui";
import { fetchBriefingProcessingStatus, runBriefingProcessingNow } from "../lib/briefing-client";
import { fetchIntegrationsStatus } from "../lib/integrations-client";

function StatCard({ label, value, hint }) {
  return (
    <div className="profile-admin-stat-card">
      <div className="profile-admin-stat-label">{label}</div>
      <div className="profile-admin-stat-value">{value}</div>
      {hint ? <p className="profile-admin-stat-hint">{hint}</p> : null}
    </div>
  );
}

export function BriefingProcessingPanel({
  authToken,
  processingStatus,
  setProcessingStatus,
  processingLoading,
  setProcessingLoading,
  processingBusy,
  setProcessingBusy,
  processingError,
  setProcessingError,
  lastManualRun,
  setLastManualRun,
  setIntegrationsStatus,
  errorStyle,
}) {
  return (
    <section className="profile-admin-panel surface-chrome card-section" style={{ gridColumn: "1 / -1" }}>
      <div className="profile-admin-panel-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="profile-admin-panel-kicker">Daily briefing</div>
          <h2 className="profile-admin-panel-title serif">Automated data processing</h2>
          <p className="profile-admin-panel-meta" style={{ maxWidth: "72ch" }}>
            Background job syncs Square + QuickBooks, normalizes daily metrics, and recomputes insight rules. Same
            pipeline runs on a schedule when <code>INTEGRATIONS_SYNC_ENABLED=true</code> on the backend.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!authToken || processingLoading || processingBusy}
            onClick={async () => {
              if (!authToken) return;
              setProcessingError("");
              setProcessingLoading(true);
              try {
                const data = await fetchBriefingProcessingStatus({ authToken });
                setProcessingStatus(data);
              } catch (e) {
                setProcessingError(e?.message || "Could not refresh status.");
              } finally {
                setProcessingLoading(false);
              }
            }}
          >
            {processingLoading ? "Loading..." : "Refresh status"}
          </button>
          <GoldButton
            type="button"
            className="btn-sm"
            disabled={!authToken || processingBusy}
            onClick={async () => {
              if (!authToken) return;
              setProcessingError("");
              setProcessingBusy(true);
              try {
                const data = await runBriefingProcessingNow({ authToken });
                setLastManualRun(data.result || null);
                setProcessingStatus(data);
                const integrationsData = await fetchIntegrationsStatus({ authToken });
                setIntegrationsStatus(integrationsData);
              } catch (e) {
                setProcessingError(e?.message || "Processing run failed.");
              } finally {
                setProcessingBusy(false);
              }
            }}
          >
            {processingBusy ? "Running..." : "Run full sync now"}
          </GoldButton>
        </div>
      </div>

      {processingError ? <div style={{ ...errorStyle, marginBottom: 12 }}>{processingError}</div> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <StatCard
          label="Scheduler"
          value={
            processingStatus?.scheduler?.enabled ? `On (${processingStatus.scheduler.intervalMinutes}m)` : "Off"
          }
          hint={
            processingStatus?.scheduler?.enabled
              ? "Backend env INTEGRATIONS_SYNC_ENABLED=true"
              : "Set INTEGRATIONS_SYNC_ENABLED=true and restart backend"
          }
        />
        <StatCard
          label="Your last run"
          value={processingStatus?.lastRun?.status || "—"}
          hint={
            processingStatus?.lastRun?.startedAt
              ? new Date(processingStatus.lastRun.startedAt).toLocaleString()
              : "No runs yet — connect integrations, then Run full sync"
          }
        />
        <StatCard
          label="Insights updated"
          value={String(processingStatus?.lastRun?.insightsCreated ?? "—")}
          hint="Rule-based rows created/updated on last run"
        />
      </div>

      {processingStatus?.scheduler?.lastCycle?.startedAt ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>
          Last server cycle: {new Date(processingStatus.scheduler.lastCycle.startedAt).toLocaleString()}
          {processingStatus.scheduler.lastCycle.finishedAt
            ? ` → ${new Date(processingStatus.scheduler.lastCycle.finishedAt).toLocaleString()}`
            : ""}
          {" · "}
          {processingStatus.scheduler.lastCycle.usersProcessed ?? 0} user(s),{" "}
          {processingStatus.scheduler.lastCycle.runsCreated ?? 0} run(s)
          {processingStatus.scheduler.lastCycle.error
            ? ` · error: ${processingStatus.scheduler.lastCycle.error}`
            : ""}
        </p>
      ) : processingStatus?.scheduler?.enabled ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-3)" }}>
          Scheduler is on; waiting for the first cycle (starts ~4s after backend boot).
        </p>
      ) : null}

      {lastManualRun ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-2)" }}>
          Last manual run: <strong style={{ color: "var(--ink)" }}>{lastManualRun.status}</strong>
          {lastManualRun.providers?.length
            ? ` · ${lastManualRun.providers.map((p) => `${p.provider}: ${p.status}`).join(", ")}`
            : ""}
        </p>
      ) : null}

      {processingStatus?.lastRun?.providers?.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {processingStatus.lastRun.providers.map((p) => (
            <div
              key={p.provider}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 13,
                color: "var(--ink-3)",
                background: "color-mix(in srgb, var(--bg-soft) 35%, transparent)",
              }}
            >
              <strong style={{ color: "var(--ink)" }}>{p.provider}</strong> · {p.status}
              {p.message ? ` — ${p.message}` : ""}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)" }}>
          {processingLoading
            ? "Loading processing status..."
            : "Connect Square or QuickBooks above, then use Run full sync now to test the pipeline."}
        </p>
      )}

      {processingStatus?.recentRuns?.length > 1 ? (
        <details style={{ marginTop: 14, fontSize: 13, color: "var(--ink-3)" }}>
          <summary style={{ cursor: "pointer", color: "var(--ink-2)", fontWeight: 600 }}>
            Recent runs ({processingStatus.recentRuns.length})
          </summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
            {processingStatus.recentRuns.map((r) => (
              <li key={r.id}>
                {r.trigger} · {r.status} · {new Date(r.startedAt).toLocaleString()}
                {r.insightsCreated != null ? ` · ${r.insightsCreated} insight(s)` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
