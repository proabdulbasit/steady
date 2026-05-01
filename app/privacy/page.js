import { PageShell } from "../../components/steady-ui";

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Privacy Policy"
      description="How we collect, use, and protect your data."
    >
      <div style={{ background: "#15120E", border: "1px solid #252018", borderRadius: "18px", padding: "22px", color: "#D4C9B8", lineHeight: 1.75 }}>
        <p>
          We collect the minimum information needed to provide the Steady service: account details (email, password),
          subscription status, and the content you choose to submit in chats (including any attachments you upload).
        </p>
        <p>
          We use this information to run the app, improve reliability, enforce plan limits, and provide support. We do not
          sell your personal information.
        </p>
        <p>
          You can request deletion at any time from your Profile page. Deleting your account removes your user record and
          saved chats.
        </p>
        <p style={{ color: "#6A6058", fontSize: "13px" }}>
          This is a starter policy for development. Replace with your lawyer-approved policy before production.
        </p>
      </div>
    </PageShell>
  );
}

