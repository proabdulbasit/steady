const nodemailer = require("nodemailer");

function getSmtpUserFromEnv() {
  return typeof process.env.SMTP_USER === "string"
    ? process.env.SMTP_USER.trim()
    : typeof process.env.EMAIL_USERNAME === "string"
      ? process.env.EMAIL_USERNAME.trim()
      : "";
}

/** From header: Mailgun prefers MAILGUN_FROM on a domain you verified there. */
function resolveFromAddress() {
  const from =
    (typeof process.env.MAILGUN_FROM === "string" && process.env.MAILGUN_FROM.trim()) ||
    (typeof process.env.SMTP_FROM === "string" && process.env.SMTP_FROM.trim()) ||
    (typeof process.env.EMAIL_FROM === "string" && process.env.EMAIL_FROM.trim()) ||
    "";
  const u = getSmtpUserFromEnv();
  if (from) return from;
  if (u) return `Steady <${u}>`;
  return "Steady <noreply@localhost>";
}

function createTransport() {
  const user = getSmtpUserFromEnv();
  let host = typeof process.env.SMTP_HOST === "string" ? process.env.SMTP_HOST.trim() : "";
  if (!host && user && /@gmail\.com$/i.test(user)) {
    host = "smtp.gmail.com";
  }
  if (!host) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true";
  const pass =
    typeof process.env.SMTP_PASS === "string"
      ? process.env.SMTP_PASS
      : process.env.EMAIL_PASS || "";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 12_000,
  });
}

async function sendViaMailgun({ to, subject, text, html, from }) {
  const apiKey = typeof process.env.MAILGUN_API_KEY === "string" ? process.env.MAILGUN_API_KEY.trim() : "";
  const domain = typeof process.env.MAILGUN_DOMAIN === "string" ? process.env.MAILGUN_DOMAIN.trim() : "";
  if (!apiKey || !domain) {
    return { ok: false, skipped: true };
  }

  const rawBase = process.env.MAILGUN_BASE_URL || "https://api.mailgun.net";
  const base = rawBase.replace(/\/$/, "");
  const endpoint = `${base}/v3/${encodeURIComponent(domain)}/messages`;
  const auth = Buffer.from(`api:${apiKey}`).toString("base64");

  const body = new URLSearchParams();
  body.set("from", from);
  body.set("to", to);
  body.set("subject", subject);
  body.set("text", text);
  body.set("html", html);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25_000);

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: body.toString(),
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `Mailgun HTTP ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.details = data;
    err.status = res.status;
    throw err;
  }
  // Correlate with Mailgun dashboard → Sending → Logs (delivery may still fail later).
  return { ok: true, messageId: typeof data?.id === "string" ? data.id : undefined };
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const from = resolveFromAddress();
  const subject = "Reset your Steady password";
  const text = `Someone requested a password reset for your Steady account.

Open this link to choose a new password (it expires in one hour):

${resetUrl}

