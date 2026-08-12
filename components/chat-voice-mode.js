"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function stripForSpeech(text = "") {
  return String(text)
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/Next move:\s*/gi, "Next move: ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWords(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ignore mic pickup of Steady's own TTS voice. */
function looksLikeEcho(transcript, spokenText) {
  const a = normalizeWords(transcript);
  const b = normalizeWords(spokenText);
  if (!a) return true;
  if (a.length < 10 && a.split(" ").length < 3) return true;
  if (!b) return false;
  if (b.includes(a) || a.includes(b.slice(0, Math.min(b.length, a.length)))) return true;
  const aw = a.split(" ").filter(Boolean);
  const bw = new Set(b.split(" ").filter(Boolean));
  if (!aw.length) return true;
  let hit = 0;
  for (const w of aw) {
    if (bw.has(w)) hit += 1;
  }
  return hit / aw.length >= 0.55;
}

/**
 * ChatGPT-style Voice Mode — continuous + barge-in.
 * If you talk while Steady is speaking, it stops and answers the new question.
 * If you stay quiet, it finishes the reply, then listens again.
 */
export function ChatVoiceMode({
  open,
  onClose,
  onSwitchToType,
  runTurn,
  disabled = false,
}) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [status, setStatus] = useState("Starting…");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const recognitionRef = useRef(null);
  const bargeInRef = useRef(null);
  const finalBitsRef = useRef("");
  const intentionalStopRef = useRef(false);
  const closedRef = useRef(false);
  const pausedRef = useRef(false);
  const phaseRef = useRef("idle");
  const runTurnRef = useRef(runTurn);
  const startListeningRef = useRef(null);
  const restartTimerRef = useRef(null);
  const turnIdRef = useRef(0);
  const speakInterruptedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    runTurnRef.current = runTurn;
  }, [runTurn]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    try {
      window.speechSynthesis?.cancel?.();
    } catch {
      // ignore
    }
  }, []);

  const stopBargeIn = useCallback(() => {
    try {
      bargeInRef.current?.abort?.();
    } catch {
      // ignore
    }
    bargeInRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    intentionalStopRef.current = true;
    try {
      recognitionRef.current?.abort?.();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    closedRef.current = true;
    pausedRef.current = false;
    turnIdRef.current += 1;
    clearRestartTimer();
    stopListening();
    stopBargeIn();
    stopSpeech();
  }, [clearRestartTimer, stopBargeIn, stopListening, stopSpeech]);

  const scheduleListen = useCallback(
    (delayMs = 280) => {
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        if (closedRef.current || pausedRef.current) return;
        startListeningRef.current?.();
      }, delayMs);
    },
    [clearRestartTimer]
  );

  /** Listen WHILE Steady talks — only interrupt when user speech is real (not TTS echo). */
  const startBargeInListen = useCallback(
    (spokenText, onBargeIn) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return;

      stopBargeIn();
      const recognition = new Ctor();
      recognition.lang = navigator.language || "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      let armed = false;
      const armTimer = setTimeout(() => {
        armed = true;
      }, 700); // ignore mic bleed for the first moment of TTS

      let triggered = false;
      const maybeTrigger = (raw) => {
        if (triggered || !armed || closedRef.current || pausedRef.current) return;
        const text = String(raw || "").trim();
        if (!text || looksLikeEcho(text, spokenText)) return;
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length < 2 && text.length < 12) return;

        triggered = true;
        clearTimeout(armTimer);
        speakInterruptedRef.current = true;
        stopSpeech();
        try {
          recognition.abort?.();
        } catch {
          // ignore
        }
        bargeInRef.current = null;
        onBargeIn?.(text);
      };

      recognition.onresult = (event) => {
        let interim = "";
        let finals = "";
        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          const piece = result?.[0]?.transcript || "";
          if (result.isFinal) finals += ` ${piece}`;
          else interim += piece;
        }
        const live = `${finals} ${interim}`.replace(/\s+/g, " ").trim();
        if (live) {
          // Show live interrupt text lightly
          if (armed && !looksLikeEcho(live, spokenText)) setHeard(live);
          maybeTrigger(live);
        }
      };

      recognition.onerror = () => {
        // Keep speaking — barge-in is best-effort.
      };

      recognition.onend = () => {
        bargeInRef.current = null;
        // If still speaking and not interrupted, try to keep barge-in alive.
        if (
          !triggered &&
          !closedRef.current &&
          !pausedRef.current &&
          !speakInterruptedRef.current &&
          phaseRef.current === "speaking"
        ) {
          setTimeout(() => {
            if (phaseRef.current === "speaking" && !speakInterruptedRef.current) {
              startBargeInListen(spokenText, onBargeIn);
            }
          }, 200);
        }
      };

      bargeInRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // Mic busy with TTS — barge-in may be unavailable this turn.
      }

      return () => {
        clearTimeout(armTimer);
        try {
          recognition.abort?.();
        } catch {
          // ignore
        }
      };
    },
    [stopBargeIn, stopSpeech]
  );

  const speakWithBargeIn = useCallback(
    (text) =>
      new Promise((resolve) => {
        const spoken = stripForSpeech(text);
        if (!window.speechSynthesis) {
          resolve({ interrupted: false });
          return;
        }

        speakInterruptedRef.current = false;
        stopBargeIn();
        stopSpeech();

        let settled = false;
        const finish = (payload) => {
          if (settled) return;
          settled = true;
          stopBargeIn();
          resolve(payload);
        };

        const utter = new SpeechSynthesisUtterance(spoken);
        utter.lang = navigator.language || "en-US";
        utter.rate = 1.02;
        utter.pitch = 1;
        utter.onend = () => {
          if (speakInterruptedRef.current) return;
          finish({ interrupted: false });
        };
        utter.onerror = () => {
          if (speakInterruptedRef.current) return;
          finish({ interrupted: false });
        };

        // Start barge-in mic shortly after TTS begins.
        setTimeout(() => {
          if (closedRef.current || pausedRef.current || settled) return;
          startBargeInListen(spoken, (bargeInText) => {
            finish({ interrupted: true, bargeInText });
          });
        }, 120);

        setTimeout(() => {
          try {
            window.speechSynthesis.speak(utter);
          } catch {
            finish({ interrupted: false });
          }
        }, 40);
      }),
    [startBargeInListen, stopBargeIn, stopSpeech]
  );

  const handleUserSpeechRef = useRef(null);

  const handleUserSpeech = useCallback(
    async (text) => {
      if (closedRef.current || pausedRef.current || !text.trim()) {
        if (!closedRef.current && !pausedRef.current) scheduleListen(350);
        return;
      }

      const turnId = ++turnIdRef.current;
      stopBargeIn();
      stopListening();
      stopSpeech();

      setHeard(text.trim());
      setReply("");
      phaseRef.current = "thinking";
      setPhase("thinking");
      setStatus("Steady is thinking…");
      setError("");

      try {
        const answer = await runTurnRef.current?.(text.trim());
        if (closedRef.current || turnId !== turnIdRef.current) return;
        if (pausedRef.current) {
          setPhase("paused");
          setStatus("Paused — tap mic to continue");
          return;
        }

        const spoken = String(answer || "").trim() || "I didn’t catch a clear answer. Try again.";
        setReply(spoken);
        phaseRef.current = "speaking";
        setPhase("speaking");
        setStatus("Steady is speaking… (talk to interrupt)");

        const result = await speakWithBargeIn(spoken);
        if (closedRef.current || turnId !== turnIdRef.current) return;
        if (pausedRef.current) {
          setPhase("paused");
          setStatus("Paused — tap mic to continue");
          return;
        }

        // User talked over Steady → answer the NEW question immediately.
        if (result?.interrupted && result.bargeInText) {
          setStatus("Got it — answering your new question…");
          await handleUserSpeechRef.current?.(result.bargeInText);
          return;
        }

        phaseRef.current = "listening";
        setPhase("listening");
        setStatus("Listening… keep talking");
        scheduleListen(450);
      } catch (err) {
        if (closedRef.current || turnId !== turnIdRef.current) return;
        setError(err?.message || "Something went wrong. Try again.");
        if (pausedRef.current) {
          setPhase("paused");
          setStatus("Paused — tap mic to continue");
          return;
        }
        setStatus("Listening… try again");
        scheduleListen(600);
      }
    },
    [scheduleListen, speakWithBargeIn, stopBargeIn, stopListening, stopSpeech]
  );

  useEffect(() => {
    handleUserSpeechRef.current = handleUserSpeech;
  }, [handleUserSpeech]);

  const startListening = useCallback(() => {
    if (closedRef.current || pausedRef.current || disabled) return;
    if (phaseRef.current === "thinking" || phaseRef.current === "speaking") return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice mode needs Chrome or Edge.");
      setPhase("paused");
      setStatus("Voice not supported — close and use Type");
      return;
    }

    stopBargeIn();
    stopSpeech();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    intentionalStopRef.current = false;
    finalBitsRef.current = "";
    setError("");
    phaseRef.current = "listening";
    setPhase("listening");
    setStatus("Listening… speak anytime");

    const recognition = new Ctor();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (closedRef.current || pausedRef.current) return;
      setPhase("listening");
      setStatus("Listening… speak anytime");
    };

    recognition.onerror = (event) => {
      const code = event?.error || "";
      if (closedRef.current || pausedRef.current) return;
      if (code === "aborted") return;

      if (code === "no-speech") {
        setStatus("Still listening…");
        scheduleListen(300);
        return;
      }

      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Allow microphone access to use Voice Mode.");
        setPhase("paused");
        setStatus("Mic blocked — allow access, then tap mic");
        return;
      }

      if (code === "network") {
        setError("Speech recognition needs a network connection.");
      } else {
        setError("Couldn’t hear that — listening again…");
      }
      scheduleListen(500);
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finals = finalBitsRef.current;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript || "";
        if (result.isFinal) {
          finals = `${finals} ${piece}`.replace(/\s+/g, " ").trim();
          finalBitsRef.current = finals;
        } else {
          interim += piece;
        }
      }
      const live = `${finals} ${interim}`.replace(/\s+/g, " ").trim();
      if (live) setHeard(live);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (closedRef.current || pausedRef.current) return;
      if (intentionalStopRef.current) {
        intentionalStopRef.current = false;
        return;
      }
      if (phaseRef.current === "thinking" || phaseRef.current === "speaking") return;

      const text = finalBitsRef.current.trim();
      if (text) {
        handleUserSpeech(text);
      } else {
        scheduleListen(300);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      scheduleListen(500);
    }
  }, [disabled, handleUserSpeech, scheduleListen, stopBargeIn, stopSpeech]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  useEffect(() => {
    if (!open) {
      cleanup();
      setPhase("idle");
      setStatus("Starting…");
      setHeard("");
      setReply("");
      setError("");
      return;
    }

    closedRef.current = false;
    pausedRef.current = false;
    setHeard("");
    setReply("");
    setError("");
    phaseRef.current = "listening";
    setPhase("listening");
    setStatus("Listening… speak anytime");
    scheduleListen(200);

    return () => cleanup();
  }, [open, cleanup, scheduleListen]);

  function handleMicClick() {
    if (phase === "listening" || phase === "thinking" || phase === "speaking") {
      pausedRef.current = true;
      turnIdRef.current += 1;
      clearRestartTimer();
      stopListening();
      stopBargeIn();
      stopSpeech();
      setPhase("paused");
      setStatus("Paused — tap mic to continue");
      return;
    }

    pausedRef.current = false;
    setError("");
    setStatus("Listening… speak anytime");
    scheduleListen(120);
  }

  function handleClose() {
    cleanup();
    onClose?.();
  }

  function handleType() {
    cleanup();
    onSwitchToType?.();
  }

  if (!open || !mounted) return null;

  const orbClass =
    phase === "listening"
      ? "is-listening"
      : phase === "thinking"
        ? "is-thinking"
        : phase === "speaking"
          ? "is-speaking"
          : "is-idle";

  return createPortal(
    <div className="steady-voice-mode" role="dialog" aria-modal="true" aria-label="Voice mode">
      <div className="steady-voice-mode-inner">
        <div className={`steady-voice-orb ${orbClass}`} aria-hidden="true">
          <div className="steady-voice-orb-core" />
          <div className="steady-voice-orb-ring" />
        </div>

        <div className="steady-voice-status">{status}</div>
        {heard ? <div className="steady-voice-heard">{heard}</div> : null}
        {reply && phase !== "listening" ? (
          <div className="steady-voice-reply">
            {stripForSpeech(reply).slice(0, 280)}
            {stripForSpeech(reply).length > 280 ? "…" : ""}
          </div>
        ) : null}
        {error ? <div className="steady-voice-error">{error}</div> : null}

        <div className="steady-voice-bar">
          <button type="button" className="steady-voice-type" onClick={handleType}>
            <span aria-hidden="true">+</span> Type
          </button>

          <div className="steady-voice-bar-right">
            <button
              type="button"
              className={`steady-voice-mic ${phase === "listening" ? "is-on" : ""} ${phase === "paused" ? "is-paused" : ""}`}
              aria-label={phase === "paused" ? "Resume listening" : "Pause voice mode"}
              disabled={disabled}
              onClick={handleMicClick}
              title={phase === "paused" ? "Resume" : "Pause"}
            >
              <MicIcon />
            </button>
            <button type="button" className="steady-voice-close" aria-label="Close voice mode" onClick={handleClose}>
              ×
            </button>
          </div>
        </div>
      </div>

      <style>{voiceModeCss}</style>
    </div>,
    document.body
  );
}

