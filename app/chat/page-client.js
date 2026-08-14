"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BUSINESS_SYSTEM, FREE_SYSTEM, PREMIUM_SYSTEM, formatMessage } from "../../components/steady-ui";
import { ExplainToMyTeam } from "../../components/explain-to-my-team";
import { ChatVoiceButton } from "../../components/chat-voice-button";
import { ChatVoiceMode, ChatVoiceModeLaunchButton } from "../../components/chat-voice-mode";
import { useSteady } from "../../components/steady-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { appendConversationMessages, createConversation, fetchConversation } from "../../lib/chat-client";
import { useChatHistory } from "./chat-history-context";
import { PLAN_IDS } from "../../lib/plans";
import { canAccessApp } from "../../lib/auth-redirect";

/**
 * Survives ChatClientPage remounts when the URL flips from ?prompt= to ?c=id mid-stream.
 * The async send keeps writing here; a newly mounted instance subscribes and paints it.
 */
const inflight = {
  conversationId: "",
  prompt: "",
  messages: [],
  loading: false,
  generation: 0,
};
const inflightSubs = new Set();

function publishInflight() {
  const snap = {
    conversationId: inflight.conversationId,
    prompt: inflight.prompt,
    messages: inflight.messages,
    loading: inflight.loading,
    generation: inflight.generation,
  };
  inflightSubs.forEach((fn) => fn(snap));
}

function writeInflight(patch) {
  Object.assign(inflight, patch);
  publishInflight();
}

function inflightMatches(conversationId, prompt) {
  if (inflight.conversationId && conversationId && inflight.conversationId === conversationId) return true;
  if (inflight.loading && inflight.prompt && prompt && inflight.prompt === prompt) return true;
  return false;
}

