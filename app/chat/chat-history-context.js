"use client";

import { createContext, useContext } from "react";

const ChatHistoryContext = createContext(null);

export function ChatHistoryProvider({ value, children }) {
  return <ChatHistoryContext.Provider value={value}>{children}</ChatHistoryContext.Provider>;
}

export function useChatHistory() {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) throw new Error("useChatHistory must be used inside ChatHistoryProvider.");
  return ctx;
}

