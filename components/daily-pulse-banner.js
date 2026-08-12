"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSteady } from "./steady-provider";
import {
  dismissPulsePattern,
  fetchPulseToday,
  localDateKey,
  logPulse,
  seedPulsePattern,
} from "../lib/daily-pulse-client";
import { fetchPendingOutcomes, forceOutcomeDue } from "../lib/outcomes-client";

const LEVELS = [
  { id: "busy", label: "Busy" },
  { id: "normal", label: "Normal" },
  { id: "slow", label: "Slow" },
];

/**
 * Daily Pulse Check — compact top bar: Busy / Normal / Slow + pattern help.
 */
export function DailyPulseBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { authToken, isAuthenticated, profileLoading } = useSteady();

  const dateKey = useMemo(() => localDateKey(), []);
  const [needsCheckin, setNeedsCheckin] = useState(false);
  const [pulse, setPulse] = useState(null);
  const [pattern, setPattern] = useState(null);
  const [history, setHistory] = useState([]);
  const [pendingOutcomes, setPendingOutcomes] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!authToken) return;
    try {
      const [data, pending] = await Promise.all([
        fetchPulseToday({ authToken, dateKey }),
        fetchPendingOutcomes({ authToken }).catch(() => ({ outcomes: [] })),
      ]);
      setNeedsCheckin(Boolean(data.needsCheckin));
      setPulse(data.pulse || null);
      setPattern(data.pattern || null);
      setHistory(Array.isArray(data.history) ? data.history : []);
      setPendingOutcomes(Array.isArray(pending.outcomes) ? pending.outcomes : []);
    } catch {
      // Best-effort.
    }
  }, [authToken, dateKey]);

  useEffect(() => {
    if (profileLoading || !isAuthenticated) return;
    refresh();
  }, [profileLoading, isAuthenticated, refresh]);

  if (!isAuthenticated || !pathname || pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

  const showCheckin = needsCheckin;
  const showPattern = Boolean(pattern?.message) && !pulse?.patternDismissedAt;
  // After today's tap: don't pin a fixed bar on every page (Upload, Home, etc.).
  // Keep a slim retap control only on Chat — the daily habit is the one 10-second check-in.
  const showCompact =
    !showCheckin && !showPattern && Boolean(pulse) && pathname?.startsWith("/chat");

  if (!showCheckin && !showPattern && !showCompact) return null;

  async function handleTap(level) {
    if (!authToken || busy) return;
    setBusy(level);
    setError("");
    setSavedFlash(false);
    try {
      const data = await logPulse({ authToken, level, dateKey });
      setPulse(data.pulse || null);
      setPattern(data.pattern || null);
      setHistory(Array.isArray(data.history) ? data.history : []);
      setNeedsCheckin(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      setError(err.message || "Could not save pulse.");
    } finally {
      setBusy("");
    }
  }

  async function handleHelp() {
    if (!pattern?.helpPrompt) return;
    setBusy("help");
    try {
      await dismissPulsePattern({ authToken, dateKey }).catch(() => null);
      router.push(`/chat?${new URLSearchParams({ prompt: pattern.helpPrompt })}`);
      setPattern(null);
    } finally {
      setBusy("");
    }
  }

  async function handleDismissPattern() {
    setBusy("dismiss");
    try {
      await dismissPulsePattern({ authToken, dateKey });
      setPattern(null);
      await refresh();
    } catch (err) {
      setError(err.message || "Could not dismiss.");
    } finally {
      setBusy("");
    }
  }

  async function handleSeed() {
    setBusy("seed");
    setError("");
    try {
      await seedPulsePattern({ authToken, level: "slow", count: 2, dateKey });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setError(err.message || "Seed failed.");
    } finally {
      setBusy("");
    }
  }

  async function handleForceOutcome() {
    const id = pendingOutcomes[0]?.id;
    if (!id) return;
    setBusy("force");
    try {
      await forceOutcomeDue({ authToken, outcomeId: id });
      setToolsOpen(false);
      window.location.reload();
    } catch (err) {
      setError(err.message || "Could not advance outcome.");
    } finally {
      setBusy("");
    }
  }

  const levelButtons = (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {LEVELS.map((opt) => {
        const selected = pulse?.level === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => handleTap(opt.id)}
            className="btn btn-sm"
            style={{
              minWidth: showCheckin ? 88 : 72,
              padding: showCheckin ? "8px 14px" : "5px 12px",
              fontSize: showCheckin ? 14 : 12,
              fontWeight: 600,
              border: selected ? "1px solid var(--gold)" : "1px solid var(--line)",
              background: selected ? "var(--gold-soft)" : "var(--bg)",
              color: "var(--ink)",
              boxShadow: selected ? "inset 0 0 0 1px var(--gold-ring)" : "none",
            }}
          >
            {busy === opt.id ? "…" : opt.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        borderBottom: "1px solid var(--line)",
        background: showPattern ? "var(--gold-soft)" : showCheckin ? "var(--bg-elev)" : "var(--bg)",
      }}
    >
      <div className="container" style={{ padding: showCompact ? "8px 24px" : "12px 24px" }}>
        {showCheckin && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 160 }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                  fontWeight: 700,
                  marginBottom: 2,
                }}
              >
                Daily pulse
              </div>
              <div className="serif" style={{ fontSize: 18, color: "var(--ink)", lineHeight: 1.2 }}>
                How&apos;s today?
              </div>
            </div>
            {levelButtons}
          </div>
        )}

        {showPattern && (
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--gold)",
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Pattern spotted
                </div>
                <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
                  {pattern.message}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)} onClick={handleHelp}>
                  {busy === "help" ? "Opening…" : "Yes, help me"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={Boolean(busy)}
                  onClick={handleDismissPattern}
                  style={{ color: "var(--ink-3)" }}
                >
                  Not now
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Change today:</span>
              {levelButtons}
            </div>
          </div>
        )}

        {showCompact && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--ink-3)",
                  fontWeight: 700,
                }}
              >
                Pulse
              </span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {history.slice(0, 7).map((h) => (
                  <span
                    key={h.dateKey}
                    title={`${h.weekday} · ${h.level}`}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background:
                        h.level === "busy" ? "var(--gold)" : h.level === "slow" ? "var(--ink-4)" : "var(--line-strong)",
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                Today:{" "}
                <strong style={{ color: "var(--ink)", textTransform: "capitalize" }}>{pulse?.level}</strong>
                {savedFlash ? <span style={{ color: "var(--gold)", marginLeft: 6 }}>Saved</span> : null}
              </span>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {levelButtons}
              {pathname?.startsWith("/chat") && (
                <button
                  type="button"
                  onClick={() => setToolsOpen((v) => !v)}
                  title="Testing tools"
                  style={{
                    background: "none",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    width: 28,
                    height: 28,
                    color: "var(--ink-3)",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ···
                </button>
              )}
            </div>
          </div>
        )}

        {toolsOpen && pathname?.startsWith("/chat") && (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--bg-soft)",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--ink-3)", marginRight: 4 }}>Test tools</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(busy)} onClick={handleSeed}>
              {busy === "seed" ? "Seeding…" : "Seed 2 slow weeks"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={Boolean(busy) || !pendingOutcomes.length}
              onClick={handleForceOutcome}
            >
              {busy === "force" ? "…" : "Make outcome due now"}
            </button>
            {!pendingOutcomes.length ? (
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>No pending outcome yet — ask Steady for advice first</span>
            ) : null}
          </div>
        )}

        {error ? <div style={{ marginTop: 8, fontSize: 13, color: "var(--danger)" }}>{error}</div> : null}
        {savedFlash && showCheckin === false && showPattern ? (
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-3)" }}>Pulse saved</div>
        ) : null}
      </div>
    </div>
  );
}
