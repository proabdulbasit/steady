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
          borderRight: "1px solid #1E1A15",
          background: "rgba(12,10,8,0.98)",
        }}
      />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6A6058", fontSize: "14px" }}>
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

