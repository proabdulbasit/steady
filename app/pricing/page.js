"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoldButton, PageShell } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";
import { PLAN_IDS } from "../../lib/plans";

const plans = [
  {
    id: PLAN_IDS.FREE,
    name: "Free",
    price: "$0",
    period: "forever",
    subtitle: "For trying Steady out.",
    features: ["3 questions per day", "Core business advice", "Light & dark theme", "No credit card"],
    cta: "Choose Free",
  },
  {
    id: PLAN_IDS.PRO,
    name: "Pro",
    price: "$20",
    period: "/ month",
    subtitle: "For owners using it weekly.",
    featured: true,
    features: [
      "200 questions per month",
      "Business Audit",
      "Cost Savings Calculator",
      "Action Plan Builder",
      "Priority response speed",
    ],
    cta: "Choose Pro",
  },
  {
    id: PLAN_IDS.BUSINESS,
    name: "Business",
    price: "$69",
    period: "/ month",
    subtitle: "Everything in Pro plus integrations.",
    features: [
      "Unlimited questions",
      "All Pro tools",
      "Legal Document Translator",
      "PDF export",
      "Data integrations (coming soon)",
    ],
    cta: "Choose Business",
  },
];

const faqs = [
  { q: "Can I cancel any time?", a: "Yes. Cancel from your Profile page in two clicks. You keep access until the end of the billing period." },
  { q: "What happens when I hit my daily limit?", a: "On Free, you'll see a soft prompt to upgrade. Pro gets 200 questions/month. Business is unlimited." },
  { q: "Is my chat history private?", a: "Yes. Conversations are tied to your account, not shared, and deletable from your Profile." },
  { q: "Do you replace my accountant or lawyer?", a: "No. Steady gives business advice, not legal or tax counsel. Use it to make better decisions, not to replace professional sign-off." },
];

