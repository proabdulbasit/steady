const { verifyUserToken } = require("../lib/auth");

function getBearerToken(headerValue = "") {
  if (!headerValue.startsWith("Bearer ")) return "";
  return headerValue.slice(7).trim();
}

function optionalAuth(req, _res, next) {
  const token =
    getBearerToken(req.headers.authorization || "") ||
    (typeof req.headers["x-steady-auth-token"] === "string" ? req.headers["x-steady-auth-token"] : "");

  req.auth = null;
  if (!token) return next();

  try {
    req.auth = verifyUserToken(token);
  } catch {
    req.auth = null;
  }

  return next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.auth?.sub) {
      return res.status(401).json({ error: "Authentication required." });
    }
    return next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    return next();
  });
}

module.exports = {
  optionalAuth,
  requireAuth,
  requireAdmin,
};