export function ChatVoiceModeLaunchButton({ disabled = false, onClick, title = "Start Voice" }) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 48,
        height: 48,
        borderRadius: 999,
        border: "none",
        background: disabled ? "var(--ink-4)" : "var(--ink)",
        color: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        padding: 0,
      }}
    >
      <WaveIcon />
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="9" width="2.4" height="6" rx="1.2" />
      <rect x="8.5" y="6" width="2.4" height="12" rx="1.2" />
      <rect x="13" y="8" width="2.4" height="8" rx="1.2" />
      <rect x="17.5" y="5" width="2.4" height="14" rx="1.2" />
    </svg>
  );
}

const voiceModeCss = `
.steady-voice-mode {
  position: fixed;
  inset: 0;
  z-index: 1000000;
  background: color-mix(in srgb, var(--bg) 96%, #fff);
  display: flex;
  align-items: stretch;
  justify-content: center;
}
.steady-voice-mode-inner {
  width: min(720px, 100%);
  margin: 0 auto;
  padding: 48px 24px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
  box-sizing: border-box;
}
.steady-voice-orb {
  margin-top: min(18vh, 160px);
  width: min(220px, 46vw);
  height: min(220px, 46vw);
  border-radius: 999px;
  position: relative;
  display: grid;
  place-items: center;
}
.steady-voice-orb-core {
  width: 72%;
  height: 72%;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 30%, #9ec5ff 0%, #5b8def 42%, #dfe9f8 78%, #f7f3ea 100%);
  filter: blur(0.2px);
  box-shadow: 0 20px 60px rgba(70, 110, 180, 0.28);
}
.steady-voice-orb-ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  opacity: 0.55;
}
.steady-voice-orb.is-listening .steady-voice-orb-core {
  animation: steadyVoicePulse 1.1s ease-in-out infinite;
  background: radial-gradient(circle at 35% 30%, #b7d4ff 0%, #4f84ef 45%, #e8eef8 100%);
}
.steady-voice-orb.is-thinking .steady-voice-orb-core {
  animation: steadyVoiceSpin 2.4s linear infinite;
  filter: blur(1px);
}
.steady-voice-orb.is-speaking .steady-voice-orb-core {
  animation: steadyVoiceSpeak 0.9s ease-in-out infinite;
  background: radial-gradient(circle at 40% 28%, #c8a45a 0%, #a07a2c 40%, #f1e7d7 100%);
}
.steady-voice-status {
  margin-top: 28px;
  font-size: 15px;
  color: var(--ink-3);
  text-align: center;
}
.steady-voice-heard {
  margin-top: 14px;
  max-width: 520px;
  text-align: center;
  font-size: 18px;
  color: var(--ink);
  line-height: 1.45;
  font-family: var(--font-serif, Georgia, serif);
}
.steady-voice-reply {
  margin-top: 12px;
  max-width: 520px;
  text-align: center;
  font-size: 14px;
  color: var(--ink-2);
  line-height: 1.55;
}
.steady-voice-error {
  margin-top: 12px;
  font-size: 13px;
  color: var(--danger);
  text-align: center;
}
.steady-voice-bar {
  margin-top: auto;
  width: min(560px, 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px 10px 16px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--bg-elev);
  box-shadow: var(--shadow-md);
}
.steady-voice-type {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--ink-3);
  font: inherit;
  font-size: 15px;
  cursor: pointer;
  padding: 8px 4px;
}
.steady-voice-type span {
  font-size: 22px;
  line-height: 1;
  color: var(--ink-2);
}
.steady-voice-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.steady-voice-mic {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--ink-2);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.steady-voice-mic.is-on {
  background: var(--danger-soft);
  color: var(--danger);
  box-shadow: 0 0 0 2px var(--danger);
}
.steady-voice-mic.is-paused {
  background: var(--gold-soft);
  color: var(--gold);
  box-shadow: 0 0 0 2px var(--gold-ring);
}
.steady-voice-close {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: none;
  background: var(--ink);
  color: var(--bg);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
}
@keyframes steadyVoicePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
@keyframes steadyVoiceSpeak {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
@keyframes steadyVoiceSpin {
  0% { filter: blur(0.5px) hue-rotate(0deg); }
  100% { filter: blur(1.2px) hue-rotate(40deg); }
}
@media (max-width: 520px) {
  .steady-voice-mode-inner { padding: 28px 16px 18px; }
  .steady-voice-orb { margin-top: 12vh; }
}
`;
