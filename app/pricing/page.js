"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GoldButton, PageShell } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";
import { PLAN_IDS } from "../../lib/plans";

const plans = [
  { id: PLAN_IDS.FREE, name: "Free", price: "Free", subtitle: "For trying Steady out", features: ["3 questions per day", "Core business advice", "Guest access supported"] },
  { id: PLAN_IDS.PRO, name: "Pro", price: "$20/mo", subtitle: "200 questions/month and premium tools", features: ["200 questions per month", "Business Audit", "Cost Savings Calculator", "Action Plan Builder"] },
  { id: PLAN_IDS.BUSINESS, name: "Business", price: "$69/mo", subtitle: "Everything in Pro plus integrations", features: ["Unlimited questions", "Business Audit", "Cost Savings Calculator", "Action Plan Builder", "Legal Document Translator", "PDF Export", "Data integrations coming soon"] },
];

export default function PricingPage() {
  const router = useRouter();
  const { profile, choosePlan, updatePlan, billingError, billingLoading, isAuthenticated } = useSteady();
  const [confirmPlanId, setConfirmPlanId] = useState("");

  const confirmPlan = useMemo(() => plans.find((p) => p.id === confirmPlanId) || null, [confirmPlanId]);
  const currentPlan = useMemo(() => plans.find((p) => p.id === profile.planId) || null, [profile.planId]);
  const showConfirm = Boolean(confirmPlan && currentPlan && profile.planId !== PLAN_IDS.FREE && confirmPlanId !== profile.planId);

  return (
    <PageShell center eyebrow="Pricing" title="Choose the right Steady plan" description="Each plan now lives on its own account-based billing flow, so upgrades attach cleanly to the signed-in user profile.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "16px" }}>
        {plans.map((plan) => {
          const isCurrent = profile.planId === plan.id;
          const canUpdatePaidPlan = profile.planId !== PLAN_IDS.FREE && plan.id !== PLAN_IDS.FREE && !isCurrent;
          const canPickFree = plan.id === PLAN_IDS.FREE && isAuthenticated && profile?.planSelected === false;
          return (
            <div key={plan.id} style={{ background: isCurrent ? "rgba(200,169,110,0.08)" : "#15120E", border: isCurrent ? "1px solid rgba(200,169,110,0.35)" : "1px solid #252018", borderRadius: "18px", padding: "22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontSize: "24px", color: "#E8DFD0" }}>{plan.name}</div>
                  <div style={{ fontSize: "13px", color: "#6A6058" }}>{plan.subtitle}</div>
                </div>
                <div style={{ fontSize: "28px", color: "#C8A96E", fontWeight: "700" }}>{plan.price}</div>
              </div>
              <div style={{ display: "grid", gap: "8px", margin: "18px 0" }}>
                {plan.features.map((feature) => (
                  <div key={feature} style={{ fontSize: "14px", color: "#D4C9B8" }}>• {feature}</div>
                ))}
              </div>
              {plan.id === PLAN_IDS.FREE ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!isAuthenticated) {
                      router.push("/login");
                      return;
                    }
                    if (!canPickFree) return;
                    await updatePlan(PLAN_IDS.FREE);
                    router.push("/chat");
                  }}
                  disabled={billingLoading || !canPickFree}
                  style={{
                    width: "100%",
                    background: "#191510",
                    border: "1px solid #2A2520",
                    borderRadius: "10px",
                    padding: "14px",
                    color: canPickFree ? "#C8A96E" : isCurrent ? "#C8A96E" : "#5A5248",
                    fontFamily: "inherit",
                    cursor: canPickFree ? "pointer" : "default",
                  }}
                >
                  {isCurrent ? "Current Plan" : canPickFree ? "Choose Free" : "Included"}
                </button>
              ) : (
                <GoldButton
                  onClick={async () => {
                    if (!isAuthenticated) {
                      router.push("/login");
                      return;
                    }
                    if (canUpdatePaidPlan) {
                      setConfirmPlanId(plan.id);
                      return;
                    }
                    await choosePlan(plan.id);
                  }}
                  disabled={billingLoading}
                  style={{ width: "100%" }}
                >
                  {isCurrent ? "Manage Subscription" : canUpdatePaidPlan ? `Update to ${plan.name}` : `Choose ${plan.name}`}
                </GoldButton>
              )}
            </div>
          );
        })}
      </div>
      {billingError && <div style={{ background: "rgba(229,115,115,0.08)", border: "1px solid rgba(229,115,115,0.25)", color: "#F1B1B1", borderRadius: "12px", padding: "12px 14px", marginTop: "16px" }}>{billingError}</div>}

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm plan change"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmPlanId("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,13,10,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 60,
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              background: "#15120E",
              border: "1px solid rgba(200,169,110,0.28)",
              borderRadius: "18px",
              padding: "22px",
              boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "10px" }}>Confirm change</div>
            <div style={{ fontSize: "26px", color: "#E8DFD0", lineHeight: "1.12", marginBottom: "10px" }}>
              Switch from {currentPlan?.name} to {confirmPlan?.name}?
            </div>
            <div style={{ color: "#6A6058", fontSize: "14px", lineHeight: "1.6", marginBottom: "16px" }}>
              Stripe will prorate the difference automatically based on time left in your billing cycle.
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setConfirmPlanId("")}
                disabled={billingLoading}
                style={{
                  background: "none",
                  border: "1px solid #2A2520",
                  color: "#8A7E70",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  cursor: billingLoading ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <GoldButton
                onClick={async () => {
                  const nextId = confirmPlanId;
                  setConfirmPlanId("");
                  await updatePlan(nextId);
                }}
                disabled={billingLoading}
              >
                {billingLoading ? "Updating..." : "Confirm change"}
              </GoldButton>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
