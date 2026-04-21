"use client";

import { useState, useRef, useEffect } from "react";

const FREE_LIMIT = 5;

const STARTER_QUESTIONS = [
  "My employee keeps calling out last minute. What do I do?",
  "I got a bad review and I don't know how to respond.",
  "I think I'm undercharging but I'm scared to raise prices.",
  "I'm losing money but I don't know where it's going.",
  "I need to hire someone but I've never done it before.",
  "A customer is threatening to sue me. What's my first move?",
];

const FREE_SYSTEM = `You are Steady — a straight-talking AI co-pilot for small business owners: restaurants, pawnshops, auto shops, and anyone running a real business.

Rules:
- Be direct. No fluff. No corporate speak.
- Write 3-4 solid paragraphs. Give real specifics, real examples, real language they can actually use. Enough to genuinely help — not so much they stop reading.
- Write like a trusted friend who has been in the trenches with them.
- Always end with "Next move:" followed by one specific action they can take today.
- Never say "consider" or "it depends" — give a real answer.`;

const PREMIUM_SYSTEM = `You are Steady — a premium AI business advisor for small business owners: restaurants, pawnshops, auto shops, and anyone running a real business.

Rules:
- Be direct. No corporate speak. No filler.
- Write 4-6 paragraphs with real depth. Use numbered steps and breakdowns when it helps.
- Be specific — use dollar amounts, percentages, scripts they can say word for word.
- Write like a seasoned advisor who has run businesses and seen everything.
- Always end with "Next move:" followed by one specific action they can take today.
- Mention money implications whenever relevant — what they could save or earn.
- Never say "consider" or "it depends" — give a real answer.`;

const AUDIT_SYSTEM = `You are Steady's Business Audit engine. Analyze the business data and give a thorough honest assessment.

Structure your response exactly like this:

HEALTH SCORE: [X/100]

WHERE YOUR MONEY IS GOING:
[Breakdown of each cost as % of revenue. Compare to industry benchmarks. Be specific.]

WHAT'S WORKING:
[2-3 genuine strengths based on their numbers]

WHERE YOU'RE BLEEDING:
[Specific problem areas with dollar amounts. Be honest even if it's hard to hear.]

BIGGEST OPPORTUNITY:
[The single highest-impact thing they can do right now to make or save money]

ACTION PLAN:
1. [Step one - most urgent]
2. [Step two]
3. [Step three]
4. [Step four]
5. [Step five]

Next move: [The one thing to do this week]

Be specific. Use their actual numbers. Compare to industry standards.`;

const SAVINGS_SYSTEM = `You are Steady's Cost Savings Calculator. The user will give you their monthly business numbers. 

Analyze their costs and identify specific savings opportunities. Structure your response like this:

POTENTIAL MONTHLY SAVINGS: $[total amount]

TOP SAVINGS OPPORTUNITIES:
1. [Specific saving with dollar amount and exactly how to achieve it]
2. [Specific saving with dollar amount and exactly how to achieve it]
3. [Specific saving with dollar amount and exactly how to achieve it]
4. [Specific saving with dollar amount and exactly how to achieve it]
5. [Specific saving with dollar amount and exactly how to achieve it]

QUICK WINS (this week):
[2-3 things they can do immediately with zero cost]

ANNUAL IMPACT: $[yearly savings if they act on all opportunities]

Next move: [The single most impactful saving to tackle first]

Be specific with numbers. Use industry benchmarks. Give them real actionable ways to cut costs without hurting quality.`;

const TypingIndicator = () => (
  <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "16px 20px" }}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "#C8A96E",
          animation: "pulse 1.2s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
        }}
      />
    ))}
  </div>
);

const GoldButton = ({ onClick, children, style = {} }) => (
  <button
    onClick={onClick}
    className="gold-btn"
    style={{
      background: "linear-gradient(135deg,#C8A96E,#A07840)",
      border: "none",
      borderRadius: "10px",
      padding: "14px 28px",
      color: "#0F0D0A",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "pointer",
      fontFamily: "inherit",
      letterSpacing: "0.3px",
      transition: "all 0.2s",
      ...style,
    }}
  >
    {children}
  </button>
);

