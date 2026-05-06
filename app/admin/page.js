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
          <div key={user.id} className="admin-user-row">
            <div>
              <div style={{ color: "var(--ink)", fontSize: "15px" }}>{user.name || "Unnamed User"}</div>
              <div style={{ color: "var(--ink-3)", fontSize: "12px" }}>{user.email}</div>
            </div>
            <div className="admin-user-meta">{user.planName}</div>
            <div className="admin-user-meta">{user.questionsRemaining === null ? "Unlimited" : `${user.questionsRemaining} left`}</div>
            <div className="admin-user-meta">{user.subscriptionStatus}</div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
