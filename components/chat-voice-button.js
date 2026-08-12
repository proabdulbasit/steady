"use client";

import { useEffect, useRef, useState } from "react";

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Chat mic button — Web Speech API (free, browser-native).
 * Speaks → fills text → parent auto-sends on final result.
 */
export function ChatVoiceButton({ disabled = false, onInterim, onFinal, onError }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const finalBitsRef = useRef("");
  const intentionalStopRef = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
    return () => {
      try {
        intentionalStopRef.current = true;
        recognitionRef.current?.abort?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, []);

  function stopListening() {
    intentionalStopRef.current = true;
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    setListening(false);
  }

  function startListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      onError?.("Voice input isn’t supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (disabled) return;

    intentionalStopRef.current = false;
    finalBitsRef.current = "";

    const recognition = new Ctor();
    recognition.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onerror = (event) => {
      const code = event?.error || "";
      if (code === "aborted" || code === "no-speech") {
        setListening(false);
        return;
      }
      if (code === "not-allowed" || code === "service-not-allowed") {
        onError?.("Microphone permission blocked. Allow mic access and try again.");
      } else if (code === "network") {
        onError?.("Speech recognition needs a network connection in this browser.");
      } else {
        onError?.("Couldn’t hear that. Tap the mic and try again.");
      }
      setListening(false);
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
      if (live) onInterim?.(live);
    };

    recognition.onend = () => {
      setListening(false);
      const text = finalBitsRef.current.trim();
      recognitionRef.current = null;
      if (!intentionalStopRef.current && text) {
        onFinal?.(text);
      }
      intentionalStopRef.current = false;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      onError?.("Couldn’t start the microphone. Try again.");
      setListening(false);
    }
  }

  function handleClick() {
    if (listening) {
      stopListening();
      return;
    }
    startListening();
  }

  if (!supported) {
    return (
      <button
        type="button"
        aria-label="Voice input not supported"
        title="Voice input needs Chrome or Edge"
        disabled
        style={{
          ...micStyle,
          opacity: 0.35,
          cursor: "not-allowed",
        }}
      >
        ⌢
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={listening ? "Stop listening" : "Speak instead of type"}
      title={listening ? "Listening… tap to stop" : "Voice input"}
      disabled={disabled && !listening}
      onClick={handleClick}
      style={{
        ...micStyle,
        color: listening ? "var(--danger)" : "var(--ink-3)",
        background: listening ? "var(--danger-soft)" : "transparent",
        boxShadow: listening ? "0 0 0 2px var(--danger)" : "none",
        cursor: disabled && !listening ? "not-allowed" : "pointer",
        opacity: disabled && !listening ? 0.4 : 1,
        animation: listening ? "steadyMicPulse 1.2s ease-in-out infinite" : "none",
      }}
    >
      <MicIcon listening={listening} />
      <style>{`
        @keyframes steadyMicPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
    </button>
  );
}

function MicIcon({ listening }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={listening ? "currentColor" : "none"}
      />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const micStyle = {
  width: "38px",
  height: "38px",
  borderRadius: "999px",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  padding: 0,
};
