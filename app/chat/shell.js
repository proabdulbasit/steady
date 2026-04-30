"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSteady } from "../../components/steady-provider";
import { createConversation, listConversations } from "../../lib/chat-client";
import { ChatHistoryProvider } from "./chat-history-context";
import ChatSidebar from "./sidebar";

export default function ChatShell({ children }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams?.get("c") || "";
  const { authToken, isAuthenticated } = useSteady();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !authToken) {
      setConversations([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listConversations(authToken);
      setConversations(Array.isArray(data?.conversations) ? data.conversations : []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [authToken, isAuthenticated]);

  useEffect(() => {
    refresh().catch(() => null);
  }, [refresh]);

  useEffect(() => {
    // If user visits /chat without selecting a conversation, open the most recent one by default.
    if (activeId) return;
    if (!conversations?.length) return;
    const first = conversations[0];
    if (!first?.id) return;
    router.replace(`/chat?c=${encodeURIComponent(first.id)}`);
  }, [activeId, conversations, router]);

  const createNewChat = useCallback(async () => {
    // UX like ChatGPT: "New chat" opens an empty conversation.
    // Prefer creating the conversation first so we can navigate to it and highlight it in the sidebar.
    if (!isAuthenticated || !authToken) {
      router.push("/chat");
      return;
    }

    try {
      const created = await createConversation(authToken, { title: "New chat" });
      const id = created?.conversation?.id;
      if (id) {
        router.push(`/chat?c=${encodeURIComponent(id)}`);
      } else {
        router.push("/chat");
      }
      await refresh();
    } catch {
      router.push("/chat");
    }
  }, [authToken, isAuthenticated, refresh, router]);

  const value = useMemo(
    () => ({
      conversations,
      loading,
      refresh,
      setConversations,
      createNewChat,
    }),
    [conversations, createNewChat, loading, refresh]
  );

  return (
    <ChatHistoryProvider value={value}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <ChatSidebar />
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </ChatHistoryProvider>
  );
}

