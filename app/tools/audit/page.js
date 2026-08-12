"use client";

import { useState } from "react";
import { AUDIT_SYSTEM, GoldButton, PageShell, formatMessage } from "../../../components/steady-ui";
import { ExplainToMyTeam } from "../../../components/explain-to-my-team";
import { useSteady } from "../../../components/steady-provider";
import { scheduleOutcome } from "../../../lib/outcomes-client";

export default function AuditPage() {
  const { isPremium, runAssistantRequest, authToken } = useSteady();
  const [form, setForm] = useState({ bizType: "restaurant", revenue: "", foodCost: "", laborCost: "", rent: "", utilities: "", other: "" });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    if (!isPremium) {
      setResult("Upgrade to Pro or Business to use the audit tool.");
      return;
    }

    setLoading(true);
    try {
      const rev = parseFloat(form.revenue) || 0;
      const food = parseFloat(form.foodCost) || 0;
      const labor = parseFloat(form.laborCost) || 0;
      const rent = parseFloat(form.rent) || 0;
      const util = parseFloat(form.utilities) || 0;
      const other = parseFloat(form.other) || 0;
      const totalCosts = food + labor + rent + util + other;
      const profit = rev - totalCosts;
      const prompt = `Business: ${form.bizType} | Revenue: $${rev.toLocaleString()} | Food/Product Cost: $${food} | Labor: $${labor} | Rent: $${rent} | Utilities: $${util} | Other: $${other} | Total Costs: $${totalCosts.toLocaleString()} | Net Profit: $${profit.toLocaleString()}`;
      const data = await runAssistantRequest({
        system: AUDIT_SYSTEM,
        prompt,
      });
      const text = data.content?.[0]?.text || "Unable to generate audit.";
      setResult(text);
      scheduleOutcome({
        authToken,
        advice: text,
        userPrompt: prompt,
        source: "tool_audit",
      }).catch(() => null);
    } catch (error) {
      setResult(error.message || "Unable to generate audit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell eyebrow="Tool" title="Monthly Business Audit" description="A dedicated route for the audit tool.">
      {["revenue", "foodCost", "laborCost", "rent", "utilities", "other"].map((key) => <input key={key} value={form[key]} onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))} placeholder={key} style={inputStyle} />)}
      <GoldButton onClick={handleRun} disabled={loading}>{loading ? "Running..." : "Run Audit"}</GoldButton>
      {result && (
        <div style={resultBox}>
          {formatMessage(result)}
          {isPremium ? <ExplainToMyTeam advice={result} /> : null}
        </div>
      )}
    </PageShell>
  );
}

const inputStyle = { width: "100%", boxSizing: "border-box", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", padding: "12px 14px", color: "var(--ink)", fontSize: "14px", fontFamily: "inherit", marginBottom: "10px", maxWidth: "560px", display: "block" };
const resultBox = { marginTop: "18px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "16px", padding: "20px", color: "var(--ink-2)" };
