import { PageShell } from "../../components/steady-ui";

export default function TermsPage() {
  return (
    <PageShell eyebrow="Legal" title="Terms of Service" description="The rules for using Steady.">
      <article className="card legal-article" style={{ padding: 36, lineHeight: 1.75 }}>
        <Section title="Use of service">
          <p>By using Steady, you agree to use the service responsibly and not attempt to misuse, disrupt, or access other users&apos; data.</p>
        </Section>
        <Section title="Nature of advice">
          <p>Steady provides business guidance and suggestions. It is <strong>not</strong> legal, financial, or medical advice. You are responsible for decisions you make based on the information provided.</p>
        </Section>
        <Section title="Subscription & cancellation">
          <p>You may cancel or change your subscription using the plan tools provided. You can delete your account at any time from your Profile page.</p>
        </Section>
        <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 28 }}>
          This is a starter terms document for development. Replace with your lawyer-approved terms before production.
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
