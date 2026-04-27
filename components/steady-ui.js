"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSteady } from "./steady-provider";

export const STARTER_QUESTIONS = [
  "My employee keeps calling out last minute. What do I do?",
  "I got a bad review and I don't know how to respond.",
  "I think I'm undercharging but I'm scared to raise prices.",
  "I'm losing money but I don't know where it's going.",
  "I need to hire someone but I've never done it before.",
  "A customer is threatening to sue me. What's my first move?",
];

export const FREE_SYSTEM = `You are Steady — a straight-talking AI co-pilot for small business owners: restaurants, pawnshops, auto shops, and anyone running a real business.

Rules:
- Be direct. No fluff. No corporate speak.
- Write 3-4 solid paragraphs. Give real specifics, real examples, real language they can actually use. Enough to genuinely help — not so much they stop reading.
- Write like a trusted friend who has been in the trenches with them.
- Always end with "Next move:" followed by one specific action they can take today.
- Never say "consider" or "it depends" — give a real answer.`;

export const PREMIUM_SYSTEM = `You are Steady — a premium AI business advisor for small business owners: restaurants, pawnshops, auto shops, and anyone running a real business.

Rules:
- Be direct. No corporate speak. No filler.
- Write 4-6 paragraphs with real depth. Use numbered steps and breakdowns when it helps.
- Be specific — use dollar amounts, percentages, scripts they can say word for word.
- Write like a seasoned advisor who has run businesses and seen everything.
- Always end with "Next move:" followed by one specific action they can take today.
- Mention money implications whenever relevant — what they could save or earn.
- Never say "consider" or "it depends" — give a real answer.`;

export const AUDIT_SYSTEM = `You are Steady's Business Audit engine. Analyze the business data and give a thorough honest assessment.

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

Next move: [The one thing to do this week]`;

export const SAVINGS_SYSTEM = `You are Steady's Cost Savings Calculator. The user will give you their monthly business numbers.

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

Next move: [The single most impactful saving to tackle first]`;

export function GoldButton({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        background: props.disabled ? "#2A2520" : "linear-gradient(135deg,#C8A96E,#A07840)",
        border: "none",
        borderRadius: "10px",
        padding: "14px 24px",
        color: props.disabled ? "#5A5248" : "#0F0D0A",
        fontSize: "15px",
        fontWeight: "700",
        cursor: props.disabled ? "default" : "pointer",
        fontFamily: "inherit",
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

export function PageShell({ title, eyebrow, description, children, center = false }) {
  return (
    <div
      style={{
        maxWidth: "1120px",
        margin: "0 auto",
        padding: center ? "24px 20px" : "32px 20px 48px",
        minHeight: center ? "calc(100vh - 120px)" : undefined,
        display: center ? "flex" : undefined,
        flexDirection: center ? "column" : undefined,
        justifyContent: center ? "center" : undefined,
      }}
    >
      {eyebrow && <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "12px" }}>{eyebrow}</div>}
      {title && <h1 style={{ fontSize: "clamp(30px,5vw,52px)", lineHeight: "1.1", margin: "0 0 10px 0", fontWeight: "400", color: "#E8DFD0" }}>{title}</h1>}
      {description && <p style={{ fontSize: "15px", color: "#6A6058", lineHeight: "1.7", maxWidth: "700px", margin: "0 0 28px 0" }}>{description}</p>}
      {children}
    </div>
  );
}