export default function ChatClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptParam = searchParams?.get("prompt") || "";
  const conversationIdParam = searchParams?.get("c") || "";
  const { isPremium, remainingQuestions, runAssistantRequest, runAssistantRequestStream, isAuthenticated, profile, profileLoading, authToken } = useSteady();
  const { refresh: refreshHistory } = useChatHistory();
  const [input, setInput] = useState(promptParam);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const [conversationId, setConversationId] = useState(conversationIdParam);
  const [conversationTitle, setConversationTitle] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [voiceError, setVoiceError] = useState("");
  const [attachHint, setAttachHint] = useState("");
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const justCreatedIdRef = useRef("");
  const autoSentPromptRef = useRef("");
  const voiceSendingRef = useRef(false);
  const sendGenRef = useRef(0);
  const messagesRef = useRef(messages);
  const conversationIdRef = useRef(conversationId);
  const promptParamRef = useRef(promptParam);
  const loadingRef = useRef(loading);
  const authTokenRef = useRef(authToken);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    promptParamRef.current = promptParam;
  }, [promptParam]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (authTokenRef.current === authToken) return;
    authTokenRef.current = authToken;
    writeInflight({
      conversationId: "",
      prompt: "",
      messages: [],
      loading: false,
      generation: inflight.generation + 1,
    });
  }, [authToken]);

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
    if (!canAccessApp(profile)) {
      router.replace("/pricing");
    }
  }, [isAuthenticated, profile, profileLoading, router]);

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
    const apply = (snap) => {
      // Only paint live streams. Completed leftover snapshots must not replace a
      // full conversation when switching chats or starting voice/new chat.
      if (!snap?.loading) return;
      const cid = conversationIdRef.current;
      const prompt = promptParamRef.current;
      const matchById =
        snap.conversationId &&
        (snap.conversationId === cid || snap.conversationId === justCreatedIdRef.current);
      const matchByPrompt = snap.prompt && prompt && snap.prompt === prompt;
      if (!matchById && !matchByPrompt) return;
      if (snap.conversationId && (!cid || snap.conversationId === justCreatedIdRef.current) && snap.conversationId !== cid) {
        justCreatedIdRef.current = snap.conversationId;
        setConversationId(snap.conversationId);
      }
      setMessages(snap.messages);
      setLoading(true);
    };
    apply(inflight);
    inflightSubs.add(apply);
    return () => inflightSubs.delete(apply);
  }, []);

  useEffect(() => {
    // When the URL changes (e.g. clicking in sidebar / New chat), make sure our state matches it.
    // Skip the reset when the URL change came from us creating a conversation locally — local
    // state is already correct and resetting here would wipe the in-flight messages.
    const target = conversationIdParam || "";
    if (target && target === justCreatedIdRef.current) return;
    if (inflight.loading && inflightMatches(target, promptParam)) {
      justCreatedIdRef.current = inflight.conversationId || target;
      setConversationId(inflight.conversationId || target);
      setMessages(inflight.messages);
      setLoading(true);
      return;
    }
    if (!target && inflight.loading && inflight.prompt && inflight.prompt === promptParam) {
      setMessages(inflight.messages);
      setLoading(true);
      if (inflight.conversationId) {
        justCreatedIdRef.current = inflight.conversationId;
        setConversationId(inflight.conversationId);
      }
      return;
    }
    justCreatedIdRef.current = "";
    setConversationId(target);
    setConversationTitle("");
    setMessages([]);
    setLoading(false);
  }, [conversationIdParam, promptParam]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      if (!authToken || !conversationId) return;
      if (conversationId === justCreatedIdRef.current) return;
      if (conversationId === inflight.conversationId && inflight.loading) {
        setMessages(inflight.messages);
        setLoading(true);
        return;
      }
      try {
        const data = await fetchConversation(authToken, conversationId);
        if (cancelled) return;
        if (conversationId === inflight.conversationId && inflight.loading) {
          setMessages(inflight.messages);
          setLoading(true);
          return;
        }
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
    // Arriving with ?prompt= (e.g. Outcome "Partially" / Daily Pulse help) — auto-send once.
    // Do not wait for conversationId to become empty: force a new thread even if we were
    // still sitting on a previous chat when the banner navigated here.
    if (!promptParam || !isAuthenticated || profileLoading) return;
    if (conversationIdParam) return;
    if (autoSentPromptRef.current === promptParam) return;
    autoSentPromptRef.current = promptParam;
    sendMessage(promptParam, { forceNew: true }).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptParam, conversationIdParam, isAuthenticated, profileLoading]);

  async function adoptCreatedConversation(nextId) {
    if (!nextId) return;
    justCreatedIdRef.current = nextId;
    conversationIdRef.current = nextId;
    setConversationId(nextId);
    writeInflight({ conversationId: nextId });
    router.replace(`/chat?c=${encodeURIComponent(nextId)}`);
    refreshHistory().catch(() => null);
  }

  async function ensureConversationId(firstUserMessage, { forceNew = false } = {}) {
    if (!forceNew && conversationIdRef.current) return conversationIdRef.current;
    if (!authToken) return "";
    const created = await createConversation(authToken, { firstMessage: firstUserMessage });
    const nextId = created?.conversation?.id || "";
    await adoptCreatedConversation(nextId);
    return nextId;
  }

  async function ensureValidConversationId(preferredId, firstUserMessage, { forceNew = false } = {}) {
    if (!authToken) return preferredId || "";
    if (forceNew || !preferredId) return await ensureConversationId(firstUserMessage, { forceNew: true });

    try {
      await fetchConversation(authToken, preferredId);
      return preferredId;
    } catch {
      setConversationId("");
      conversationIdRef.current = "";
      return await ensureConversationId(firstUserMessage, { forceNew: true });
    }
  }

  function applyAssistantText(full, generation) {
    const update = (current) => {
      if (generation !== inflight.generation) return current;
      const base = current.length ? current : inflight.messages;
      if (!base.length) {
        const prompt = inflight.prompt || "";
        return [
          { role: "user", content: prompt, attachments: [] },
          { role: "assistant", content: full, attachments: [] },
        ];
      }
      const copy = [...base];
      const last = copy[copy.length - 1];
      if (!last || last.role !== "assistant") {
        copy.push({ role: "assistant", content: full, attachments: [] });
        return copy;
      }
      copy[copy.length - 1] = { ...last, content: full };
      return copy;
    };
    const next = update(inflight.messages);
    writeInflight({ messages: next });
    if (inflight.conversationId && conversationIdRef.current !== inflight.conversationId) return;
    setMessages(update);
  }

  async function sendMessage(text, { forceNew = false } = {}) {
    const baseText = text || input.trim();
    if (!baseText && !attachments.length) return;
    if (loadingRef.current && !forceNew) return;

    if (attachments.length && !isPremium) {
      setAttachHint("Upgrade to Pro or Business to analyze a CSV, PDF, or photo in chat.");
      return;
    }

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
      ...attachments
        .filter((a) => a.kind === "pdf" && a.base64)
        .map((a) => ({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: a.base64,
          },
        })),
    ];
    const csvBits = attachments
      .filter((a) => a.kind === "csv" && a.text)
      .map((a) => `\n\n--- CSV: ${a.name} ---\n${a.text}\n--- END CSV ---`);
    if (csvBits.length) {
      contentBlocks[0] = { type: "text", text: `${contentBlocks[0].text}${csvBits.join("")}` };
    }

    const history = forceNew ? [] : messagesRef.current || [];
    const nextMessages = [...history, { role: "user", content: contentForHistory, attachments: messageAttachments }];
    const nextMessagesForApi = toAnthropicMessages([...history, { role: "user", content: contentBlocks }]);
    const thread = [...nextMessages, { role: "assistant", content: "" }];
    const generation = ++sendGenRef.current;

    writeInflight({
      conversationId: forceNew ? "" : conversationIdRef.current || "",
      prompt: contentForHistory,
      messages: thread,
      loading: true,
      generation,
    });
    if (forceNew) {
      justCreatedIdRef.current = "";
      conversationIdRef.current = "";
      setConversationId("");
      setConversationTitle("");
    }
    setMessages(thread);
    setInput("");
    setAttachments([]);
    setLoading(true);

    let convoId = forceNew ? "" : conversationIdRef.current;
    try {
      convoId = await ensureValidConversationId(convoId, baseText || "New chat", { forceNew });
      if (generation !== inflight.generation) return;
      if (convoId) writeInflight({ conversationId: convoId });
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
          if (generation !== inflight.generation) return;
          finalText = full;
          applyAssistantText(full, generation);
        },
      });

      if (generation !== inflight.generation) return;
      const assistantContent = data.content?.[0]?.text || finalText || "Something went wrong.";
      applyAssistantText(assistantContent, generation);
      if (authToken && convoId) {
        try {
          await appendConversationMessages(authToken, convoId, [{ role: "assistant", content: assistantContent }]);
        } catch {
          // ignore persistence errors
        }
      }
    } catch (error) {
      if (generation !== inflight.generation) return;
      const assistantContent = error.message || "Request failed.";
      applyAssistantText(assistantContent, generation);
      if (authToken && convoId) {
        try {
          await appendConversationMessages(authToken, convoId, [{ role: "assistant", content: assistantContent }]);
        } catch {
          // ignore persistence errors
        }
      }
    } finally {
      if (generation === inflight.generation) {
        setLoading(false);
        writeInflight({ loading: false, messages: inflight.messages });
      }
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

  function handleVoiceInterim(text) {
    setVoiceError("");
    setInput(text);
  }

  function handleVoiceFinal(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed || loading || voiceSendingRef.current) return;
    voiceSendingRef.current = true;
    setVoiceError("");
    setInput(trimmed);
    Promise.resolve(sendMessage(trimmed))
      .catch(() => null)
      .finally(() => {
        voiceSendingRef.current = false;
      });
  }

  /** Voice Mode turn: listen → Steady answer → speak out loud (and keep chat history). */
  async function runVoiceModeTurn(userText) {
    const contentForHistory = String(userText || "").trim();
    if (!contentForHistory) throw new Error("Say something first.");

    const prior = messagesRef.current || [];
    const nextMessages = [...prior, { role: "user", content: contentForHistory, attachments: [] }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setLoading(true);

    let convoId = conversationIdRef.current;
    const voiceSystem = `${systemByTier}

VOICE MODE: Keep answers short and spoken — 2 to 4 short sentences when possible. Plain English. Still end with "Next move:" as one clear action.`;

    try {
      convoId = await ensureValidConversationId(convoId, contentForHistory);
      if (authToken && convoId) {
        try {
          await appendConversationMessages(authToken, convoId, [
            { role: "user", content: contentForHistory, attachments: [] },
          ]);
        } catch {
          // best-effort
        }
      }

      const data = await runAssistantRequest({
        system: voiceSystem,
        messages: toAnthropicMessages(nextMessages),
        maxTokens: Math.min(maxTokensByTier, 700),
      });
      const assistantContent = data.content?.[0]?.text || "I couldn’t answer that clearly. Try again.";
      setMessages((current) => {
        const copy = Array.isArray(current) ? [...current] : [];
        if (copy.length && copy[copy.length - 1]?.role === "assistant") {
          copy[copy.length - 1] = { role: "assistant", content: assistantContent, attachments: [] };
          return copy;
        }
        return [...nextMessages, { role: "assistant", content: assistantContent, attachments: [] }];
      });
      if (authToken && convoId) {
        try {
          await appendConversationMessages(authToken, convoId, [
            { role: "assistant", content: assistantContent },
          ]);
        } catch {
          // ignore
        }
      }
      return assistantContent;
    } catch (error) {
      const assistantContent = error.message || "Request failed.";
      setMessages((current) => {
        const copy = Array.isArray(current) ? [...current] : [];
        if (copy.length && copy[copy.length - 1]?.role === "assistant") {
          copy[copy.length - 1] = { role: "assistant", content: assistantContent, attachments: [] };
          return copy;
        }
        return [...nextMessages, { role: "assistant", content: assistantContent, attachments: [] }];
      });
      throw error;
    } finally {
      setLoading(false);
    }
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
        {messages.length || loading ? (
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
                                <div style={{ width: "62px", height: "62px", borderRadius: "14px", border: "1px solid rgba(15,13,10,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11 }}>
                                  {a.kind === "csv" ? "CSV" : a.kind === "pdf" ? "PDF" : "FILE"}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {msg.content ? <div>{msg.content}</div> : null}
                    </div>
                  ) : (
                    <div>
                      {formatMessage(msg.content)}
                      {msg.content?.trim() && !(loading && i === messages.length - 1) ? (
                        <ExplainToMyTeam advice={msg.content} compact />
                      ) : null}
                    </div>
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
                          <div style={{ width: "56px", height: "56px", borderRadius: "14px", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", fontWeight: 900, fontSize: 11 }}>
                            {a.kind === "csv" ? "CSV" : a.kind === "pdf" ? "PDF" : "FILE"}
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
                  <ChatAttachButton
                    isPremium={isPremium}
                    onPick={() => {
                      if (!isPremium) {
                        setAttachHint("Upgrade to Pro or Business to analyze a CSV, PDF, or photo in chat.");
                        return;
                      }
                      setAttachHint("");
                      fileInputRef.current?.click();
                    }}
                  />
                  <textarea
                    autoFocus
                    value={input}
                    onChange={(e) => {
                      setVoiceError("");
                      setInput(e.target.value);
                    }}
                    onKeyDown={handleComposerKeyDown}
                    rows={1}
                    placeholder="What's going on with your business?"
                    style={{ flex: 1, background: "transparent", border: "none", padding: "10px 0", color: "var(--ink)", fontFamily: "inherit", fontSize: "16px", resize: "none", minHeight: "24px", maxHeight: "120px" }}
                  />
                  <ChatVoiceButton
                    disabled={loading || voiceModeOpen}
                    onInterim={handleVoiceInterim}
                    onFinal={handleVoiceFinal}
                    onError={(msg) => setVoiceError(msg || "")}
                  />
                  <ChatVoiceModeLaunchButton
                    disabled={loading}
                    onClick={() => {
                      setVoiceError("");
                      setVoiceModeOpen(true);
                    }}
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
                {!attachments.length && !attachHint ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-3)", textAlign: "center" }}>
                    {isPremium
                      ? "Use + to attach a CSV, PDF, or photo of a report, invoice, or receipt."
                      : "Document attach is on Pro and Business. Tap + for details."}
                  </div>
                ) : null}
                {attachHint ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-3)", textAlign: "center" }}>{attachHint}</div>
                ) : null}
                {voiceError ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)", textAlign: "center" }}>{voiceError}</div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.csv,text/csv,.pdf,application/pdf"
        style={{ display: "none" }}
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          if (!files.length) return;
          if (!isPremium) {
            setAttachHint("Upgrade to Pro or Business to analyze a CSV, PDF, or photo in chat.");
            return;
          }

          const next = [];
          for (const file of files) {
            // Simple size guard to avoid huge base64 payloads.
            if (file.size > 10 * 1024 * 1024) continue;
            const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;
            const name = (file.name || "").toLowerCase();
            const type = (file.type || "").toLowerCase();
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
            } else if (type === "text/csv" || name.endsWith(".csv")) {
              const text = await file.text().catch(() => "");
              next.push({
                id,
                kind: "csv",
                name: file.name,
                type: file.type || "text/csv",
                size: file.size,
                previewUrl: "",
                base64: "",
                mediaType: "text/csv",
                text: String(text || "").slice(0, 80000),
              });
            } else if (type === "application/pdf" || name.endsWith(".pdf")) {
              const dataUrl = await readFileAsDataUrl(file).catch(() => "");
              const { base64 } = splitDataUrl(dataUrl);
              next.push({
                id,
                kind: "pdf",
                name: file.name,
                type: "application/pdf",
                size: file.size,
                previewUrl: "",
                base64,
                mediaType: "application/pdf",
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

      {messages.length || loading ? (
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
                    <div style={{ width: "56px", height: "56px", borderRadius: "14px", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", fontWeight: 900, fontSize: 11 }}>
                      {a.kind === "csv" ? "CSV" : a.kind === "pdf" ? "PDF" : "FILE"}
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
              <ChatAttachButton
                isPremium={isPremium}
                onPick={() => {
                  if (!isPremium) {
                    setAttachHint("Upgrade to Pro or Business to analyze a CSV, PDF, or photo in chat.");
                    return;
                  }
                  setAttachHint("");
                  fileInputRef.current?.click();
                }}
              />
              <textarea
                value={input}
                onChange={(e) => {
                  setVoiceError("");
                  setInput(e.target.value);
                }}
                onKeyDown={handleComposerKeyDown}
                rows={1}
                placeholder="What's going on with your business?"
                style={{ flex: 1, background: "transparent", border: "none", padding: "10px 0", color: "var(--ink)", fontFamily: "inherit", fontSize: "16px", resize: "none", minHeight: "24px", maxHeight: "120px" }}
              />
              <ChatVoiceButton
                disabled={loading || voiceModeOpen}
                onInterim={handleVoiceInterim}
                onFinal={handleVoiceFinal}
                onError={(msg) => setVoiceError(msg || "")}
              />
              <ChatVoiceModeLaunchButton
                disabled={loading}
                onClick={() => {
                  setVoiceError("");
                  setVoiceModeOpen(true);
                }}
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
            {!attachments.length && !attachHint ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-3)" }}>
                {isPremium
                  ? "Use + to attach a CSV, PDF, or photo of a report, invoice, or receipt."
                  : "Document attach is on Pro and Business. Tap + for details."}
              </div>
            ) : null}
            {attachHint ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-3)" }}>{attachHint}</div>
            ) : null}
            {voiceError ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)", textAlign: "center" }}>{voiceError}</div>
            ) : null}
          </div>
        </>
      ) : null}

      <ChatVoiceMode
        open={voiceModeOpen}
        disabled={loading}
        runTurn={runVoiceModeTurn}
        onClose={() => setVoiceModeOpen(false)}
        onSwitchToType={() => setVoiceModeOpen(false)}
      />

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

function ChatAttachButton({ isPremium, onPick }) {
  const [hover, setHover] = useState(false);

  const tip = isPremium
    ? "Attach a CSV, PDF, or photo of a sales report, invoice, or receipt. Steady will read it."
    : "Upgrade to Pro or Business to attach a CSV, PDF, or photo in chat.";

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Attach a CSV, PDF, or photo"
        aria-describedby={hover ? "steady-attach-tip" : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={onPick}
        style={{
          ...iconButtonStyle,
          cursor: "pointer",
          color: hover ? "var(--gold)" : "var(--ink-3)",
        }}
      >
        +
      </button>
      {hover ? (
        <div
          id="steady-attach-tip"
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            left: 0,
            zIndex: 20,
            width: 240,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--gold-ring)",
            background: "var(--bg-elev)",
            boxShadow: "var(--shadow-sm)",
            color: "var(--ink-2)",
            fontSize: 12,
            lineHeight: 1.45,
            textAlign: "left",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700, marginBottom: 4 }}>
            Attach a document
          </div>
          {tip}
        </div>
      ) : null}
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
        } else if ((a?.kind === "pdf" || a?.mediaType === "application/pdf") && a?.base64) {
          blocks.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: a.base64 },
          });
        } else if (a?.kind === "csv" && a?.text) {
          blocks[0] = {
            type: "text",
            text: `${blocks[0].text}\n\n--- CSV: ${a.name || "upload.csv"} ---\n${a.text}\n--- END CSV ---`,
          };
        }
      }
      return { role: "user", content: blocks };
    });
}
