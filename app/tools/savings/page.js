"use client";

import { useState } from "react";
import { GoldButton, PageShell, SAVINGS_SYSTEM, formatMessage } from "../../../components/steady-ui";
import { useSteady } from "../../../components/steady-provider";

export default function SavingsPage() {
  const { isPremium, runAssistantRequest } = useSteady();
  const [form, setForm] = useState({ revenue: "", topCost1: "", topCost2: "", topCost3: "", employees: "", rent: "" });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    if (!isPremium) {
      setResult("Upgrade to Pro or Business to use the savings tool.");
      return;
    }
    setLoading(true);
    try {
      const data = await runAssistantRequest({
        system: SAVINGS_SYSTEM,
        prompt: `Monthly Revenue: ${form.revenue} | Biggest Cost 1: ${form.topCost1} | Biggest Cost 2: ${form.topCost2} | Biggest Cost 3: ${form.topCost3} | Employees: ${form.employees} | Rent: ${form.rent}`,
      });
      setResult(data.content?.[0]?.text || "Unable to generate savings report.");
    } catch (error) {
      setResult(error.message || "Unable to generate savings report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell eyebrow="Tool" title="Cost Savings Calculator" description="A dedicated page for monthly savings recommendations.">
      {["revenue", "topCost1", "topCost2", "topCost3", "employees", "rent"].map((key) => <input key={key} value={form[key]} onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))} placeholder={key} style={inputStyle} />)}
      <GoldButton onClick={handleRun} disabled={loading}>{loading ? "Running..." : "Find Savings"}</GoldButton>
      {result && <div style={resultBox}>{formatMessage(result)}</div>}
    </PageShell>
  );
}

const inputStyle = { width: "100%", boxSizing: "border-box", background: "#191510", border: "1px solid #2A2520", borderRadius: "10px", padding: "12px 14px", color: "#E8DFD0", fontSize: "14px", fontFamily: "inherit", marginBottom: "10px", maxWidth: "560px", display: "block" };
const resultBox = { marginTop: "18px", background: "#15120E", border: "1px solid #252018", borderRadius: "16px", padding: "20px" };