If you did not request this, you can ignore this email.`;

  const html = `
    <p>Someone requested a password reset for your Steady account.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>If you did not request this, you can ignore this email.</p>
  `.trim();

  try {
    const mg = await sendViaMailgun({ to, subject, text, html, from });
    if (mg && mg.ok) {
      if (mg.messageId) {
        console.info("[steady-mail] Mailgun accepted password reset; message id:", mg.messageId);
      } else {
        console.info("[steady-mail] Mailgun accepted password reset (no id in response).");
      }
      return true;
    }
  } catch (e) {
    const key = typeof process.env.MAILGUN_API_KEY === "string" ? process.env.MAILGUN_API_KEY.trim() : "";
    const domain = typeof process.env.MAILGUN_DOMAIN === "string" ? process.env.MAILGUN_DOMAIN.trim() : "";
    if (key && domain) {
      const status = e?.status != null ? ` HTTP ${e.status}` : "";
      console.error("[steady-mail] Mailgun password reset failed" + status + ":", e?.message || e);
    }
  }

  const transport = createTransport();
  if (!transport) {
    console.warn("[steady-mail] No Mailgun (keys missing) and no SMTP host — reset URL (manual):\n", resetUrl);
    return false;
  }

  await transport.sendMail({ from, to, subject, text, html });
  return true;
}

function getFrontendOrigin() {
  const raw = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "";
  return typeof raw === "string" ? raw.replace(/\/$/, "") : "http://localhost:3000";
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendTransactionalEmail({ to, subject, text, html }) {
  const from = resolveFromAddress();
  try {
    const mg = await sendViaMailgun({ to, subject, text, html, from });
    if (mg && mg.ok) {
      if (mg.messageId) {
        console.info("[steady-mail] Mailgun accepted message id:", mg.messageId, "to:", to);
      }
      return { ok: true, provider: "mailgun", messageId: mg.messageId || "" };
    }
  } catch (e) {
    console.error("[steady-mail] Mailgun send failed:", e?.message || e, "to:", to);
    throw e;
  }

  const transport = createTransport();
  if (!transport) {
    throw new Error("No email provider configured (Mailgun or SMTP).");
  }
  const info = await transport.sendMail({ from, to, subject, text, html });
  return { ok: true, provider: "smtp", messageId: info?.messageId || "" };
}

/**
 * Daily briefing email — plain English summary + link to profile.
 */
async function sendDailyBriefingEmail({ to, ownerName, briefing, insights, profileUrl }) {
  const headline = briefing?.headline || "Your daily business briefing is ready";
  const sections = Array.isArray(briefing?.sections) ? briefing.sections : [];
  const url = profileUrl || `${getFrontendOrigin()}/profile`;

  const textParts = [
    `Hi ${ownerName || "there"},`,
    "",
    headline,
    "",
  ];
  for (const s of sections) {
    if (s.title) textParts.push(s.title);
    if (s.body) textParts.push(s.body);
    textParts.push("");
  }
  if (insights?.revenue?.headline) {
    textParts.push("Revenue insight:", insights.revenue.headline, insights.revenue.summary || "", "");
  }
  if (insights?.costs?.headline) {
    textParts.push("Costs insight:", insights.costs.headline, insights.costs.summary || "", "");
  }
  if (insights?.staffing?.headline) {
    textParts.push("Staffing insight:", insights.staffing.headline, insights.staffing.summary || "", "");
  }
  textParts.push(`View full briefing: ${url}`, "", "— Steady");

  const sectionHtml = sections
    .map(
      (s) =>
        `<h3 style="margin:16px 0 6px;font-size:16px;color:#1a1a1a;">${escapeHtml(s.title)}</h3><p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#444;">${escapeHtml(s.body).replace(/\n/g, "<br>")}</p>`
    )
    .join("");

  const pillarHtml = ["revenue", "costs", "staffing"]
    .map((key) => {
      const p = insights?.[key];
      if (!p?.headline) return "";
      return `<p style="margin:8px 0;font-size:14px;color:#444;"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(p.headline)}</p>`;
    })
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <p style="font-size:14px;color:#666;">Hi ${escapeHtml(ownerName || "there")},</p>
      <h2 style="font-size:22px;color:#1a1a1a;margin:12px 0;">${escapeHtml(headline)}</h2>
      ${sectionHtml}
      ${pillarHtml ? `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;" /><p style="font-size:13px;color:#888;">Quick insights</p>${pillarHtml}` : ""}
      <p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#c9a227;color:#1a1a1a;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;">Open in Steady</a></p>
    </div>
  `.trim();

  return sendTransactionalEmail({
    to,
    subject: `Steady daily briefing — ${headline.slice(0, 60)}`,
    text: textParts.join("\n"),
    html,
  });
}

/** Simple test message — verifies Mailgun/SMTP only (no briefing data required). */
async function sendMailgunConnectivityTestEmail({ to, ownerName }) {
  const url = `${getFrontendOrigin()}/profile`;
  const subject = "Steady — test email (Mailgun)";
  const text = `Hi ${ownerName || "there"},

This is a test email from Steady. If you received this, Mailgun delivery is working.

Open your dashboard: ${url}

— Steady`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;padding:24px;">
      <p>Hi ${escapeHtml(ownerName || "there")},</p>
      <p><strong>This is a test email from Steady.</strong> If you see this, Mailgun delivery is working.</p>
      <p><a href="${escapeHtml(url)}">Open your profile</a></p>
    </div>
  `.trim();

  return sendTransactionalEmail({ to, subject, text, html });
}

module.exports = {
  sendPasswordResetEmail,
  sendDailyBriefingEmail,
  sendMailgunConnectivityTestEmail,
  sendTransactionalEmail,
  resolveFromAddress,
};
