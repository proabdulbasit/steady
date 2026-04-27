"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "../../components/steady-ui";
import { useSteady } from "../../components/steady-provider";

export default function AdminPage() {
  const router = useRouter();
  const { profile, getAdminUsers, profileLoading } = useSteady();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!profileLoading && profile.role !== "admin") {
      router.push("/");
      return;
    }

    if (profile.role === "admin") {
      getAdminUsers().then(setUsers).catch(() => setUsers([]));
    }
  }, [profile.role, profileLoading, router, getAdminUsers]);

  if (profile.role !== "admin") return null;

  return (
    <PageShell eyebrow="Admin" title="Users, subscriptions, and limits" description="A simple operations view for the admin account.">
      <div style={{ display: "grid", gap: "10px" }}>
        {users.map((user) => (
          <div key={user.id} style={{ background: "#15120E", border: "1px solid #252018", borderRadius: "14px", padding: "16px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <div style={{ color: "#E8DFD0", fontSize: "15px" }}>{user.name || "Unnamed User"}</div>
              <div style={{ color: "#6A6058", fontSize: "12px" }}>{user.email}</div>
            </div>
            <div style={{ color: "#D4C9B8", fontSize: "13px" }}>{user.planName}</div>
            <div style={{ color: "#D4C9B8", fontSize: "13px" }}>{user.questionsRemaining === null ? "Unlimited" : `${user.questionsRemaining} left`}</div>
            <div style={{ color: "#D4C9B8", fontSize: "13px" }}>{user.subscriptionStatus}</div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
