import { PageShell } from "../../components/steady-ui";

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Terms of Service"
      description="The rules for using Steady."
    >
      <div style={{ background: "#15120E", border: "1px solid #252018", borderRadius: "18px", padding: "22px", color: "#D4C9B8", lineHeight: 1.75 }}>
        <p>
          By using Steady, you agree to use the service responsibly and not attempt to misuse, disrupt, or access other
          users’ data.
        </p>
        <p>
          Steady provides business guidance and suggestions. It is not legal, financial, or medical advice. You are
          responsible for decisions you make based on the information provided.
        </p>
        <p>
          You may cancel or change your subscription according to the plan tools provided. You can delete your account at
          any time from your Profile page.
        </p>
        <p style={{ color: "#6A6058", fontSize: "13px" }}>
          This is a starter terms document for development. Replace with your lawyer-approved terms before production.
        </p>
      </div>
    </PageShell>
  );
}

