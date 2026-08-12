"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSteady } from "./steady-provider";
import {
  buildPartialFollowUpPrompt,
  fetchDueOutcomes,
  respondToOutcome,
} from "../lib/outcomes-client";

function formatInline(text) {
  const raw = String(text ?? "");
  const parts = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = re.exec(raw)) !== null) {
    if (match.index > last) parts.push(raw.slice(last, match.index));
    parts.push(
      <strong key={`b-${key++}`} style={{ fontWeight: 700, color: "var(--ink)" }}>
        {match[1]}
      </strong>
    );
    last = match.index + match[0].length;
  }
  if (last < raw.length) parts.push(raw.slice(last));
  return parts.length ? parts : raw;
}
function cleanExcerpt(text = "") {
  return String(text)
    .replace(/\s*---+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prefer Next move / short preview so the bar doesn't dump a truncated wall of text. */
function previewAdvice(text = "") {
  const cleaned = cleanExcerpt(text);
  if (!cleaned) return "";
  const next = cleaned.match(/next move:\s*(.+)$/i);
  if (next?.[1]) {
    const move = next[1].trim();
    return move.length > 180 ? `${move.slice(0, 177)}…` : move;
  }
  if (cleaned.length <= 160) return cleaned;
  const slice = cleaned.slice(0, 160);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

/**
 * Outcome Memory Loop — compact due checkup only.
 */
export function OutcomeCheckupBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { authToken, isAuthenticated, profileLoading } = useSteady();
  const [due, setDue] = useState([]);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    if (!authToken) return;
    try {
      const dueData = await fetchDueOutcomes({ authToken });
      const dueList = dueData.outcomes || [];
      setDue(dueList);
      setActive((current) => {
        if (current && dueList.some((o) => o.id === current.id)) {
          return dueList.find((o) => o.id === current.id) || dueList[0] || null;
        }
        return dueList[0] || null;
      });
    } catch {
      // Silent.
    }
  }, [authToken]);

  useEffect(() => {
    if (profileLoading || !isAuthenticated) return;
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [profileLoading, isAuthenticated, refresh]);

  useEffect(() => {
    setExpanded(false);
  }, [active?.id]);

  if (!isAuthenticated || !pathname || pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

  if (!active) return null;

  async function handleRespond(status) {
    if (!active?.id || !authToken) return;
    setBusy(status);
    setError("");
    try {
      await respondToOutcome({ authToken, outcomeId: active.id, status });
      if (status === "partially") {
        const prompt = buildPartialFollowUpPrompt(active);
        router.push(`/chat?${new URLSearchParams({ prompt })}`);
      }
      await refresh();
    } catch (err) {
      setError(err.message || "Could not save outcome.");
    } finally {
      setBusy("");
    }
  }

  const preview = previewAdvice(active.adviceExcerpt);
  const full = cleanExcerpt(active.adviceExcerpt);

  return (
    <div style={{ borderBottom: "1px solid var(--line)", background: "var(--gold-soft)" }}>
      <div className="container" style={{ padding: "10px 24px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 240px", minWidth: 0, maxWidth: 640 }}>
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
              Outcome checkup
            </div>
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)", marginBottom: 4 }}>
              Did Steady&apos;s advice help?
            </div>
            {active.userPromptExcerpt ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-3)",
                  marginBottom: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={active.userPromptExcerpt}
              >
                About: {active.userPromptExcerpt}
              </div>
            ) : null}
            <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
              {expanded ? formatInline(full) : formatInline(preview)}
              {full.length > preview.length ? (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  style={{
                    marginLeft: 6,
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--gold)",
                    cursor: "pointer",
                    fontSize: 13,
                    textDecoration: "underline",
                  }}
                >
                  {expanded ? "Less" : "More"}
                </button>
              ) : null}
            </div>
            {due.length > 1 ? (
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                {due.length} waiting · oldest first
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", flex: "0 1 auto" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={Boolean(busy)}
              onClick={() => handleRespond("worked")}
            >
              {busy === "worked" ? "…" : "Worked"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={Boolean(busy)}
              onClick={() => handleRespond("partially")}
              style={{ borderColor: "var(--gold-ring)", background: "var(--bg-elev)" }}
            >
              {busy === "partially" ? "…" : "Partially"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={Boolean(busy)}
              onClick={() => handleRespond("didnt_try")}
            >
              {busy === "didnt_try" ? "…" : "Didn't try"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={Boolean(busy)}
              onClick={() => handleRespond("dismissed")}
              style={{ color: "var(--ink-3)" }}
            >
              Dismiss
            </button>
          </div>
        </div>

        {error ? <div style={{ marginTop: 8, fontSize: 13, color: "var(--danger)" }}>{error}</div> : null}
      </div>
    </div>
  );
}
