"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSteady } from "../../components/steady-provider";
import { listConversations } from "../../lib/chat-client";
import { ChatHistoryProvider } from "./chat-history-context";
import ChatSidebar from "./sidebar";

export default function ChatShell({ children }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams?.get("c") || "";
  const isNew = searchParams?.get("new") === "1";
  const hasPrompt = Boolean(searchParams?.get("prompt"));
  const { authToken, isAuthenticated } = useSteady();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
    // Skip this when they explicitly opened a fresh chat (?new=1) or arrived with ?prompt=
    // (Outcome "Partially" / Daily Pulse "help me") — those must start a new thread, not
    // steal the URL back to the previous conversation mid-send.
    if (activeId) return;
    if (isNew) return;
    if (hasPrompt) return;
    if (!conversations?.length) return;
    const first = conversations[0];
    if (!first?.id) return;
    router.replace(`/chat?c=${encodeURIComponent(first.id)}`);
  }, [activeId, conversations, hasPrompt, isNew, router]);

  useEffect(() => {
    // Close the mobile drawer when navigation changes.
    setMobileSidebarOpen(false);
  }, [activeId]);

  const createNewChat = useCallback(() => {
    // Don't create a backend conversation yet — the entry should only appear in the
    // sidebar once the user actually sends a message. `page-client.js` handles lazy
    // creation via ensureConversationId() on the first send.
    router.push("/chat?new=1");
  }, [router]);

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
      <div className="chat-shell" style={{ display: "flex" }}>
        <ChatSidebar
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
        <main className="surface-chrome chat-main" style={{ flex: 1 }}>
          <div className="chat-main-inner">
            <div className="chat-toolbar">
              <button
                type="button"
                aria-label="Open chat history"
                className="icon-btn chat-mobile-toggle"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>≡</span>
              </button>
            </div>
            {children}
          </div>
        </main>
      </div>
    </ChatHistoryProvider>
  );
}

