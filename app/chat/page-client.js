"use client";

import { useEffect, useRef, useState } from "react";
import { FREE_SYSTEM, GoldButton, PageShell, PREMIUM_SYSTEM, formatMessage } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";
import { useRouter } from "next/navigation";

export default function ChatClientPage({ initialPrompt = "" }) {
  const router = useRouter();
  const { isPremium, remainingQuestions, runAssistantRequest, isAuthenticated, profile, profileLoading } = useSteady();
  const [input, setInput] = useState(initialPrompt);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (profileLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (profile?.planSelected === false) {
      router.replace("/pricing");
    }
  }, [isAuthenticated, profile?.planSelected, profileLoading, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text) {
    const content = text || input.trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const data = await runAssistantRequest({
        system: isPremium ? PREMIUM_SYSTEM : FREE_SYSTEM,
        messages: nextMessages,
        maxTokens: isPremium ? 2000 : 1200,
      });
      setMessages([...nextMessages, { role: "assistant", content: data.content?.[0]?.text || "Something went wrong." }]);
    } catch (error) {
      setMessages([...nextMessages, { role: "assistant", content: error.message || "Request failed." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      eyebrow="Chat"
      title="Ask Steady anything"
      description={
        remainingQuestions === null
          ? "Unlimited chat is active on your plan."
          : isPremium
            ? `${remainingQuestions} questions remaining today.`
            : `${remainingQuestions} free questions remaining today.`
      }
    >
      <div style={{ background: "#15120E", border: "1px solid #252018", borderRadius: "18px", padding: "16px", minHeight: "320px" }}>
        <div style={{ display: "grid", gap: "16px" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "85%", background: msg.role === "user" ? "linear-gradient(135deg,#C8A96E,#A07840)" : "#191510", border: msg.role === "assistant" ? "1px solid #2A2218" : "none", borderRadius: "16px", padding: msg.role === "user" ? "12px 16px" : "18px 20px", color: msg.role === "user" ? "#0F0D0A" : "#D4C9B8" }}>
                {msg.role === "user" ? msg.content : formatMessage(msg.content)}
              </div>
            </div>
          ))}
          {loading && <div style={{ color: "#6A6058" }}>Steady is thinking...</div>}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="chat-composer" style={{ display: "flex", gap: "10px", marginTop: "16px", alignItems: "center", background: "#17130F", border: "1px solid #2A2520", borderRadius: "999px", padding: "8px 10px 8px 14px" }}>
        <button type="button" aria-label="Add" style={iconButtonStyle}>+</button>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="What's going on with your business?" style={{ flex: 1, background: "transparent", border: "none", padding: "10px 0", color: "#E8DFD0", fontFamily: "inherit", fontSize: "16px", resize: "none", minHeight: "24px", maxHeight: "120px" }} />
        {/*
          Keep the send button on-brand even when disabled. We dim it instead of swapping colors
          so the composer always looks consistent with the rest of the theme.
        */}
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "999px",
            border: "none",
            background: "linear-gradient(135deg,#C8A96E,#A07840)",
            color: "#0F0D0A",
            opacity: input.trim() && !loading ? 1 : 0.35,
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
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
      <style>{`
        @media (max-width: 768px) {
          .chat-composer {
            border-radius: 24px !important;
          }
        }
      `}</style>
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
