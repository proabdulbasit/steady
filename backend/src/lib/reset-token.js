const crypto = require("crypto");

function getExpiryMs() {
  const ms = Number(process.env.PASSWORD_RESET_EXPIRES_MS);
  return Number.isFinite(ms) && ms > 0 ? ms : 60 * 60 * 1000;
}

function generateRawResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashResetToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function timingSafeEqualHexHex(aHex, bHex) {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length || a.length === 0) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = {
  getExpiryMs,
  generateRawResetToken,
  hashResetToken,
  timingSafeEqualHexHex,
};
