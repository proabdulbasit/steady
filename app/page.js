"use client";

import { Suspense, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { STARTER_QUESTIONS } from "../components/steady-ui";
import { useSteady } from "../components/steady-provider";

export default function HomePage() {
  return (
    <>
      <Suspense fallback={null}><CheckoutSync /></Suspense>
      <Hero />
      <SocialStrip />
      <About />
      <Benefits />
      <HowItWorks />
      <UseCases />
      <Testimonials />
      <FinalCTA />
    </>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  const router = useRouter();
  const { remainingQuestions, isPremium } = useSteady();

  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div className="fade-up">
            <span className="chip" style={{ marginBottom: 22 }}>
              <span className="dot" /> Built for real business owners
            </span>
            <h1 className="h1 serif" style={{ margin: "0 0 18px" }}>
              Tell me your problem.<br />
              <span style={{ color: "var(--gold)" }}>I&apos;ll tell you what to do.</span>
            </h1>
            <p className="lede" style={{ maxWidth: 540, marginBottom: 28 }}>
              No fluff. No corporate speak. Steady is a straight-talking AI co-pilot for restaurants,
              auto shops, pawnshops, and anyone running a real business — with a clear next move every time.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
              <button onClick={() => router.push("/chat")} className="btn btn-primary">
                Ask Steady — it&apos;s free →
              </button>
              <button onClick={() => router.push("/pricing")} className="btn btn-ghost">
                See pricing
              </button>
            </div>

            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              {remainingQuestions === null
                ? "Unlimited questions active on your plan"
                : isPremium
                  ? `${remainingQuestions} questions remaining today`
                  : `${remainingQuestions} free questions remaining today · No credit card`}
            </div>

            {/* Composer */}
            <div style={{ marginTop: 32 }}>
              <div className="steady-composer">
                <button type="button" aria-label="Add" className="icon-btn" style={{ width: 36, height: 36, border: "none", background: "transparent" }}>+</button>
                <button onClick={() => router.push("/chat")} className="composer-input">
                  What&apos;s going on with your business?
                </button>
                <button onClick={() => router.push("/chat")} className="composer-send" aria-label="Open chat">↑</button>
              </div>
            </div>
          </div>

          <div className="fade-up delay-2">
            <div className="hero-image-wrap">
              <Image
                src="/hero-desk.jpg"
                alt="A small business owner's notebook, coffee cup and brass keys on a worn wooden table in soft window light."
                width={1536}
                height={1280}
                priority
              />
              <div className="hero-badge-card">
                <div className="hero-badge-num">2 min</div>
                <div>
                  <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>From problem to next move</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Average answer time</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Social strip ---------------- */

function SocialStrip() {
  const items = ["Restaurants", "Auto shops", "Pawnshops", "Salons", "Retail", "Trades"];
  return (
    <section style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--bg-soft)", padding: "22px 0" }}>
      <div className="container" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-3)", fontWeight: 600 }}>
          Trusted by owners across
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          {items.map((i) => (
            <div key={i} className="serif" style={{ fontSize: 18, color: "var(--ink-2)" }}>{i}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- About ---------------- */

function About() {
  return (
    <section className="section">
      <div className="container">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 56, alignItems: "start" }} className="about-grid">
          <div>
            <div className="eyebrow">What is Steady</div>
            <h2 className="h2 serif" style={{ margin: "10px 0 0" }}>
              An AI advisor that actually understands your business.
            </h2>
          </div>
          <div>
            <p className="lede" style={{ margin: 0 }}>
              Steady is built for the people who never get an honest answer from a generic AI.
              Tell it your industry, drop in your numbers, describe your problem in plain English —
              and you&apos;ll get a direct response with real specifics, scripts you can use today,
              and one clear <em style={{ color: "var(--gold)", fontStyle: "normal", fontWeight: 600 }}>next move</em>.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginTop: 28 }} className="stat-grid">
              <Stat number="3 sec" label="To start typing" />
              <Stat number="0%" label="Corporate fluff" />
              <Stat number="1" label="Clear next move, every answer" />
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 900px){ .about-grid{grid-template-columns:1fr !important;gap:24px !important} .stat-grid{grid-template-columns:1fr !important} }`}</style>
    </section>
  );
}

function Stat({ number, label }) {
  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div className="serif" style={{ fontSize: 32, color: "var(--ink)", lineHeight: 1 }}>{number}</div>
      <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6 }}>{label}</div>
    </div>
  );
}

/* ---------------- Benefits ---------------- */

function Benefits() {
  const items = [
    { icon: "✦", title: "Direct answers, no fluff", body: "Skip the disclaimers. Get the real recommendation, plus the exact words to use with staff, customers, or vendors." },
    { icon: "◆", title: "Built for your industry", body: "Steady knows the difference between a 22% food cost and a 41% gross margin. Pick your industry once and it adjusts." },
    { icon: "✚", title: "Always ends with a next move", body: "Every answer ends with one specific action you can take today — not a checklist of ten things to consider." },
    { icon: "❍", title: "Tools that calculate, not just talk", body: "Pro and Business plans unlock the Audit, Cost Savings calculator, and Action Plan builder." },
    { icon: "✕", title: "Private and account-locked", body: "Your subscription, usage and history are tied to your account. Nothing leaks across browsers." },
    { icon: "✱", title: "Works on every device", body: "Responsive across phone, tablet and desktop. Light and dark theme — switch any time." },
  ];

  return (
    <section className="section" style={{ background: "var(--bg-soft)" }}>
      <div className="container">
        <SectionHead eyebrow="Why Steady" title="Built to be useful in two minutes." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="benefit-grid">
          {items.map((b) => (
            <div key={b.title} className="card card-hover">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--gold-soft)", color: "var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{b.icon}</div>
              <div className="serif" style={{ fontSize: 19, color: "var(--ink)", marginBottom: 8, fontWeight: 500 }}>{b.title}</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.65 }}>{b.body}</p>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 900px){.benefit-grid{grid-template-columns:1fr !important}}`}</style>
    </section>
  );
}

