"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSteady } from "./steady-provider";
import { useTheme } from "./theme-provider";
import { OutcomeCheckupBanner } from "./outcome-checkup-banner";
import { DailyPulseBanner } from "./daily-pulse-banner";

/* =========================================================
   Public constants — kept for backward compatibility
   ========================================================= */

export const STARTER_QUESTIONS = [
  "My employee keeps calling out last minute. What do I do?",
  "I got a bad review and I don't know how to respond.",
  "I think I'm undercharging but I'm scared to raise prices.",
  "I'm losing money but I don't know where it's going.",
  "I need to hire someone but I've never done it before.",
  "A customer is threatening to sue me. What's my first move?",
];

const CORE_STEADY_SYSTEM = `You are Steady — a straight-talking AI co-pilot for small business owners: restaurants, pawnshops, auto shops, and anyone running a real business.

Rules:
- Be direct. No fluff. No corporate speak.
- Give real specifics and language they can actually use.
- Always end with "Next move:" followed by one specific action they can take today.
- Never say "consider" or "it depends" — give a real answer.`;

export const FREE_TIER_ADDITION = `Keep responses to 2 short paragraphs maximum. Give the direct answer and one Next Move only. No benchmarks, no checklists, no risk flags.`;
export const PRO_TIER_ADDITION = `Give thorough answers with real specifics, benchmarks, and a clear Next Move. 3-4 paragraphs.`;
export const BUSINESS_TIER_ADDITION = `Give full detailed responses including confidence score, industry benchmarks, before/after expectations, risk flags, implementation checklist, and Next Move.`;

export const FREE_SYSTEM = `${CORE_STEADY_SYSTEM}\n\n${FREE_TIER_ADDITION}`;
export const PREMIUM_SYSTEM = `${CORE_STEADY_SYSTEM}\n\n${PRO_TIER_ADDITION}`;
export const BUSINESS_SYSTEM = `${CORE_STEADY_SYSTEM}\n\n${BUSINESS_TIER_ADDITION}`;

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

/* =========================================================
   Buttons & primitives
   ========================================================= */

export function GoldButton({ children, className = "", ...props }) {
  return (
    <button {...props} className={`btn btn-primary ${className}`.trim()}>
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "", ...props }) {
  return (
    <button {...props} className={`btn btn-ghost ${className}`.trim()}>
      {children}
    </button>
  );
}

export function Eyebrow({ children }) {
  return <div className="eyebrow" style={{ marginBottom: 14 }}>{children}</div>;
}

/* =========================================================
   Page shell — kept compatible with existing pages
   ========================================================= */

export function PageShell({ title, eyebrow, description, children, center = false }) {
  return (
    <main className="container" style={{
      padding: center ? "48px 24px" : "56px 24px 96px",
      minHeight: center ? "calc(100vh - 180px)" : undefined,
      display: center ? "flex" : undefined,
      flexDirection: center ? "column" : undefined,
      justifyContent: center ? "center" : undefined,
    }}>
      {eyebrow && <div className="eyebrow" style={{ marginBottom: 14 }}>{eyebrow}</div>}
      {title && <h1 className="h2 serif" style={{ margin: "0 0 14px" }}>{title}</h1>}
      {description && <p className="lede" style={{ maxWidth: 720, margin: "0 0 32px" }}>{description}</p>}
      {children}
    </main>
  );
}

/* =========================================================
   Theme toggle
   ========================================================= */

function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      className="icon-btn"
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
        {mounted ? (isDark ? "☀" : "☾") : "·"}
      </span>
    </button>
  );
}

/* =========================================================
   App chrome — header, footer, mobile menu
   ========================================================= */

