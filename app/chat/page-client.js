"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BUSINESS_SYSTEM, FREE_SYSTEM, PREMIUM_SYSTEM, formatMessage } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";
import { useRouter } from "next/navigation";
import { appendConversationMessages, createConversation, fetchConversation } from "../../lib/chat-client";
import { useChatHistory } from "./chat-history-context";
import { PLAN_IDS } from "../../lib/plans";

export default function ChatClientPage({ initialPrompt = "", initialConversationId = "" }) {
  const router = useRouter();
  const { isPremium, remainingQuestions, runAssistantRequest, runAssistantRequestStream, isAuthenticated, profile, profileLoading, authToken } = useSteady();
  const { refresh: refreshHistory } = useChatHistory();
  const [input, setInput] = useState(initialPrompt);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [conversationTitle, setConversationTitle] = useState("");
  const [attachments, setAttachments] = useState([]);
  const justCreatedIdRef = useRef("");

  const planId = profile?.planId || PLAN_IDS.FREE;
  const maxTokensByTier = planId === PLAN_IDS.BUSINESS ? 1200 : planId === PLAN_IDS.PRO ? 800 : 400;
  const systemByTier = planId === PLAN_IDS.BUSINESS ? BUSINESS_SYSTEM : isPremium ? PREMIUM_SYSTEM : FREE_SYSTEM;
  const attachmentSummary = useMemo(() => attachments, [attachments]);

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

  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a?.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, [attachments]);

  useEffect(() => {
    // When the URL changes (e.g. clicking in sidebar / New chat), make sure our state matches it.
    // Skip the reset when the URL change came from us creating a conversation locally — local
    // state is already correct and resetting here would wipe the in-flight messages.
    const target = initialConversationId || "";
    if (target && target === justCreatedIdRef.current) return;
    justCreatedIdRef.current = "";
    setConversationId(target);
    setConversationTitle("");
    setMessages([]);
  }, [initialConversationId]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      if (!authToken || !conversationId) return;
      if (conversationId === justCreatedIdRef.current) return;
      try {
        const data = await fetchConversation(authToken, conversationId);
        if (cancelled) return;
        const convo = data?.conversation;
        setConversationTitle(convo?.title || "");
        setMessages(
          Array.isArray(convo?.messages)
            ? convo.messages.map((m) => ({
                role: m.role,
                content: m.content,
                attachments: Array.isArray(m.attachments) ? m.attachments : [],
              }))
            : []
        );
      } catch {
        // If a conversation can't be loaded, fall back to empty state.
        if (cancelled) return;
        setConversationTitle("");
        setMessages([]);
        // If the URL points to a missing conversation (deleted / wrong user), clear it so ChatShell can select a valid one.
        router.replace("/chat");
      }
    }

    loadConversation().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [authToken, conversationId]);

  useEffect(() => {
    // If we arrived with an initial prompt and no conversation selected,
    // automatically start the conversation by sending that prompt once.
    if (!initialPrompt || conversationId) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    sendMessage(initialPrompt).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensureConversationId(firstUserMessage) {
    if (conversationId) return conversationId;
    if (!authToken) return "";
    const created = await createConversation(authToken, { firstMessage: firstUserMessage });
    const nextId = created?.conversation?.id || "";
    if (nextId) {
      // Mark this id as locally created BEFORE the state/URL changes so the sync effects
      // don't wipe our in-flight messages or refetch an empty conversation.
      justCreatedIdRef.current = nextId;
      setConversationId(nextId);
      router.replace(`/chat?c=${encodeURIComponent(nextId)}`);
      refreshHistory().catch(() => null);
    }
    return nextId;
  }

  async function ensureValidConversationId(preferredId, firstUserMessage) {
    // If the current conversation id doesn't exist on the backend anymore, create a new one.
    if (!authToken) return preferredId || "";
    if (!preferredId) return await ensureConversationId(firstUserMessage);

    try {
      await fetchConversation(authToken, preferredId);
      return preferredId;
    } catch {
      setConversationId("");
      const created = await createConversation(authToken, { firstMessage: firstUserMessage });
      const nextId = created?.conversation?.id || "";
      if (nextId) {
        justCreatedIdRef.current = nextId;
        setConversationId(nextId);
        router.replace(`/chat?c=${encodeURIComponent(nextId)}`);
        refreshHistory().catch(() => null);
      }
      return nextId;
    }
  }

  async function sendMessage(text) {
    const baseText = text || input.trim();
    if ((!baseText && !attachments.length) || loading) return;

    const contentForHistory = baseText.trim();
    const messageAttachments = attachmentSummary.map((a) => ({
      kind: a.kind,
      name: a.name,
      type: a.type,
      size: a.size,
      mediaType: a.mediaType,
      base64: a.base64,
    }));
    const contentBlocks = [
      { type: "text", text: contentForHistory || "See attachments." },
      ...attachments
        .filter((a) => a.kind === "image" && a.base64 && a.mediaType)
        .map((a) => ({
          type: "image",
          source: {
            type: "base64",
            media_type: a.mediaType,
            data: a.base64,
          },
        })),
    ];

    const nextMessages = [...messages, { role: "user", content: contentForHistory, attachments: messageAttachments }];
    const nextMessagesForApi = toAnthropicMessages([...messages, { role: "user", content: contentBlocks }]);
    // Create placeholder assistant message so we can stream into it.
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setAttachments([]);
    setLoading(true);
    let convoId = conversationId;
    try {
      convoId = await ensureValidConversationId(convoId, baseText || "New chat");
      if (authToken && convoId) {
        try {
          await appendConversationMessages(authToken, convoId, [{ role: "user", content: contentForHistory || "See attachments.", attachments: messageAttachments }]);
        } catch {
          // Persistence is best-effort; don't fail the chat UX if history save fails.
        }
      }

      let finalText = "";
      const data = await runAssistantRequestStream({
        system: systemByTier,
        messages: nextMessagesForApi,
        maxTokens: maxTokensByTier,
        onText: (_delta, full) => {
          finalText = full;
          setMessages((current) => {
            if (!current.length) return current;
            const copy = [...current];
            const last = copy[copy.length - 1];
            if (!last || last.role !== "assistant") return copy;
            copy[copy.length - 1] = { ...last, content: full };
            return copy;
          });
        },
      });

      const assistantContent = data.content?.[0]?.text || finalText || "Something went wrong.";
      setMessages((current) => {
        if (!current.length) return current;
        const copy = [...current];
        const last = copy[copy.length - 1];
        if (!last || last.role !== "assistant") return copy;
        copy[copy.length - 1] = { ...last, content: assistantContent, attachments: [] };
        return copy;
      });
      if (authToken && convoId) {
        try {
          await appendConversationMessages(authToken, convoId, [{ role: "assistant", content: assistantContent }]);
        } catch {
          // ignore persistence errors
        }
      }
    } catch (error) {
      const assistantContent = error.message || "Request failed.";
      setMessages((current) => {
        // Replace placeholder assistant message if present, else append.
        const copy = Array.isArray(current) ? [...current] : [];
        if (copy.length && copy[copy.length - 1]?.role === "assistant") {
          copy[copy.length - 1] = { role: "assistant", content: assistantContent, attachments: [] };
          return copy;
        }
        return [...nextMessages, { role: "assistant", content: assistantContent, attachments: [] }];
      });
      if (authToken && convoId) {
        try {
          await appendConversationMessages(authToken, convoId, [{ role: "assistant", content: assistantContent }]);
        } catch {
          // ignore persistence errors
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function handleComposerKeyDown(e) {
    // Enter sends, Shift+Enter inserts a newline. Ignore IME composition events.
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent?.isComposing || e.isComposing) return;
    e.preventDefault();
    if ((!input.trim() && !attachments.length) || loading) return;
    sendMessage();
  }

  return (
    <div className="chat-page">
      <div className="chat-page-head">
        <p className="lede" style={{ margin: 0, maxWidth: 720 }}>
          {remainingQuestions === null
            ? "Unlimited chat is active on your plan."
            : isPremium
              ? `${remainingQuestions} questions remaining today.`
              : `${remainingQuestions} free questions remaining today.`}
        </p>
      </div>

      <div className="chat-thread">
        {messages.length ? (
          <div style={{ display: "grid", gap: "16px" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", overflowWrap: "anywhere", wordBreak: "break-word", background: msg.role === "user" ? "var(--gradient-gold)" : "var(--bg-soft)", border: "none", borderRadius: "16px", padding: msg.role === "user" ? "12px 16px" : "18px 20px", color: msg.role === "user" ? "#1A1410" : "var(--ink-2)" }}>
                  {msg.role === "user" ? (
                    <div style={{ display: "grid", gap: "10px" }}>
                      {Array.isArray(msg.attachments) && msg.attachments.length ? (
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          {msg.attachments.map((a, idx) => (
                            <div
                              key={`${a.name}-${idx}`}
                              style={{
                                background: "rgba(15,13,10,0.16)",
                                border: "1px solid rgba(15,13,10,0.18)",
                                borderRadius: "16px",
                                padding: "8px",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                              }}
                            >
                              {a.kind === "image" && a.base64 && a.mediaType ? (
                                <img
                                  src={`data:${a.mediaType};base64,${a.base64}`}
                                  alt=""
                                  style={{ width: "62px", height: "62px", borderRadius: "14px", objectFit: "cover", border: "1px solid rgba(15,13,10,0.18)" }}
                                />
                              ) : (
                                <div style={{ width: "62px", height: "62px", borderRadius: "14px", border: "1px solid rgba(15,13,10,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
                                  FILE
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {msg.content ? <div>{msg.content}</div> : null}
                    </div>
                  ) : (
                    formatMessage(msg.content)
                  )}
                </div>
              </div>
            ))}
            {loading && <div style={{ color: "var(--ink-3)" }}>Steady is thinking...</div>}
            <div ref={bottomRef} />
          </div>
        ) : (
          <div className="chat-empty">
            <div style={{ textAlign: "center", maxWidth: 720, width: "100%", display: "grid", justifyItems: "center", gap: 16 }}>
              <div className="h3 serif" style={{ margin: "0 0 10px" }}>What are you working on?</div>
              <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 15, lineHeight: 1.6 }}>
                Describe the situation like you’d say it out loud. Steady will ask for any missing number, then give you one clear next move.
              </p>
              <div className="chat-composer-wrap is-centered" style={{ paddingBottom: 0 }}>
                {attachments.length ? (
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
                    {attachments.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          background: "var(--bg-soft)",
                          border: "1px solid var(--line)",
                          borderRadius: "16px",
                          padding: "8px 8px",
                        }}
                      >
                        {a.kind === "image" && a.previewUrl ? (
                          <img
                            src={a.previewUrl}
                            alt=""
                            style={{ width: "56px", height: "56px", borderRadius: "14px", objectFit: "cover", border: "1px solid var(--line)" }}
                          />
                        ) : (
                          <div style={{ width: "56px", height: "56px", borderRadius: "14px", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", fontWeight: 900 }}>
                            FILE
                          </div>
                        )}
                        <button
                          type="button"
                          aria-label="Remove attachment"
                          onClick={() => {
                            if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
                            setAttachments((current) => current.filter((x) => x.id !== a.id));
                          }}
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "10px",
                            border: "1px solid var(--line)",
                            background: "transparent",
                            color: "var(--ink-2)",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="chat-composer surface-chrome" style={{ display: "flex", gap: "10px", alignItems: "center", border: "1px solid var(--line)", borderRadius: "999px", padding: "8px 10px 8px 14px" }}>
                  <button
                    type="button"
                    aria-label="Add attachment"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ ...iconButtonStyle, cursor: "pointer" }}
                  >
                    +
                  </button>
                  <textarea
                    autoFocus
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    rows={1}
                    placeholder="What's going on with your business?"
                    style={{ flex: 1, background: "transparent", border: "none", padding: "10px 0", color: "var(--ink)", fontFamily: "inherit", fontSize: "16px", resize: "none", minHeight: "24px", maxHeight: "120px" }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={(!input.trim() && !attachments.length) || loading}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "999px",
                      border: "none",
                      background: "var(--gradient-gold)",
                      color: "#1A1410",
                      opacity: (input.trim() || attachments.length) && !loading ? 1 : 0.35,
                      cursor: (input.trim() || attachments.length) && !loading ? "pointer" : "not-allowed",
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
              </div>
            </div>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        style={{ display: "none" }}
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          if (!files.length) return;

          const next = [];
          for (const file of files) {
            // Simple size guard to avoid huge base64 payloads.
            if (file.size > 7 * 1024 * 1024) continue;
            const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;
            if (file.type?.startsWith("image/")) {
              const dataUrl = await readFileAsDataUrl(file).catch(() => "");
              const { base64, mediaType } = splitDataUrl(dataUrl);
              next.push({
                id,
                kind: "image",
                name: file.name,
                type: file.type,
                size: file.size,
                previewUrl: URL.createObjectURL(file),
                base64,
                mediaType,
              });
            } else {
              next.push({
                id,
                kind: "file",
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size,
                previewUrl: "",
                base64: "",
                mediaType: "",
              });
            }
          }
          if (next.length) setAttachments((current) => [...current, ...next].slice(0, 6));
        }}
      />

      {messages.length ? (
        <>
          {attachments.length ? (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {attachments.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "var(--bg-soft)",
                    border: "1px solid var(--line)",
                    borderRadius: "16px",
                    padding: "8px 8px",
                  }}
                >
                  {a.kind === "image" && a.previewUrl ? (
                    <img
                      src={a.previewUrl}
                      alt=""
                      style={{ width: "56px", height: "56px", borderRadius: "14px", objectFit: "cover", border: "1px solid var(--line)" }}
                    />
                  ) : (
                    <div style={{ width: "56px", height: "56px", borderRadius: "14px", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", fontWeight: 900 }}>
                      FILE
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    onClick={() => {
                      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
                      setAttachments((current) => current.filter((x) => x.id !== a.id));
                    }}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "10px",
                      border: "1px solid var(--line)",
                      background: "transparent",
                      color: "var(--ink-2)",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="chat-composer-wrap is-docked">
            <div className="chat-composer surface-chrome" style={{ display: "flex", gap: "10px", alignItems: "center", border: "1px solid var(--line)", borderRadius: "999px", padding: "8px 10px 8px 14px" }}>
              <button
                type="button"
                aria-label="Add attachment"
                onClick={() => fileInputRef.current?.click()}
                style={{ ...iconButtonStyle, cursor: "pointer" }}
              >
                +
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={1}
                placeholder="What's going on with your business?"
                style={{ flex: 1, background: "transparent", border: "none", padding: "10px 0", color: "var(--ink)", fontFamily: "inherit", fontSize: "16px", resize: "none", minHeight: "24px", maxHeight: "120px" }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={(!input.trim() && !attachments.length) || loading}
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "999px",
                  border: "none",
                  background: "var(--gradient-gold)",
                  color: "#1A1410",
                  opacity: (input.trim() || attachments.length) && !loading ? 1 : 0.35,
                  cursor: (input.trim() || attachments.length) && !loading ? "pointer" : "not-allowed",
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
          </div>
        </>
      ) : null}

      <style>{`
        @media (max-width: 768px) {
          .chat-composer {
            border-radius: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}

const iconButtonStyle = {
  width: "38px",
  height: "38px",
  borderRadius: "999px",
  border: "none",
  background: "transparent",
  color: "var(--ink-3)",
  cursor: "default",
  fontSize: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  padding: 0,
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl) {
  if (!dataUrl.startsWith("data:")) return { base64: "", mediaType: "" };
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return { base64: "", mediaType: "" };
  return { mediaType: match[1], base64: match[2] };
}

function toAnthropicMessages(msgs) {
  // Convert our stored message format into Anthropic-compatible messages.
  return (Array.isArray(msgs) ? msgs : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => {
      if (m.role !== "user") {
        return { role: "assistant", content: String(m.content || "") };
      }
      // If caller already provided blocks, keep them.
      if (Array.isArray(m.content)) {
        return { role: "user", content: m.content };
      }
      const text = String(m.content || "");
      const atts = Array.isArray(m.attachments) ? m.attachments : [];
      const blocks = [{ type: "text", text: text || "See attachments." }];
      for (const a of atts) {
        if (a?.kind === "image" && a?.base64 && a?.mediaType) {
          blocks.push({
            type: "image",
            source: { type: "base64", media_type: a.mediaType, data: a.base64 },
          });
        }
      }
      return { role: "user", content: blocks };
    });
}
