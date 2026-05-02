"use client";

import { useState } from "react";
import { GoldButton, PageShell, formatMessage } from "../../../components/steady-ui";
import { useSteady } from "../../../components/steady-provider";

const ACTION_SYSTEM = `You are Steady. Create a detailed, step-by-step action plan for a small business owner. Be specific. Use numbered steps. Include timelines, costs if relevant, and exact scripts or language they can use. End with "Next move:" — the single first step.`;

export default function ActionPage() {
  const { isPremium, runAssistantRequest } = useSteady();
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    if (!isPremium) {
      setResult("Upgrade to Pro or Business to use the action plan tool.");
      return;
    }
    setLoading(true);
    try {
      const data = await runAssistantRequest({
        system: ACTION_SYSTEM,
        prompt: `Create a complete action plan for: ${topic}`,
      });
      setResult(data.content?.[0]?.text || "Unable to generate action plan.");
    } catch (error) {
      setResult(error.message || "Unable to generate action plan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell eyebrow="Tool" title="Action Plan Builder" description="A dedicated page for turning one business problem into a step-by-step plan.">
      <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={6} placeholder="Describe the goal or problem" style={{ width: "100%", maxWidth: "640px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "12px", padding: "14px", color: "var(--ink)", fontFamily: "inherit", fontSize: "15px", resize: "vertical" }} />
      <div style={{ marginTop: "12px" }}>
        <GoldButton onClick={handleRun} disabled={loading || !topic.trim()}>{loading ? "Building..." : "Build Plan"}</GoldButton>
      </div>
      {result && <div style={{ marginTop: "18px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "16px", padding: "20px", color: "var(--ink-2)" }}>{formatMessage(result)}</div>}
    </PageShell>
  );
}
