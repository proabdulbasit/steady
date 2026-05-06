import { PageShell } from "../../components/steady-ui";

export default function PrivacyPage() {
  return (
    <PageShell eyebrow="Legal" title="Privacy Policy" description="How we collect, use, and protect your data.">
      <article className="card legal-article" style={{ padding: 36, lineHeight: 1.75 }}>
        <Section title="What we collect">
          <p>
            We collect the minimum information needed to provide the Steady service: your account details
            (email, password), subscription status, and the content you choose to submit in chats — including
            any attachments you upload.
          </p>
        </Section>
        <Section title="How we use it">
          <p>
            We use this information to operate Steady, improve reliability, enforce plan limits, and provide
            support. We do <strong>not</strong> sell your personal information.
          </p>
        </Section>
        <Section title="Your control">
          <p>
            You can request deletion at any time from your Profile page. Deleting your account removes your
            user record and saved chats.
          </p>
        </Section>
        <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 28 }}>
          This is a starter policy for development. Replace with your lawyer-approved policy before production.
        </p>
      </article>
    </PageShell>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2 className="serif" style={{ fontSize: 20, color: "var(--ink)", margin: "0 0 8px", fontWeight: 500 }}>{title}</h2>
      <div style={{ color: "var(--ink-2)" }}>{children}</div>
    </div>
  );
}