export function AppChrome({ children }) {
  const pathname = usePathname();
  const { profile, isAuthenticated } = useSteady();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    ...(isAuthenticated ? [{ href: "/profile", label: "Profile" }] : [{ href: "/login", label: "Login" }, { href: "/register", label: "Register" }]),
    ...(profile.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div style={{ minHeight: "100vh", background: "#0F0D0A", color: "#E8DFD0", fontFamily: "'Georgia','Times New Roman',serif" }}>
      <style>{`
        body{margin:0;background:#0F0D0A}
        a{text-decoration:none}
        input,textarea,select{outline:none}

        .steady-desktop-nav{display:flex}
        .steady-mobile-menu-button{display:none}
        .steady-mobile-menu{display:none}

        @media (max-width: 768px){
          .steady-desktop-nav{display:none !important}
          .steady-mobile-menu-button{display:inline-flex !important}
          .steady-mobile-menu{display:block !important}
        }
      `}</style>
      <header style={{ borderBottom: "1px solid #1E1A15", background: "rgba(15,13,10,0.98)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#C8A96E,#8B6914)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0F0D0A", fontWeight: "700", fontSize: "22px" }}>S</div>
            <div>
              <div style={{ color: "#E8DFD0", fontSize: "22px", fontWeight: "600" }}>Steady</div>
              <div style={{ color: "#4A4540", fontSize: "11px", letterSpacing: "1.6px", textTransform: "uppercase" }}>Your Business Co-Pilot</div>
            </div>
          </Link>
          <nav className="steady-desktop-nav" style={{ alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    border: active ? "1px solid rgba(200,169,110,0.35)" : "1px solid #252018",
                    background: active ? "rgba(200,169,110,0.1)" : "rgba(255,255,255,0.02)",
                    color: active ? "#C8A96E" : "#D4C9B8",
                    borderRadius: "999px",
                    padding: "10px 14px",
                    fontSize: "14px",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
            {isAuthenticated && (
              <div style={{ border: "1px solid #252018", background: "rgba(255,255,255,0.02)", color: "#C8A96E", borderRadius: "999px", padding: "10px 14px", fontSize: "14px" }}>
                {profile.name || profile.email}
              </div>
            )}
          </nav>

          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="steady-mobile-menu-button"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "999px",
              border: "1px solid #252018",
              background: mobileMenuOpen ? "rgba(200,169,110,0.12)" : "rgba(255,255,255,0.02)",
              color: mobileMenuOpen ? "#C8A96E" : "#D4C9B8",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: "18px", lineHeight: 1 }}>
              {mobileMenuOpen ? "×" : "≡"}
            </span>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="steady-mobile-menu" style={{ borderTop: "1px solid #1E1A15", background: "rgba(15,13,10,0.98)" }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "12px 20px 16px" }}>
              <div style={{ display: "grid", gap: "10px" }}>
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        border: active ? "1px solid rgba(200,169,110,0.35)" : "1px solid #252018",
                        background: active ? "rgba(200,169,110,0.1)" : "rgba(255,255,255,0.02)",
                        color: active ? "#C8A96E" : "#D4C9B8",
                        borderRadius: "14px",
                        padding: "12px 14px",
                        fontSize: "15px",
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                {isAuthenticated && (
                  <div style={{ border: "1px solid #252018", background: "rgba(255,255,255,0.02)", color: "#C8A96E", borderRadius: "14px", padding: "12px 14px", fontSize: "14px" }}>
                    {profile.name || profile.email}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

export function formatMessage(text) {
  const lines = text.split("\n").filter((line) => line.trim());
  return lines.map((line, index) => {
    if (line.toLowerCase().startsWith("next move:")) {
      return <div key={index} style={{ marginTop: "16px", padding: "14px 16px", background: "rgba(200,169,110,0.08)", borderLeft: "3px solid #C8A96E", borderRadius: "0 8px 8px 0" }}><span style={{ display: "block", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "5px" }}>Next Move</span><span style={{ fontSize: "15px", color: "#E8DFD0", lineHeight: "1.5" }}>{line.replace(/next move:/i, "").trim()}</span></div>;
    }
    if (line.match(/^[A-Z][A-Z\s]+:/) && line.length < 60) {
      return <div key={index} style={{ marginTop: "18px", marginBottom: "6px", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#C8A96E", fontWeight: "700" }}>{line}</div>;
    }
    if (line.match(/^\d+\./)) {
      return <div key={index} style={{ display: "flex", gap: "10px", margin: "8px 0", paddingLeft: "4px" }}><span style={{ color: "#C8A96E", fontWeight: "700", minWidth: "20px" }}>{line.match(/^\d+/)[0]}.</span><span style={{ color: "#D4C9B8", lineHeight: "1.65", fontSize: "15px" }}>{line.replace(/^\d+\./, "").trim()}</span></div>;
    }
    return <p key={index} style={{ margin: "0 0 12px 0", lineHeight: "1.75", fontSize: "15px", color: "#D4C9B8" }}>{line.replace(/^-/, "").trim()}</p>;
  });
}
