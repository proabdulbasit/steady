"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell, STARTER_QUESTIONS } from "../components/steady-ui";
import { useSteady } from "../components/steady-provider";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { remainingQuestions, isPremium, isAuthenticated, syncCheckout, refreshProfile } = useSteady();

  useEffect(() => {
    const checkout = searchParams?.get("checkout");
    const checkoutSessionId = searchParams?.get("session_id");
    if (checkout !== "success" || !checkoutSessionId || !isAuthenticated) return;

    // If webhooks aren't configured (common locally), this sync makes the upgrade reflect immediately..
    syncCheckout(checkoutSessionId)
      .catch(() => null)
      .finally(() => refreshProfile());
  }, [isAuthenticated, refreshProfile, searchParams, syncCheckout]);

  return (
    <PageShell>
      <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "#C8A96E", marginBottom: "10px", textAlign: "center" }}>
          Built for real business owners
        </div>
        <h1 style={{ fontSize: "clamp(30px,5.6vw,54px)", fontWeight: "400", lineHeight: "1.04", margin: "0 0 10px", color: "#F1E7D7", letterSpacing: "-0.02em" }}>
          Tell me your problem.
          <br />
          <span style={{ color: "#D5B16A" }}>I&apos;ll tell you what to do.</span>
        </h1>
        <p style={{ fontSize: "12px", color: "#7B7064", lineHeight: "1.6", maxWidth: "470px", margin: "0 auto 14px", fontWeight: "400" }}>
          No fluff. No corporate speak. Straight answers for restaurants, pawnshops, auto shops, and anyone running a real business.
        </p>
        <div style={{ fontSize: "11px", color: "#5F574F", marginBottom: "18px" }}>
          {remainingQuestions === null
            ? "Unlimited questions active"
            : isPremium
              ? `${remainingQuestions} question${remainingQuestions !== 1 ? "s" : ""} remaining today`
              : `${remainingQuestions} free question${remainingQuestions !== 1 ? "s" : ""} remaining today`}
        </div>
      </div>

      <div className="home-starters" style={{ maxWidth: "1120px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {STARTER_QUESTIONS.map((question) => (
          <button
            key={question}
            onClick={() => router.push(`/chat?prompt=${encodeURIComponent(question)}`)}
            style={{
              background: "#17130F",
              border: "1px solid #2A2520",
              borderRadius: "14px",
              padding: "16px 18px",
              color: "#B4A799",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "14px",
              lineHeight: "1.35",
              minHeight: "84px",
              boxSizing: "border-box",
            }}
          >
            {question}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: "1480px", margin: "24px auto 0", borderTop: "1px solid #1E1A15", paddingTop: "12px" }}>
        <div className="steady-composer" style={{ maxWidth: "1480px", margin: "0 auto", display: "flex", gap: "10px", alignItems: "center", background: "#17130F", border: "1px solid #2A2520", borderRadius: "999px", padding: "8px 10px 8px 14px" }}>
          <button
            type="button"
            aria-label="Add"
            style={iconButtonStyle}
          >
            +
          </button>
          <button
            onClick={() => router.push("/chat")}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "#6E665D",
              textAlign: "left",
              fontSize: "16px",
              fontFamily: "inherit",
              cursor: "pointer",
              padding: "10px 0",
            }}
          >
            What&apos;s going on with your business?
          </button>
          <button
            onClick={() => router.push("/chat")}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "999px",
              border: "none",
              background: "linear-gradient(135deg,#C8A96E,#A07840)",
              color: "#0F0D0A",
              cursor: "pointer",
              fontSize: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#463F39" }}>
          {remainingQuestions === null
            ? "Unlimited questions active · Steady gives business advice, not legal counsel"
            : isPremium
              ? `${remainingQuestions} questions left today · Steady gives business advice, not legal counsel`
              : `${remainingQuestions} free questions left today · Steady gives business advice, not legal counsel`}
        </div>
        <style>{`
          @media (max-width: 768px) {
            .home-starters {
              grid-template-columns: 1fr !important;
            }
            .steady-composer {
              border-radius: 22px !important;
            }
          }
        `}</style>
      </div>
    </PageShell>
  );
}

const iconButtonStyle = {
  width: "38px",
  height: "38px",
  borderRadius: "999px",
  border: "none",
  background: "transparent",
  color: "#B7AA97",
  cursor: "default",
  fontSize: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  padding: 0,
};