export default function PricingPage() {
  const router = useRouter();
  const { profile, choosePlan, updatePlan, billingError, billingLoading, isAuthenticated } = useSteady();
  const [confirmPlanId, setConfirmPlanId] = useState("");

  const confirmPlan = useMemo(() => plans.find((p) => p.id === confirmPlanId) || null, [confirmPlanId]);
  const currentPlan = useMemo(() => plans.find((p) => p.id === profile.planId) || null, [profile.planId]);
  const showConfirm = Boolean(confirmPlan && currentPlan && profile.planId !== PLAN_IDS.FREE && confirmPlanId !== profile.planId);

  return (
    <main>
      {/* Hero */}
      <section className="container" style={{ padding: "80px 24px 32px", textAlign: "center" }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Pricing</div>
        <h1 className="h1 serif" style={{ margin: "0 0 14px", fontSize: "clamp(36px, 5vw, 60px)" }}>
          Pick the plan that <span style={{ color: "var(--gold)" }}>earns its keep</span>.
        </h1>
        <p className="lede" style={{ maxWidth: 620, margin: "0 auto" }}>
          Start free. Upgrade only when Steady has already saved you more than it costs.
        </p>
      </section>

      {/* Pricing cards */}
      <section className="container" style={{ padding: "32px 24px 24px" }}>
        <div className="price-grid">
          {plans.map((plan) => {
            const isCurrent = profile.planId === plan.id;
            const canUpdatePaidPlan = profile.planId !== PLAN_IDS.FREE && plan.id !== PLAN_IDS.FREE && !isCurrent;
            const canPickFree = plan.id === PLAN_IDS.FREE && isAuthenticated && profile?.planSelected === false;

            return (
              <div key={plan.id} className={`card price-card ${plan.featured ? "featured" : ""} ${isCurrent ? "" : ""}`} style={isCurrent ? { borderColor: "var(--gold-ring)" } : undefined}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div className="serif" style={{ fontSize: 24, color: "var(--ink)", fontWeight: 500 }}>{plan.name}</div>
                  {isCurrent && <span className="chip">Current</span>}
                </div>
                <p style={{ margin: "6px 0 18px", color: "var(--ink-3)", fontSize: 14 }}>{plan.subtitle}</p>

                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 18 }}>
                  <span className="price-amount">{plan.price}</span>
                  <span className="price-period">{plan.period}</span>
                </div>

                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: 22, flex: 1 }}>
                  {plan.features.map((f) => (
                    <div key={f} className="feat-row">
                      <span className="feat-check">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {plan.id === PLAN_IDS.FREE ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!isAuthenticated) { router.push("/register"); return; }
                      if (!canPickFree) return;
                      await updatePlan(PLAN_IDS.FREE);
                      router.push("/chat");
                    }}
                    disabled={billingLoading || (isAuthenticated && !canPickFree && !isCurrent)}
                    className="btn btn-ghost"
                    style={{ width: "100%" }}
                  >
                    {isCurrent ? "Current plan" : canPickFree ? "Choose Free" : isAuthenticated ? "Included" : "Get started free"}
                  </button>
                ) : (
                  <GoldButton
                    onClick={async () => {
                      if (!isAuthenticated) { router.push("/register"); return; }
                      if (canUpdatePaidPlan) { setConfirmPlanId(plan.id); return; }
                      await choosePlan(plan.id);
                    }}
                    disabled={billingLoading}
                    style={{ width: "100%" }}
                  >
                    {isCurrent ? "Manage subscription" : canUpdatePaidPlan ? `Switch to ${plan.name}` : plan.cta}
                  </GoldButton>
                )}
              </div>
            );
          })}
        </div>

        {billingError && (
          <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)", borderRadius: 12, padding: "12px 14px", marginTop: 18 }}>
            {billingError}
          </div>
        )}
      </section>

      {/* Comparison strip */}
      <section className="container" style={{ padding: "48px 24px" }}>
        <div className="card" style={{ background: "var(--bg-soft)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }} className="compare-grid">
            <Compare title="Direct answers" body="On every plan. No fluff, no hedge words, no disclaimers." />
            <Compare title="Industry awareness" body="Steady adjusts to restaurants, auto, pawn, retail, trades and more." />
            <Compare title="Always a next move" body="Every answer ends with one specific action to take today." />
          </div>
          <style>{`@media (max-width: 760px){.compare-grid{grid-template-columns:1fr !important}}`}</style>
        </div>
      </section>

      {/* FAQ */}
      <section className="container" style={{ padding: "32px 24px 96px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>FAQ</div>
          <h2 className="h2 serif" style={{ margin: 0 }}>Quick answers.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="faq-grid">
          {faqs.map((f) => (
            <div key={f.q} className="card">
              <div className="serif" style={{ fontSize: 18, color: "var(--ink)", fontWeight: 500, marginBottom: 8 }}>{f.q}</div>
              <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.7 }}>{f.a}</p>
            </div>
          ))}
        </div>
        <style>{`@media (max-width: 760px){.faq-grid{grid-template-columns:1fr !important}}`}</style>

        <div style={{ textAlign: "center", marginTop: 40, color: "var(--ink-3)", fontSize: 14 }}>
          Still deciding? <Link href="/chat" style={{ color: "var(--gold)", fontWeight: 600 }}>Try Steady free →</Link>
        </div>
      </section>

      {/* Confirm modal — preserved logic */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm plan change"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmPlanId(""); }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,8,6,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60, backdropFilter: "blur(4px)" }}
        >
          <div className="card" style={{ width: "min(520px, 100%)", boxShadow: "var(--shadow-lg)" }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Confirm change</div>
            <div className="h3 serif" style={{ marginBottom: 10 }}>Switch from {currentPlan?.name} to {confirmPlan?.name}?</div>
            <p style={{ color: "var(--ink-3)", marginTop: 0, marginBottom: 18, fontSize: 14, lineHeight: 1.6 }}>
              Stripe will prorate the difference automatically based on time left in your billing cycle.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setConfirmPlanId("")} disabled={billingLoading} className="btn btn-ghost btn-sm">Cancel</button>
              <GoldButton
                onClick={async () => { const nextId = confirmPlanId; setConfirmPlanId(""); await updatePlan(nextId); }}
                disabled={billingLoading}
                className="btn-sm"
              >
                {billingLoading ? "Updating..." : "Confirm change"}
              </GoldButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Compare({ title, body }) {
  return (
    <div>
      <div className="serif" style={{ fontSize: 18, color: "var(--ink)", fontWeight: 500, marginBottom: 6 }}>{title}</div>
      <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.65 }}>{body}</p>
    </div>
  );
}

// PageShell intentionally unused here in favor of bespoke layout.
void PageShell;