export function AppChrome({ children }) {
  const pathname = usePathname();
  const { profile, isAuthenticated } = useSteady();
  const [open, setOpen] = useState(false);
  const isChat = pathname?.startsWith("/chat");
  const hideFooter = isChat;

  useEffect(() => {
    // On /chat we want a true app layout: sidebar + thread scroll independently, not the page.
    if (!pathname?.startsWith("/chat")) {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.documentElement.style.removeProperty("--app-header-h");
      return;
    }

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    // Measure sticky top chrome (nav + pulse + outcome banners), not just .app-header.
    const chrome = document.querySelector(".app-top-chrome");
    if (!(chrome instanceof HTMLElement)) return undefined;

    const syncHeight = () => {
      document.documentElement.style.setProperty("--app-header-h", `${chrome.offsetHeight}px`);
    };
    syncHeight();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncHeight) : null;
    ro?.observe(chrome);
    window.addEventListener("resize", syncHeight);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", syncHeight);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [pathname]);

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    ...(isAuthenticated
      ? [{ href: "/tools/document-upload", label: "Upload" }, { href: "/profile", label: "Profile" }]
      : [{ href: "/login", label: "Login" }, { href: "/register", label: "Register" }]),
    ...(profile?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="app-top-chrome">
      <header className="app-header">
        <div className="container" style={{ padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="brand-mark">S</div>
            <div>
              <div className="serif" style={{ fontSize: 22, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em" }}>Steady</div>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-3)" }}>Your business co-pilot</div>
            </div>
          </Link>

          <nav className="desktop-only" style={{ alignItems: "center", gap: 4 }}>
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`}>
                  {item.label}
                </Link>
              );
            })}
            <div style={{ width: 1, height: 22, background: "var(--line)", margin: "0 8px" }} />
            <ThemeToggle />
            {!isAuthenticated && (
              <Link href="/register" className="btn btn-primary btn-sm" style={{ marginLeft: 6 }}>
                Get started
              </Link>
            )}
            {isAuthenticated && (
              <Link href="/chat" className="btn btn-primary btn-sm" style={{ marginLeft: 6 }}>
                Open chat
              </Link>
            )}
          </nav>

          <div className="mobile-only" style={{ alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen(v => !v)}
              className="icon-btn"
            >
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{open ? "×" : "≡"}</span>
            </button>
          </div>
        </div>

        {open && (
          <div className="mobile-only" style={{ borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
            <div className="container" style={{ padding: "14px 24px", display: "grid", gap: 8 }}>
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`} style={{ padding: "12px 14px", borderRadius: 12 }}>
                    {item.label}
                  </Link>
                );
              })}
              {!isAuthenticated && (
                <Link href="/register" className="btn btn-primary" style={{ marginTop: 6 }}>Get started</Link>
              )}
              {isAuthenticated && (
                <Link href="/chat" className="btn btn-primary" style={{ marginTop: 6 }}>Open chat</Link>
              )}
            </div>
          </div>
        )}
      </header>

      <DailyPulseBanner />
      <OutcomeCheckupBanner />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: isChat ? "hidden" : "visible" }}>
        {children}
      </div>

      {!hideFooter && (
        <footer className="app-footer">
          <div className="container footer-grid" style={{ display: "grid", gap: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div className="brand-mark" style={{ width: 36, height: 36, fontSize: 18 }}>S</div>
                <div className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>Steady</div>
              </div>
              <p style={{ fontSize: 14, color: "var(--ink-3)", maxWidth: 360, margin: 0 }}>
                Direct, plain-spoken answers for the people running real businesses. Built to be useful in two minutes.
              </p>
            </div>
            <FooterCol title="Product" links={[["/", "Home"], ["/pricing", "Pricing"], ["/chat", "Chat"], ["/tools/document-upload", "CSV, PDF & Photo Upload"]]} />
            <FooterCol title="Account" links={[["/login", "Sign in"], ["/register", "Register"], ["/profile", "Profile"]]} />
            <FooterCol title="Legal" links={[["/privacy", "Privacy"], ["/terms", "Terms"]]} />
          </div>
          <div className="container" style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, fontSize: 12, color: "var(--ink-3)" }}>
            <div>© {new Date().getFullYear()} Steady. Business advice, not legal counsel.</div>
            <div>Made for restaurants, auto shops, pawnshops & every other real business.</div>
          </div>
        </footer>
      )}
    </div>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 12, fontWeight: 600 }}>{title}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {links.map(([href, label]) => (
          <Link key={href} href={href} style={{ fontSize: 14, color: "var(--ink-2)" }}>{label}</Link>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   Markdown-ish formatter (kept compatible)
   ========================================================= */

/** Render inline **bold** (and nested plain text) without showing asterisks. */
export function formatInline(text) {
  const raw = String(text ?? "");
  const parts = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = re.exec(raw)) !== null) {
    if (match.index > last) {
      parts.push(raw.slice(last, match.index));
    }
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

export function formatMessage(text) {
  const lines = text.split("\n").filter((line) => line.trim());
  return lines.map((line, index) => {
    if (line.toLowerCase().startsWith("next move:")) {
      return (
        <div key={index} style={{ marginTop: 18, padding: "16px 18px", background: "var(--gold-soft)", borderLeft: "3px solid var(--gold)", borderRadius: "0 12px 12px 0" }}>
          <span style={{ display: "block", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700, marginBottom: 6 }}>Next move</span>
          <span style={{ fontSize: 16, color: "var(--ink)", lineHeight: 1.55 }}>{formatInline(line.replace(/next move:/i, "").trim())}</span>
        </div>
      );
    }
    if (line.match(/^[A-Z][A-Z\s]+:/) && line.length < 60) {
      return <div key={index} style={{ marginTop: 20, marginBottom: 6, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700 }}>{formatInline(line)}</div>;
    }
    if (line.match(/^\d+\./)) {
      return (
        <div key={index} style={{ display: "flex", gap: 10, margin: "8px 0", paddingLeft: 4 }}>
          <span style={{ color: "var(--gold)", fontWeight: 700, minWidth: 22 }}>{line.match(/^\d+/)[0]}.</span>
          <span style={{ color: "var(--ink-2)", lineHeight: 1.65, fontSize: 15 }}>{formatInline(line.replace(/^\d+\./, "").trim())}</span>
        </div>
      );
    }
    return <p key={index} style={{ margin: "0 0 12px 0", lineHeight: 1.75, fontSize: 15, color: "var(--ink-2)" }}>{formatInline(line.replace(/^-/, "").trim())}</p>;
  });
}