/* ---------------- How it works ---------------- */

function HowItWorks() {
  const steps = [
    { n: "01", title: "Tell Steady your problem", body: "Type it like you'd say it out loud. No formatting, no jargon required." },
    { n: "02", title: "It asks if it needs more", body: "If a number or detail is missing, Steady asks — instead of guessing." },
    { n: "03", title: "Get a direct answer", body: "Real recommendations, the exact language to use, and benchmarks for your industry." },
    { n: "04", title: "Take the next move", body: "Every answer ends with one specific action to take today. Then come back tomorrow." },
  ];
  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="How it works" title="From problem to plan in four steps." />
        <div className="steps">
          {steps.map((s) => (
            <div key={s.n} className="card">
              <div className="step-num">{s.n}</div>
              <div className="serif" style={{ fontSize: 19, color: "var(--ink)", fontWeight: 500, marginBottom: 6 }}>{s.title}</div>
              <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.65 }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 36, display: "flex", justifyContent: "center" }}>
          <Link href="/chat" className="btn btn-dark">Try it free →</Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Use cases ---------------- */

function UseCases() {
  const cases = [
    { tag: "Restaurant", title: "A bad review just hit Yelp.", problem: "“A customer slammed us for slow service. I don't know how to respond without sounding defensive.”", answer: "Reply within 24 hours, acknowledge specifics, offer a private follow-up. Scripted line ready in 30 seconds." },
    { tag: "Auto shop", title: "A regular wants a $200 discount.", problem: "“He says my competitor is cheaper. If I say no, I lose him. If I say yes, I lose margin.”", answer: "Hold price, swap to a value-add (free inspection + loyalty credit) that costs you $40 and keeps him for two years." },
    { tag: "Pawnshop", title: "I think I'm undercharging.", problem: "“My fees feel low but I'm scared raising them costs me walk-ins.”", answer: "Raise on the items where you have a moat (jewelry, electronics) by 8–12%. Hold the loss leaders. Net: +$1,400/mo." },
  ];

  return (
    <section className="section" style={{ background: "var(--bg-soft)" }}>
      <div className="container">
        <SectionHead eyebrow="Real problems, real answers" title="What Steady actually does." subtitle="Three of the kinds of problems owners bring in every day." />

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 36, alignItems: "center", marginBottom: 36 }} className="usecase-hero-grid">
          <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--line)", boxShadow: "var(--shadow-md)" }}>
            <Image
              src="/use-cases.jpg"
              alt="Three vignettes: a chef writing a menu, a clean tool bench, and a brass scale on a pawnshop counter."
              width={1536}
              height={1024}
              loading="lazy"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
          <div>
            <h3 className="h3 serif" style={{ margin: "0 0 12px" }}>The advisor your business needed five years ago.</h3>
            <p style={{ color: "var(--ink-3)", margin: 0, fontSize: 15, lineHeight: 1.7 }}>
              Steady doesn&apos;t hand you a generic playbook. It looks at the situation you&apos;re in, the industry you run,
              and the constraints you actually have — and tells you what to do next.
            </p>
          </div>
        </div>

        <div className="use-grid">
          {cases.map((c) => (
            <div key={c.title} className="card card-hover">
              <div className="chip" style={{ marginBottom: 14 }}>{c.tag}</div>
              <div className="serif" style={{ fontSize: 20, color: "var(--ink)", fontWeight: 500, marginBottom: 10 }}>{c.title}</div>
              <p style={{ margin: "0 0 14px", color: "var(--ink-3)", fontSize: 14, lineHeight: 1.65, fontStyle: "italic" }}>{c.problem}</p>
              <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 14, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65 }}>
                <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Steady says</span>
                {c.answer}
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 900px){.usecase-hero-grid{grid-template-columns:1fr !important; gap:20px !important}}`}</style>
    </section>
  );
}

/* ---------------- Testimonials ---------------- */

function Testimonials() {
  const items = [
    { q: "I asked it the question I'd been avoiding for three months. It gave me a number, a script, and a deadline. I did it that week.", name: "Marisol P.", role: "Owner, Tres Hermanas Cocina" },
    { q: "Finally, an AI that doesn't say \"consider consulting a professional\" five times. Steady just tells me what to do.", name: "Kenji A.", role: "Owner, North Loop Auto" },
    { q: "I run a pawnshop. Steady understood the business in 30 seconds — I didn't have to explain inventory turn or hold periods.", name: "Devon R.", role: "Owner, Beacon Loans" },
  ];
  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="From owners using Steady" title="Plain talk from real businesses." subtitle="Sample quotes from beta users — names changed at their request." />
        <div className="use-grid">
          {items.map((t) => (
            <div key={t.name} className="tcard">
              <div style={{ color: "var(--gold)", fontFamily: "Fraunces, serif", fontSize: 40, lineHeight: 0.6, marginBottom: 8 }}>“</div>
              <p className="tquote">{t.q}</p>
              <div className="tname"><strong>{t.name}</strong> — {t.role}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */

function FinalCTA() {
  return (
    <section className="section">
      <div className="container">
        <div className="cta-band">
          <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, alignItems: "center" }} className="cta-grid">
            <div>
              <div className="eyebrow" style={{ color: "var(--gold-2)" }}>Stop guessing</div>
              <h2 className="h2 serif" style={{ color: "#F1E7D7", margin: "10px 0 12px" }}>
                The next move is one question away.
              </h2>
              <p style={{ color: "rgba(241,231,215,0.75)", margin: 0, fontSize: 16, lineHeight: 1.6, maxWidth: 520 }}>
                Try Steady free — three real questions per day, no credit card, no setup. Upgrade only if it earns its keep.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Link href="/chat" className="btn btn-primary">Ask Steady →</Link>
              <Link href="/pricing" className="btn" style={{ background: "transparent", color: "#F1E7D7", borderColor: "rgba(241,231,215,0.25)" }}>See pricing</Link>
            </div>
          </div>
        </div>

        {/* Starter prompts */}
        <div style={{ marginTop: 56 }}>
          <div className="eyebrow" style={{ marginBottom: 18, textAlign: "center" }}>Or start with a question owners actually ask</div>
          <div className="home-starters" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {STARTER_QUESTIONS.map((q) => (
              <Link key={q} href={`/chat?prompt=${encodeURIComponent(q)}`} className="starter">{q}</Link>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px){
          .cta-grid{grid-template-columns:1fr !important}
          .cta-grid > div:last-child{justify-content:flex-start !important}
          .home-starters{grid-template-columns:1fr !important}
        }
        @media (min-width: 901px) and (max-width: 1100px){
          .home-starters{grid-template-columns:1fr 1fr !important}
        }
      `}</style>
    </section>
  );
}

/* ---------------- Helpers ---------------- */

function SectionHead({ eyebrow, title, subtitle }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 44px" }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>{eyebrow}</div>
      <h2 className="h2 serif" style={{ margin: 0 }}>{title}</h2>
      {subtitle && <p className="lede" style={{ marginTop: 14 }}>{subtitle}</p>}
    </div>
  );
}

function CheckoutSync() {
  const searchParams = useSearchParams();
  const { isAuthenticated, syncCheckout, refreshProfile } = useSteady();

  useEffect(() => {
    const checkout = searchParams?.get("checkout");
    const checkoutSessionId = searchParams?.get("session_id");
    if (checkout !== "success" || !checkoutSessionId || !isAuthenticated) return;
    syncCheckout(checkoutSessionId).catch(() => null).finally(() => refreshProfile());
  }, [isAuthenticated, refreshProfile, searchParams, syncCheckout]);

  return null;
}
