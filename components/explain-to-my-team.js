"use client";

import { useEffect, useState } from "react";
import { useSteady } from "./steady-provider";
import { formatMessage } from "./steady-ui";
import { explainToMyTeam } from "../lib/explain-to-team-client";

/**
 * One-click rewrite of any Steady response into plain staff language + copy.
 */
export function ExplainToMyTeam({ advice, compact = false }) {
  const { authToken, isAuthenticated } = useSteady();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState("");
  const [copied, setCopied] = useState(false);

  const source = String(advice || "").trim();
  const canUse = Boolean(isAuthenticated && source && !loading);

  useEffect(() => {
    // Reset when the underlying Steady response changes.
    setOpen(false);
    setExplanation("");
    setError("");
    setCopied(false);
  }, [source]);

  async function handleExplain() {
    if (!canUse) return;
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const data = await explainToMyTeam({ authToken, advice: source });
      setExplanation(data.explanation || "");
      setOpen(true);
    } catch (err) {
      setError(err.message || "Could not rewrite for your team.");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!explanation) return;
    try {
      await navigator.clipboard.writeText(explanation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the text and copy manually.");
    }
  }

  if (!source) return null;

  return (
    <div style={{ marginTop: compact ? 12 : 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleExplain}
          disabled={!canUse}
          title="Rewrite in plain language for your staff"
          style={{
            borderColor: "var(--gold-ring)",
            color: "var(--ink)",
            background: "var(--gold-soft)",
          }}
        >
          {loading ? "Rewriting…" : "Explain to my team"}
        </button>
        {open && explanation && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleCopy}>
            {copied ? "Copied" : "Copy for staff"}
          </button>
        )}
        {open && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setOpen(false)}
            style={{ color: "var(--ink-3)" }}
          >
            Hide
          </button>
        )}
      </div>

      {open && (explanation || error) && (
        <div
          style={{
            marginTop: 12,
            padding: compact ? "14px 16px" : "18px 20px",
            borderRadius: 14,
            border: "1px solid var(--line)",
            background: "var(--bg-elev)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--gold)",
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            For your team · plain English
          </div>
          {error ? (
            <div style={{ color: "var(--danger)", fontSize: 14 }}>{error}</div>
          ) : (
            <div style={{ color: "var(--ink-2)" }}>{formatMessage(explanation)}</div>
          )}
        </div>
      )}
    </div>
  );
}