const PremiumCard = ({ emoji, title, desc, onClick }) => (
  <button
    onClick={onClick}
    className="premium-card"
    style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid #252018",
      borderRadius: "12px",
      padding: "18px 16px",
      cursor: "pointer",
      transition: "all 0.2s",
      textAlign: "left",
      fontFamily: "inherit",
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: "14px",
    }}
  >
    <span style={{ fontSize: "24px", flexShrink: 0 }}>{emoji}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: "14px", color: "#C8A96E", fontWeight: "600", marginBottom: "3px" }}>{title}</div>
      <div style={{ fontSize: "12px", color: "#5A5248", lineHeight: "1.4" }}>{desc}</div>
    </div>
    <span style={{ color: "#3A3530", fontSize: "16px", flexShrink: 0 }}>→</span>
  </button>
);

async function callSteady({ system, messages, max_tokens }) {
  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      system,
      messages,
      max_tokens,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || "Request failed.";
    throw new Error(msg);
  }
  return data;
}

export default function Steady() {
  const [screen, setScreen] = useState("home");
  const [isPremium, setIsPremium] = useState(false);
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState({ bizType: "restaurant", revenue: "", foodCost: "", laborCost: "", rent: "", utilities: "", other: "" });
  const [auditResult, setAuditResult] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [savingsData, setSavingsData] = useState({ bizType: "restaurant", revenue: "", topCost1: "", topCost2: "", topCost3: "", employees: "", rent: "" });
  const [savingsResult, setSavingsResult] = useState("");
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [actionTopic, setActionTopic] = useState("");
  const [actionResult, setActionResult] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const formatMessage = (text) => {
    const lines = text.split("\n").filter((l) => l.trim());
    return lines.map((line, i) => {
      if (line.toLowerCase().startsWith("next move:")) {
        return (
          <div key={i} style={{ marginTop: "16px", padding: "14px 16px", background: "rgba(200,169,110,0.08)", borderLeft: "3px solid #C8A96E", borderRadius: "0 8px 8px 0" }}>
            <span style={{ display: "block", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "5px" }}>Next Move</span>
            <span style={{ fontSize: "15px", color: "#E8DFD0", lineHeight: "1.5" }}>{line.replace(/next move:/i, "").trim()}</span>
          </div>
        );
      }
      if (line.match(/^[A-Z][A-Z\s]+:/) && line.length < 60) {
        return <div key={i} style={{ marginTop: "18px", marginBottom: "6px", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#C8A96E", fontWeight: "700" }}>{line}</div>;
      }
      if (line.match(/^\d+\./)) {
        return (
          <div key={i} style={{ display: "flex", gap: "10px", margin: "8px 0", paddingLeft: "4px" }}>
            <span style={{ color: "#C8A96E", fontWeight: "700", flexShrink: 0, minWidth: "20px" }}>{line.match(/^\d+/)[0]}.</span>
            <span style={{ color: "#D4C9B8", lineHeight: "1.65", fontSize: "15px" }}>{line.replace(/^\d+\./, "").trim()}</span>
          </div>
        );
      }
      if (line.startsWith("-")) {
        return (
          <div key={i} style={{ display: "flex", gap: "8px", margin: "5px 0", paddingLeft: "4px" }}>
            <span style={{ color: "#C8A96E", flexShrink: 0 }}>—</span>
            <span style={{ color: "#D4C9B8", lineHeight: "1.65", fontSize: "15px" }}>{line.replace(/^-/, "").trim()}</span>
          </div>
        );
      }
      return (
        <p key={i} style={{ margin: "0 0 12px 0", lineHeight: "1.75", fontSize: "15px", color: "#D4C9B8" }}>
          {line}
        </p>
      );
    });
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    if (!isPremium && questionsUsed >= FREE_LIMIT) {
      setScreen("upgrade");
      return;
    }

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setScreen("chat");

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);
    if (!isPremium) setQuestionsUsed((q) => q + 1);

    try {
      const data = await callSteady({
        system: isPremium ? PREMIUM_SYSTEM : FREE_SYSTEM,
        messages: newMessages,
        max_tokens: isPremium ? 2000 : 1200,
      });
      setMessages([...newMessages, { role: "assistant", content: data.content?.[0]?.text || "Something went wrong." }]);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: e?.message || "Connection issue. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const runAudit = async () => {
    setAuditLoading(true);
    setScreen("auditResult");

    const rev = parseFloat(auditData.revenue) || 0;
    const food = parseFloat(auditData.foodCost) || 0;
    const labor = parseFloat(auditData.laborCost) || 0;
    const rent = parseFloat(auditData.rent) || 0;
    const util = parseFloat(auditData.utilities) || 0;
    const other = parseFloat(auditData.other) || 0;
    const totalCosts = food + labor + rent + util + other;
    const profit = rev - totalCosts;

    const prompt = `Business: ${auditData.bizType} | Revenue: $${rev.toLocaleString()} | Food/Product Cost: $${food} (${rev ? ((food / rev) * 100).toFixed(1) : 0}%) | Labor: $${labor} (${rev ? ((labor / rev) * 100).toFixed(1) : 0}%) | Rent: $${rent} (${rev ? ((rent / rev) * 100).toFixed(1) : 0}%) | Utilities: $${util} | Other: $${other} | Total Costs: $${totalCosts.toLocaleString()} | Net Profit: $${profit.toLocaleString()} (${rev ? ((profit / rev) * 100).toFixed(1) : 0}% margin)`;

    try {
      const data = await callSteady({
        system: AUDIT_SYSTEM,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      });
      setAuditResult(data.content?.[0]?.text || "Unable to generate audit.");
    } catch (e) {
      setAuditResult(e?.message || "Connection issue. Please try again.");
    } finally {
      setAuditLoading(false);
    }
  };

  const runSavings = async () => {
    setSavingsLoading(true);
    setScreen("savingsResult");

    const prompt = `Business: ${savingsData.bizType} | Monthly Revenue: $${savingsData.revenue} | Biggest Cost 1: $${savingsData.topCost1} | Biggest Cost 2: $${savingsData.topCost2} | Biggest Cost 3: $${savingsData.topCost3} | Number of Employees: ${savingsData.employees} | Monthly Rent: $${savingsData.rent}`;

    try {
      const data = await callSteady({
        system: SAVINGS_SYSTEM,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      });
      setSavingsResult(data.content?.[0]?.text || "Unable to calculate savings.");
    } catch (e) {
      setSavingsResult(e?.message || "Connection issue. Please try again.");
    } finally {
      setSavingsLoading(false);
    }
  };

  const runActionPlan = async () => {
    if (!actionTopic.trim()) return;
    setActionLoading(true);
    setScreen("actionResult");

    try {
      const data = await callSteady({
        system: `You are Steady. Create a detailed, step-by-step action plan for a small business owner. Be specific. Use numbered steps. Include timelines, costs if relevant, and exact scripts or language they can use. End with "Next move:" — the single first step.`,
        messages: [{ role: "user", content: `Create a complete action plan for: ${actionTopic}` }],
        max_tokens: 2000,
      });
      setActionResult(data.content?.[0]?.text || "Unable to generate plan.");
    } catch (e) {
      setActionResult(e?.message || "Connection issue. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const exportPDF = (content, title) => {
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(
      `<html><head><title>${title}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#222;line-height:1.8;font-size:16px}h1{color:#8B6914;border-bottom:2px solid #C8A96E;padding-bottom:12px}h2{color:#8B6914;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin-top:28px}.next-move{background:#fff8e7;border-left:4px solid #C8A96E;padding:14px 18px;margin:20px 0;border-radius:0 8px 8px 0}p{margin:0 0 14px 0}</style></head><body><h1>📊 ${title}</h1><p style="color:#888;font-size:13px">Generated by Steady · ${new Date().toLocaleDateString(
        "en-US",
        { month: "long", day: "numeric", year: "numeric" }
      )}</p>${content
        .replace(/Next move:(.*?)(\n|$)/gi, '<div class="next-move"><strong>Next Move:</strong>$1</div>')
        .replace(/\n/g, "<br>")}</body></html>`
    );
    win.document.close();
    win.print();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  const remaining = FREE_LIMIT - questionsUsed;

  const ResultScreen = ({ title, result, loading, loadingText, onBack, onBackLabel, onExport }) => (
    <div style={{ padding: "20px 16px", maxWidth: "680px", margin: "0 auto", width: "100%", boxSizing: "border-box", animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <div style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "4px" }}>{title}</div>
          <div style={{ fontSize: "12px", color: "#4A4540" }}>{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
        </div>
        {!loading && onExport && (
          <button
            onClick={onExport}
            style={{ background: "none", border: "1px solid #2A2520", borderRadius: "8px", padding: "8px 14px", color: "#5A5248", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "6px" }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#C8A96E";
              e.currentTarget.style.color = "#C8A96E";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "#2A2520";
              e.currentTarget.style.color = "#5A5248";
            }}
          >
            📄 Export PDF
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "16px" }}>
          <TypingIndicator />
          <div style={{ fontSize: "14px", color: "#5A5248" }}>{loadingText}</div>
        </div>
      ) : (
        <div style={{ background: "#191510", border: "1px solid #2A2218", borderRadius: "12px", padding: "22px" }}>{formatMessage(result)}</div>
      )}
      {!loading && (
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            onClick={onBack}
            style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid #2A2520", borderRadius: "10px", padding: "12px", color: "#8A7E70", fontSize: "14px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = "#C8A96E")}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = "#2A2520")}
          >
            ← {onBackLabel}
          </button>
          <button
            onClick={() => {
              setMessages([]);
              setScreen("chat");
            }}
            style={{ flex: 1, background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.25)", borderRadius: "10px", padding: "12px", color: "#C8A96E", fontSize: "14px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(200,169,110,0.15)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(200,169,110,0.08)")}
          >
            Ask Follow-up →
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ height: "100vh", background: "#0F0D0A", fontFamily: "'Georgia','Times New Roman',serif", color: "#E8DFD0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        .starter-btn:hover{background:rgba(200,169,110,0.07)!important;border-color:rgba(200,169,110,0.4)!important;color:#C8A96E!important}
        .premium-card:hover{background:rgba(200,169,110,0.07)!important;border-color:rgba(200,169,110,0.4)!important}
        .premium-card:hover span:last-child{color:#C8A96E!important}
        .send-btn:hover:not(:disabled){background:#B8934A!important}
        .gold-btn:hover{opacity:0.9;transform:translateY(-1px)}
        .audit-input:focus{border-color:#C8A96E!important;outline:none!important}
        textarea{outline:none!important}
        textarea::placeholder{color:#4A4540}
        input::placeholder{color:#3A3530}
        input{outline:none!important}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#2A2520;border-radius:2px}
        select{outline:none}
        select option{background:#1A1510}
      `}</style>

      <div style={{ padding: "14px 18px", borderBottom: "1px solid #1E1A15", display: "flex", alignItems: "center", gap: "10px", background: "rgba(15,13,10,0.98)", flexShrink: 0 }}>
        {screen !== "home" && (
          <button
            onClick={() => setScreen(["auditResult", "savingsResult", "actionResult"].includes(screen) ? screen.replace("Result", "") : "home")}
            style={{ background: "none", border: "none", color: "#4A4540", fontSize: "22px", cursor: "pointer", padding: "0 4px 0 0", lineHeight: 1, fontFamily: "inherit", transition: "color 0.2s" }}
            onMouseOver={(e) => (e.target.style.color = "#C8A96E")}
            onMouseOut={(e) => (e.target.style.color = "#4A4540")}
          >
            ‹
          </button>
        )}
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg,#C8A96E,#8B6914)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "bold", color: "#0F0D0A", flexShrink: 0 }}>
          S
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "16px", fontWeight: "600", letterSpacing: "0.4px", color: "#E8DFD0" }}>Steady</div>
          <div style={{ fontSize: "10px", color: "#4A4540", letterSpacing: "1.2px", textTransform: "uppercase" }}>Your Business Co-Pilot</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isPremium ? (
            <div style={{ background: "rgba(200,169,110,0.15)", border: "1px solid rgba(200,169,110,0.3)", borderRadius: "20px", padding: "3px 10px", fontSize: "10px", color: "#C8A96E", letterSpacing: "1px" }}>PREMIUM</div>
          ) : (
            <button
              onClick={() => setScreen("upgrade")}
              style={{ background: "rgba(200,169,110,0.1)", border: "1px solid rgba(200,169,110,0.25)", borderRadius: "20px", padding: "3px 10px", fontSize: "10px", color: "#C8A96E", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.5px", transition: "all 0.2s" }}
              onMouseOver={(e) => (e.target.style.background = "rgba(200,169,110,0.2)")}
              onMouseOut={(e) => (e.target.style.background = "rgba(200,169,110,0.1)")}
            >
              Upgrade $20/mo
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#4CAF7D" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#4CAF7D" }} />
            Ready
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {screen === "home" && !isPremium && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 20px", animation: "fadeIn 0.5s ease" }}>
            <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "14px", opacity: 0.8 }}>Built for real business owners</div>
            <h1 style={{ fontSize: "clamp(26px,5vw,44px)", fontWeight: "400", textAlign: "center", lineHeight: "1.2", margin: "0 0 12px 0", color: "#E8DFD0", maxWidth: "480px" }}>
              Tell me your problem.
              <br />
              <span style={{ background: "linear-gradient(90deg,#C8A96E,#E8C87A,#C8A96E)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 3s linear infinite" }}>
                I'll tell you what to do.
              </span>
            </h1>
            <p style={{ fontSize: "14px", color: "#6A6058", textAlign: "center", maxWidth: "340px", lineHeight: "1.7", margin: "0 0 8px 0" }}>
              No fluff. No corporate speak. Straight answers for restaurants, pawnshops, auto shops, and anyone running a real business.
            </p>
            <div style={{ fontSize: "12px", color: "#4A4540", marginBottom: "28px" }}>
              {remaining} free question{remaining !== 1 ? "s" : ""} remaining today
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxWidth: "540px", width: "100%" }}>
              {STARTER_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className="starter-btn"
                  onClick={() => sendMessage(q)}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #2A2520", borderRadius: "10px", padding: "14px 16px", color: "#8A7E70", fontSize: "13px", textAlign: "left", cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit", lineHeight: "1.4" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {screen === "home" && isPremium && (
          <div style={{ flex: 1, padding: "24px 20px", maxWidth: "600px", margin: "0 auto", width: "100%", boxSizing: "border-box", animation: "fadeIn 0.5s ease" }}>
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "6px" }}>Premium Dashboard</div>
              <h2 style={{ fontSize: "22px", fontWeight: "400", margin: "0 0 4px 0", color: "#E8DFD0" }}>What do you need today?</h2>
              <p style={{ fontSize: "13px", color: "#4A4540", margin: 0 }}>All tools included. Unlimited access.</p>
            </div>

            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "#5A5248", marginBottom: "12px" }}>Ask Anything</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {STARTER_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    className="starter-btn"
                    onClick={() => sendMessage(q)}
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #252018", borderRadius: "10px", padding: "12px 14px", color: "#7A6E60", fontSize: "12px", textAlign: "left", cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit", lineHeight: "1.4" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "#5A5248", marginBottom: "12px" }}>Premium Tools</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <PremiumCard emoji="📊" title="Monthly Business Audit" desc="Enter your numbers. Find out exactly where you're making and losing money." onClick={() => setScreen("audit")} />
                <PremiumCard emoji="💰" title="Cost Savings Calculator" desc="See how much you could save each month and exactly how to do it." onClick={() => setScreen("savings")} />
                <PremiumCard emoji="📋" title="Build an Action Plan" desc="Give us a goal or problem. Get a step-by-step plan you can act on today." onClick={() => setScreen("action")} />
                <PremiumCard emoji="📄" title="Export Any Answer to PDF" desc="Save your advice, audit, or plan as a printable PDF report." onClick={() => { setMessages([]); setScreen("chat"); }} />
              </div>
            </div>
          </div>
        )}

        {screen === "chat" && (
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "680px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeUp 0.3s ease" }}>
                {msg.role === "assistant" && <div style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "6px", paddingLeft: "4px" }}>Steady</div>}
                <div style={{ maxWidth: "88%", padding: msg.role === "user" ? "12px 18px" : "18px 22px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px", background: msg.role === "user" ? "linear-gradient(135deg,#C8A96E,#A07840)" : "#191510", color: msg.role === "user" ? "#0F0D0A" : "#D4C9B8", fontSize: "15px", lineHeight: "1.65", border: msg.role === "assistant" ? "1px solid #2A2218" : "none", fontFamily: "inherit" }}>
                  {msg.role === "user" ? msg.content : formatMessage(msg.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", animation: "fadeUp 0.3s ease" }}>
                <div style={{ fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "6px", paddingLeft: "4px" }}>Steady</div>
                <div style={{ background: "#191510", border: "1px solid #2A2218", borderRadius: "4px 18px 18px 18px" }}>
                  <TypingIndicator />
                </div>
              </div>
            )}
            {isPremium && messages.length > 0 && !loading && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: "4px" }}>
                <button
                  onClick={() => exportPDF(messages.filter((m) => m.role === "assistant").map((m) => m.content).join("\n\n---\n\n"), "Steady Advice Report")}
                  style={{ background: "none", border: "1px solid #2A2520", borderRadius: "8px", padding: "8px 16px", color: "#5A5248", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s" }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "#C8A96E";
                    e.currentTarget.style.color = "#C8A96E";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "#2A2520";
                    e.currentTarget.style.color = "#5A5248";
                  }}
                >
                  📄 Export as PDF
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {screen === "upgrade" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", animation: "fadeIn 0.4s ease" }}>
            <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "14px" }}>Unlock Full Access</div>
            <h2 style={{ fontSize: "30px", fontWeight: "400", margin: "0 0 6px 0", color: "#E8DFD0", textAlign: "center" }}>Steady Premium</h2>
            <div style={{ fontSize: "40px", fontWeight: "700", color: "#C8A96E", margin: "6px 0 2px 0" }}>$20</div>
            <div style={{ fontSize: "13px", color: "#5A5248", marginBottom: "32px" }}>per month — less than one bad vendor decision</div>
            <div style={{ maxWidth: "400px", width: "100%", marginBottom: "28px" }}>
              {[
                ["♾️", "Unlimited questions", "Ask as much as you need, anytime"],
                ["📊", "Monthly Business Audit", "Full financial breakdown — where you're winning and losing"],
                ["💰", "Cost Savings Calculator", "Find money you're leaving on the table every month"],
                ["📋", "Full Action Plans", "Step-by-step playbooks for any business problem"],
                ["📄", "PDF Export", "Save and print any answer or report"],
                ["⚡", "Deeper AI Answers", "More thorough, more specific, more valuable"],
              ].map(([e, t, d], i) => (
                <div key={i} style={{ display: "flex", gap: "14px", padding: "12px 0", borderBottom: "1px solid #1A1510" }}>
                  <span style={{ fontSize: "18px", flexShrink: 0 }}>{e}</span>
                  <div>
                    <div style={{ fontSize: "14px", color: "#E8DFD0", marginBottom: "2px" }}>{t}</div>
                    <div style={{ fontSize: "12px", color: "#5A5248" }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <GoldButton
              onClick={() => {
                setIsPremium(true);
                setScreen("home");
              }}
              style={{ width: "100%", maxWidth: "400px", padding: "16px", fontSize: "16px" }}
            >
              Start Premium — $20/month
            </GoldButton>
            <p style={{ fontSize: "12px", color: "#3A3530", marginTop: "10px" }}>Cancel anytime. No contracts.</p>
            <button
              onClick={() => setScreen(messages.length > 0 ? "chat" : "home")}
              style={{ marginTop: "14px", background: "none", border: "none", color: "#3A3530", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}
              onMouseOver={(e) => (e.target.style.color = "#6A6058")}
              onMouseOut={(e) => (e.target.style.color = "#3A3530")}
            >
              Continue with free version
            </button>
          </div>
        )}

        {screen === "audit" && (
          <div style={{ flex: 1, padding: "22px 18px", maxWidth: "560px", margin: "0 auto", width: "100%", boxSizing: "border-box", animation: "fadeIn 0.4s ease" }}>
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "8px" }}>📊 Monthly Business Audit</div>
              <p style={{ fontSize: "14px", color: "#6A6058", margin: 0, lineHeight: "1.6" }}>Enter last month's numbers. Steady will tell you exactly where you're making money, where you're losing it, and what to fix first.</p>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#5A5248", marginBottom: "7px" }}>Business Type</label>
              <select value={auditData.bizType} onChange={(e) => setAuditData({ ...auditData, bizType: e.target.value })} style={{ width: "100%", background: "#191510", border: "1px solid #2A2520", borderRadius: "8px", padding: "11px 14px", color: "#E8DFD0", fontSize: "14px", fontFamily: "inherit" }}>
                <option value="restaurant">Restaurant / Food & Beverage</option>
                <option value="pawnshop">Pawnshop / Resale</option>
                <option value="mechanic">Auto Shop / Mechanic</option>
                <option value="retail">Retail Store</option>
                <option value="service">Service Business</option>
                <option value="other">Other Small Business</option>
              </select>
            </div>
            {[
              ["revenue", "Monthly Revenue (Total Sales)", "e.g. 45000"],
              ["foodCost", "Cost of Goods / Food Cost", "e.g. 15000"],
              ["laborCost", "Labor / Payroll", "e.g. 12000"],
              ["rent", "Rent / Lease", "e.g. 4500"],
              ["utilities", "Utilities", "e.g. 800"],
              ["other", "Other Expenses", "e.g. 2000"],
            ].map(([key, label, ph]) => (
              <div key={key} style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#5A5248", marginBottom: "7px" }}>{label}</label>
                <div style={{ display: "flex", alignItems: "center", background: "#191510", border: "1px solid #2A2520", borderRadius: "8px", overflow: "hidden" }}>
                  <span style={{ padding: "11px 12px", color: "#5A5248", fontSize: "14px", borderRight: "1px solid #2A2520" }}>$</span>
                  <input className="audit-input" type="number" placeholder={ph} value={auditData[key]} onChange={(e) => setAuditData({ ...auditData, [key]: e.target.value })} style={{ flex: 1, background: "transparent", border: "none", padding: "11px 12px", color: "#E8DFD0", fontSize: "14px", fontFamily: "inherit" }} />
                </div>
              </div>
            ))}
            {auditData.revenue &&
              (() => {
                const r = parseFloat(auditData.revenue) || 0;
                const c = (parseFloat(auditData.foodCost) || 0) + (parseFloat(auditData.laborCost) || 0) + (parseFloat(auditData.rent) || 0) + (parseFloat(auditData.utilities) || 0) + (parseFloat(auditData.other) || 0);
                const p = r - c;
                return (
                  <div style={{ background: "#191510", border: "1px solid #2A2218", borderRadius: "10px", padding: "14px", marginBottom: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", textAlign: "center" }}>
                    {[
                      ["Revenue", `$${r.toLocaleString()}`, "#E8DFD0"],
                      ["Total Costs", `$${c.toLocaleString()}`, "#E8DFD0"],
                      ["Net Profit", `$${p.toLocaleString()}`, p >= 0 ? "#4CAF7D" : "#E57373"],
                    ].map(([l, v, col]) => (
                      <div key={l}>
                        <div style={{ fontSize: "17px", fontWeight: "700", color: col }}>{v}</div>
                        <div style={{ fontSize: "10px", color: "#5A5248", marginTop: "2px" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            <GoldButton onClick={runAudit} style={{ width: "100%", padding: "15px" }}>
              Run My Business Audit →
            </GoldButton>
          </div>
        )}

        {screen === "savings" && (
          <div style={{ flex: 1, padding: "22px 18px", maxWidth: "560px", margin: "0 auto", width: "100%", boxSizing: "border-box", animation: "fadeIn 0.4s ease" }}>
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "8px" }}>💰 Cost Savings Calculator</div>
              <p style={{ fontSize: "14px", color: "#6A6058", margin: 0, lineHeight: "1.6" }}>Tell us about your biggest costs. We'll find specific ways to cut them without hurting your business.</p>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#5A5248", marginBottom: "7px" }}>Business Type</label>
              <select value={savingsData.bizType} onChange={(e) => setSavingsData({ ...savingsData, bizType: e.target.value })} style={{ width: "100%", background: "#191510", border: "1px solid #2A2520", borderRadius: "8px", padding: "11px 14px", color: "#E8DFD0", fontSize: "14px", fontFamily: "inherit" }}>
                <option value="restaurant">Restaurant / Food & Beverage</option>
                <option value="pawnshop">Pawnshop / Resale</option>
                <option value="mechanic">Auto Shop / Mechanic</option>
                <option value="retail">Retail Store</option>
                <option value="service">Service Business</option>
                <option value="other">Other Small Business</option>
              </select>
            </div>
            {[
              ["revenue", "Monthly Revenue", "e.g. 45000"],
              ["topCost1", "Your Biggest Monthly Cost ($)", "e.g. 12000 labor"],
              ["topCost2", "Second Biggest Cost ($)", "e.g. 8000 food cost"],
              ["topCost3", "Third Biggest Cost ($)", "e.g. 4500 rent"],
              ["employees", "Number of Employees", "e.g. 8"],
              ["rent", "Monthly Rent ($)", "e.g. 4500"],
            ].map(([key, label, ph]) => (
              <div key={key} style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#5A5248", marginBottom: "7px" }}>{label}</label>
                <div style={{ display: "flex", alignItems: "center", background: "#191510", border: "1px solid #2A2520", borderRadius: "8px", overflow: "hidden" }}>
                  <span style={{ padding: "11px 12px", color: "#5A5248", fontSize: "14px", borderRight: "1px solid #2A2520" }}>$</span>
                  <input className="audit-input" type="text" placeholder={ph} value={savingsData[key]} onChange={(e) => setSavingsData({ ...savingsData, [key]: e.target.value })} style={{ flex: 1, background: "transparent", border: "none", padding: "11px 12px", color: "#E8DFD0", fontSize: "14px", fontFamily: "inherit" }} />
                </div>
              </div>
            ))}
            <GoldButton onClick={runSavings} style={{ width: "100%", padding: "15px" }}>
              Find My Savings →
            </GoldButton>
          </div>
        )}

        {screen === "action" && (
          <div style={{ flex: 1, padding: "22px 18px", maxWidth: "560px", margin: "0 auto", width: "100%", boxSizing: "border-box", animation: "fadeIn 0.4s ease" }}>
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "8px" }}>📋 Build an Action Plan</div>
              <p style={{ fontSize: "14px", color: "#6A6058", margin: 0, lineHeight: "1.6" }}>Describe your goal or problem. Steady will build you a step-by-step plan with exact actions, timelines, and scripts.</p>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#5A5248", marginBottom: "10px" }}>What do you need a plan for?</label>
              <textarea value={actionTopic} onChange={(e) => setActionTopic(e.target.value)} placeholder={"e.g. I want to raise my prices without losing customers\n\ne.g. I need to hire my first employee\n\ne.g. I want to get more 5-star reviews"} rows={5} style={{ width: "100%", background: "#191510", border: "1px solid #2A2520", borderRadius: "10px", padding: "14px", color: "#E8DFD0", fontSize: "14px", fontFamily: "inherit", resize: "none", lineHeight: "1.6", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#5A5248", marginBottom: "4px" }}>Or pick a common situation:</div>
              {["Raise prices without losing customers", "Handle a problem employee", "Get more 5-star reviews", "Cut food costs by 10%", "Hire my first employee"].map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActionTopic(s)}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #252018", borderRadius: "8px", padding: "10px 14px", color: "#7A6E60", fontSize: "13px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "#C8A96E";
                    e.currentTarget.style.color = "#C8A96E";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "#252018";
                    e.currentTarget.style.color = "#7A6E60";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <GoldButton onClick={runActionPlan} style={{ width: "100%", padding: "15px" }}>
              Build My Action Plan →
            </GoldButton>
          </div>
        )}

        {screen === "auditResult" && <ResultScreen title="Monthly Business Audit" result={auditResult} loading={auditLoading} loadingText="Analyzing your numbers..." onBack={() => setScreen("audit")} onBackLabel="Run New Audit" onExport={() => exportPDF(auditResult, "Steady Business Audit")} />}
        {screen === "savingsResult" && <ResultScreen title="Cost Savings Report" result={savingsResult} loading={savingsLoading} loadingText="Finding your savings..." onBack={() => setScreen("savings")} onBackLabel="Recalculate" onExport={() => exportPDF(savingsResult, "Steady Cost Savings Report")} />}
        {screen === "actionResult" && <ResultScreen title="Your Action Plan" result={actionResult} loading={actionLoading} loadingText="Building your plan..." onBack={() => setScreen("action")} onBackLabel="New Plan" onExport={() => exportPDF(actionResult, "Steady Action Plan")} />}
      </div>

      {(screen === "home" || screen === "chat") && (
        <div style={{ padding: "12px 16px 14px", borderTop: "1px solid #1E1A15", background: "rgba(15,13,10,0.98)", flexShrink: 0 }}>
          <div style={{ maxWidth: "680px", margin: "0 auto", display: "flex", gap: "8px", alignItems: "flex-end", background: "#191510", border: "1px solid #2A2520", borderRadius: "14px", padding: "9px 9px 9px 16px" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder={!isPremium && questionsUsed >= FREE_LIMIT ? "Upgrade for unlimited questions..." : "What's going on with your business?"}
              disabled={!isPremium && questionsUsed >= FREE_LIMIT}
              rows={1}
              style={{ flex: 1, background: "transparent", border: "none", color: "#E8DFD0", fontSize: "15px", fontFamily: "inherit", resize: "none", lineHeight: "1.5", maxHeight: "130px", overflowY: "auto", padding: "4px 0" }}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || (!isPremium && questionsUsed >= FREE_LIMIT)}
              style={{ background: input.trim() && !loading && (isPremium || questionsUsed < FREE_LIMIT) ? "#C8A96E" : "#2A2520", border: "none", borderRadius: "10px", width: "36px", height: "36px", cursor: input.trim() && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke={input.trim() && !loading ? "#0F0D0A" : "#4A4540"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() && !loading ? "#0F0D0A" : "#4A4540"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div style={{ textAlign: "center", marginTop: "6px", fontSize: "10px", color: "#2A2520" }}>
            {isPremium ? "Premium · Unlimited · Steady gives business advice, not legal counsel" : `${remaining} free question${remaining !== 1 ? "s" : ""} left today · Steady gives business advice, not legal counsel`}
          </div>
        </div>
      )}
    </div>
  );
}

