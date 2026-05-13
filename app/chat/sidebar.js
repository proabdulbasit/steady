"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useChatHistory } from "./chat-history-context";
import { deleteConversation, updateConversation } from "../../lib/chat-client";
import { useSteady } from "../../components/steady-provider";

export default function ChatSidebar({ mobileOpen = false, onMobileClose = () => null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams?.get("c") || "";
  const { conversations, loading, createNewChat, refresh } = useChatHistory();
  const { authToken } = useSteady();
  const [mounted, setMounted] = useState(false);
  const [menuForId, setMenuForId] = useState("");
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuPos, setMenuPos] = useState(null); // { top, left }
  const [menuChat, setMenuChat] = useState(null);
  const menuRef = useRef(null);
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef(null);
  const [shareChat, setShareChat] = useState(null); // { id, title }
  const [renameChat, setRenameChat] = useState(null); // { id, title, nextTitle }
  const [deleteChat, setDeleteChat] = useState(null); // { id, title }

  const items = useMemo(() => conversations || [], [conversations]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setMenuForId("");
        setShareChat(null);
        setRenameChat(null);
        setDeleteChat(null);
        onMobileClose();
      }
    }
    function onClickOutside(e) {
      if (!menuForId) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-chat-menu-root]")) return;
      if (target.closest("[data-chat-floating-menu]")) return;
      setMenuForId("");
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [menuForId]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(message) {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 1600);
  }

  function openShareModal(chat) {
    setShareChat({ id: chat.id, title: chat.title || "New chat" });
    setMenuForId("");
  }

  function openRenameModal(chat) {
    const t = chat.title || "New chat";
    setRenameChat({ id: chat.id, title: t, nextTitle: t });
    setMenuForId("");
  }

  function openDeleteModal(chat) {
    setDeleteChat({ id: chat.id, title: chat.title || "New chat" });
    setMenuForId("");
  }

  async function copyShareLink(id) {
    const url = `${window.location.origin}/chat?c=${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      showToast("Could not copy link");
    }
  }

  async function submitRename() {
    if (!renameChat?.id) return;
    const title = String(renameChat.nextTitle || "").trim();
    if (!title) return;
    try {
      await updateConversation(authToken, renameChat.id, { title });
      showToast("Renamed");
      await refresh();
      setRenameChat(null);
    } catch (e) {
      showToast(e?.message || "Rename failed");
    }
  }

  async function onTogglePin(id, pinned) {
    try {
      await updateConversation(authToken, id, { pinned: !pinned });
      showToast(!pinned ? "Pinned" : "Unpinned");
      await refresh();
    } catch (e) {
      showToast(e?.message || "Pin failed");
    } finally {
      setMenuForId("");
    }
  }

  async function submitDelete() {
    if (!deleteChat?.id) return;
    try {
      await deleteConversation(authToken, deleteChat.id);
      showToast("Deleted");
      if (activeId === deleteChat.id) router.push("/chat");
      await refresh();
      setDeleteChat(null);
    } catch (e) {
      showToast(e?.message || "Delete failed");
    }
  }

  useEffect(() => {
    if (!menuForId) {
      setMenuAnchor(null);
      setMenuPos(null);
      setMenuChat(null);
    }
  }, [menuForId]);

  useEffect(() => {
    if (!menuForId || !menuAnchor) return;
    const gutter = 8;
    // Prefer opening to the RIGHT of the kebab (like before).
    // If it would overflow, flip to the left.
    const preferredTop = menuAnchor.top - 2;
    const rightSideLeft = menuAnchor.right + 12;
    const leftSideLeft = menuAnchor.left - 12 - 220;
    const preferredLeft = rightSideLeft;
    setMenuPos({ top: Math.max(gutter, preferredTop), left: Math.max(gutter, preferredLeft) });
  }, [menuAnchor, menuForId]);

  useEffect(() => {
    if (!menuForId || !menuAnchor || !menuPos) return;
    const el = menuRef.current;
    if (!el) return;

    const gutter = 8;
    const width = el.offsetWidth || 220;
    const height = el.offsetHeight || 190;

    // Prefer right side, flip to left if needed.
    const rightSideLeft = menuAnchor.right + 12;
    const leftSideLeft = menuAnchor.left - 12 - width;
    const wantedLeft =
      rightSideLeft + width <= window.innerWidth - gutter ? rightSideLeft : leftSideLeft;

    // Prefer aligning the top edge with the kebab (feels "attached").
    const wantedTop = menuAnchor.top - 2;

    const left = Math.min(Math.max(wantedLeft, gutter), window.innerWidth - width - gutter);
    const top = Math.min(Math.max(wantedTop, gutter), window.innerHeight - height - gutter);

    if (left !== menuPos.left || top !== menuPos.top) setMenuPos({ top, left });
  }, [menuAnchor, menuForId, menuPos]);

  return (
    <aside
      className={`steady-chat-sidebar surface-chrome ${mobileOpen ? "is-open" : ""}`}
      style={{
        width: "280px",
        flexShrink: 0,
        borderRight: "1px solid var(--line)",
        position: "sticky",
        top: "var(--app-header-h)",
        height: "calc(100vh - var(--app-header-h))",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* Mobile backdrop + drawer close */}
      {mounted && mobileOpen
        ? createPortal(
            <button
              type="button"
              aria-label="Close chat history"
              onClick={onMobileClose}
              className="chat-sidebar-backdrop"
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                border: "none",
                padding: 0,
                margin: 0,
                cursor: "pointer",
                zIndex: 999998,
              }}
            />,
            document.body
          )
        : null}
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--line)" }}>
        <button
          onClick={createNewChat}
          style={{
            width: "100%",
            border: "1px solid var(--line-strong)",
            background: "transparent",
            color: "var(--ink)",
            borderRadius: "12px",
            padding: "12px 12px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <span style={{ fontWeight: 600 }}>New chat</span>
          <span aria-hidden="true" style={{ color: "var(--gold)", fontSize: "18px", lineHeight: 1 }}>
            +
          </span>
        </button>
      </div>

      <div style={{ padding: "10px 10px 14px", height: "auto", overflowY: "auto" }}>
        <div style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--ink-3)", padding: "6px 6px 10px" }}>
          Recent chats
        </div>

        {loading && !items.length ? (
          <div style={{ color: "var(--ink-3)", fontSize: "13px", padding: "8px 6px" }}>Loading…</div>
        ) : items.length ? (
          <div style={{ display: "grid", gap: "6px" }}>
            {items.map((c) => {
              const isActive = activeId && c.id === activeId;
              return (
                <div
                  key={c.id}
                  data-chat-menu-root
                  style={{
                    position: "relative",
                    border: isActive ? "1px solid var(--gold-ring)" : "1px solid var(--line)",
                    background: isActive ? "var(--gold-soft)" : "transparent",
                    color: isActive ? "var(--gold)" : "var(--ink-2)",
                    borderRadius: "12px",
                    overflow: "visible",
                  }}
                >
                  <button
                    onClick={() => router.push(`/chat?c=${encodeURIComponent(c.id)}`)}
                    className="steady-chat-item"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: "13px",
                      lineHeight: "1.25",
                      padding: "10px 36px 10px 10px",
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    {c.pinned ? <span title="Pinned" aria-hidden="true" style={{ color: "var(--gold)" }}>📌</span> : null}
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title || "New chat"}</div>
                  </button>

                  <button
                    type="button"
                    aria-label="Chat options"
                    className="steady-chat-kebab"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const next = menuForId === c.id ? "" : c.id;
                      if (next) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuAnchor({
                          top: rect.top,
                          right: rect.right,
                          bottom: rect.bottom,
                          left: rect.left,
                          width: rect.width,
                          height: rect.height,
                        });
                        setMenuChat({ id: c.id, title: c.title, pinned: Boolean(c.pinned) });
                      }
                      setMenuForId(next);
                    }}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      width: "28px",
                      height: "28px",
                      borderRadius: "10px",
                      border: "1px solid var(--line)",
                      background: isActive ? "var(--gold-soft)" : "color-mix(in srgb, var(--bg-soft) 55%, transparent)",
                      color: isActive ? "var(--gold)" : "var(--ink-2)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: menuForId === c.id ? 1 : 0,
                      pointerEvents: menuForId === c.id ? "auto" : "none",
                      transition: "opacity 120ms ease",
                      padding: 0,
                    }}
                  >
                    <span aria-hidden="true" style={{ display: "block", lineHeight: 1, fontSize: 18, transform: "translateY(-1px)" }}>
                      ⋯
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: "var(--ink-3)", fontSize: "13px", padding: "8px 6px", lineHeight: 1.5 }}>
            No chats yet.
            <br />
            Start a new one.
          </div>
        )}
      </div>

      {mounted && menuForId && menuAnchor && menuChat && menuPos
        ? createPortal(
            <div
              data-chat-floating-menu
              role="menu"
              aria-label="Chat options"
              ref={menuRef}
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: "220px",
                borderRadius: "14px",
                border: "1px solid var(--line)",
                background: "var(--bg-elev)",
                boxShadow: "var(--shadow-lg)",
                padding: "8px",
                zIndex: 999999,
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <MenuItem label="Share" onClick={() => openShareModal(menuChat)} />
              <MenuItem label="Rename" onClick={() => openRenameModal(menuChat)} />
              <MenuItem
                label={menuChat.pinned ? "Unpin chat" : "Pin chat"}
                onClick={() => onTogglePin(menuChat.id, Boolean(menuChat.pinned))}
              />
              <div style={{ height: "1px", background: "var(--line)", margin: "8px 0" }} />
              <MenuItem label="Delete" danger onClick={() => openDeleteModal(menuChat)} />
            </div>,
            document.body
          )
        : null}

      {shareChat ? (
        <Modal title={shareChat.title} onClose={() => setShareChat(null)} footer={null}>
          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>Share this chat</div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/chat?c=${encodeURIComponent(shareChat.id)}`}
                style={{
                  flex: 1,
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  padding: "12px 12px",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: "13px",
                }}
              />
              <button type="button" onClick={() => copyShareLink(shareChat.id)} style={secondaryButtonStyle}>
                Copy link
              </button>
            </div>
            <div style={{ display: "flex", gap: "18px", justifyContent: "center", paddingTop: "6px" }}>
              <ShareCircle
                label="X"
                onClick={() => {
                  const url = `${window.location.origin}/chat?c=${encodeURIComponent(shareChat.id)}`;
                  window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
                }}
              />
              <ShareCircle
                label="in"
                onClick={() => {
                  const url = `${window.location.origin}/chat?c=${encodeURIComponent(shareChat.id)}`;
                  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
                }}
              />
              <ShareCircle
                label="r"
                onClick={() => {
                  const url = `${window.location.origin}/chat?c=${encodeURIComponent(shareChat.id)}`;
                  window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
                }}
              />
            </div>
          </div>
        </Modal>
      ) : null}

      {renameChat ? (
        <Modal
          title="Rename chat"
          onClose={() => setRenameChat(null)}
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => setRenameChat(null)} style={secondaryButtonStyle}>
                Cancel
              </button>
              <button type="button" onClick={submitRename} style={primaryButtonStyle}>
                Save
              </button>
            </div>
          }
        >
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>Chat name</div>
            <input
              autoFocus
              value={renameChat.nextTitle}
              onChange={(e) => setRenameChat((c) => ({ ...c, nextTitle: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
              }}
              style={{
                width: "100%",
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                padding: "12px 12px",
                color: "var(--ink)",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
            />
          </div>
        </Modal>
      ) : null}

      {deleteChat ? (
        <Modal
          title="Delete chat?"
          onClose={() => setDeleteChat(null)}
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => setDeleteChat(null)} style={secondaryButtonStyle}>
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDelete}
                style={{
                  ...primaryButtonStyle,
                  background: "linear-gradient(135deg,#E45A5A,#B83C3C)",
                  color: "#fff",
                }}
              >
                Delete
              </button>
            </div>
          }
        >
          <div style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>
            This will delete <span style={{ fontWeight: 700, color: "var(--ink)" }}>{deleteChat.title}</span>.
            <div style={{ marginTop: "8px", color: "var(--ink-3)", fontSize: "13px" }}>This cannot be undone.</div>
          </div>
        </Modal>
      ) : null}

      {toast ? (
        <div
          style={{
            position: "fixed",
            left: "16px",
            bottom: "16px",
            width: "248px",
            background: "var(--bg-elev)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            borderRadius: "14px",
            padding: "10px 12px",
            fontSize: "13px",
            boxShadow: "var(--shadow-lg)",
            zIndex: 80,
          }}
        >
          {toast}
        </div>
      ) : null}

      <style>{`
        /* Mobile drawer */
        @media (max-width: 960px){
          .steady-chat-sidebar{
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            height: 100vh !important;
            z-index: 999999 !important;
            transform: translateX(-105%);
            transition: transform 180ms ease;
            box-shadow: var(--shadow-lg);
          }
          .steady-chat-sidebar.is-open{
            transform: translateX(0);
          }
        }

        [data-chat-menu-root]:hover .steady-chat-kebab{
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </aside>
  );
}

function MenuItem({ label, onClick, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        border: "1px solid transparent",
        background: "transparent",
        color: danger ? "#E45A5A" : "var(--ink)",
        borderRadius: "10px",
        padding: "10px 10px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: "14px",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = danger ? "rgba(228,90,90,0.08)" : "var(--bg-soft)";
        e.currentTarget.style.borderColor = danger ? "rgba(228,90,90,0.22)" : "var(--line)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      {label}
    </button>
  );
}

function Modal({ title, onClose, children, footer }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(560px, 94vw)",
          background: "var(--bg-elev)",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)" }}>{title}</div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "12px",
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--ink-2)",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "16px" }}>{children}</div>
        {footer ? <div style={{ padding: "14px 16px 16px", borderTop: "1px solid var(--line)" }}>{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

function ShareCircle({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "64px",
        height: "64px",
        borderRadius: "999px",
        border: "1px solid var(--line)",
        background: "transparent",
        color: "var(--ink)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontWeight: 700,
        fontSize: "18px",
      }}
    >
      {label}
    </button>
  );
}

const secondaryButtonStyle = {
  border: "1px solid var(--line-strong)",
  background: "transparent",
  color: "var(--ink)",
  borderRadius: "12px",
  padding: "12px 14px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "14px",
};

const primaryButtonStyle = {
  border: "none",
  background: "var(--gradient-gold)",
  color: "#1A1410",
  borderRadius: "12px",
  padding: "12px 14px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "14px",
  fontWeight: 700,
};

