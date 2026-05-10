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
    throw err;
  }
  return { ok: true };
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
    if (mg && mg.ok) return true;
  } catch (e) {
    const key = typeof process.env.MAILGUN_API_KEY === "string" ? process.env.MAILGUN_API_KEY.trim() : "";
    const domain = typeof process.env.MAILGUN_DOMAIN === "string" ? process.env.MAILGUN_DOMAIN.trim() : "";
    if (key && domain) {
      console.error("[steady-mail] Mailgun password reset failed:", e?.message || e);
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

module.exports = { sendPasswordResetEmail };
