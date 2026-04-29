const nodemailer = require("nodemailer");

function createTransport() {
  const user =
    typeof process.env.SMTP_USER === "string"
      ? process.env.SMTP_USER
      : process.env.EMAIL_USERNAME || "";

  let host =
    typeof process.env.SMTP_HOST === "string"
      ? process.env.SMTP_HOST
      : user && /@gmail\.com$/i.test(user)
        ? "smtp.gmail.com"
        : "";

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
  });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const transport = createTransport();
  const from =
    typeof process.env.SMTP_FROM === "string"
      ? process.env.SMTP_FROM
      : typeof process.env.EMAIL_FROM === "string"
        ? process.env.EMAIL_FROM
        : user
          ? `Steady <${user}>`
          : "Steady <noreply@localhost>";
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

  if (!transport) {
    console.warn("[steady-mail] SMTP not configured — password reset URL (paste in browser):\n", resetUrl);
    return false;
  }

  await transport.sendMail({ from, to, subject, text, html });
  return true;
}

module.exports = { sendPasswordResetEmail };
