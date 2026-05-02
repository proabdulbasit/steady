import { Suspense } from "react";
import ChatShell from "./shell";

function ChatShellFallback() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        aria-hidden="true"
        style={{
          width: "280px",
          flexShrink: 0,
          borderRight: "1px solid var(--line)",
          background: "var(--bg-elev)",
        }}
      />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: "14px" }}>
        Loading…
      </main>
    </div>
  );
}

export default function ChatLayout({ children }) {
  return (
    <Suspense fallback={<ChatShellFallback />}>
      <ChatShell>{children}</ChatShell>
    </Suspense>
  );
}

