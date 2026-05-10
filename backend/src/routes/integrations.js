const express = require("express");
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");
const { getUserById, serializeUser, effectiveIntegrationStatus } = require("../lib/user-service");
const { syncSquareForUser } = require("../integrations/square");
const { syncQboForUser } = require("../integrations/quickbooks");
const { getBusinessContextForUser } = require("../lib/business-context");
const { deriveInsightsForUser } = require("../lib/insights");

const router = express.Router();

const PROVIDERS = new Set(["square", "quickbooks"]);

function getFrontendOrigin() {
  const raw = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "";
  return typeof raw === "string" ? raw.replace(/\/$/, "") : "";
}

function getBackendOrigin(req) {
  const raw = process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || "";
  if (typeof raw === "string" && raw.trim()) return raw.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]).split(",")[0] : req.protocol;
  const host = req.headers["x-forwarded-host"] ? String(req.headers["x-forwarded-host"]).split(",")[0] : req.get("host");
  return `${proto}://${host}`;
}

function getIntegration(user, provider) {
  const list = Array.isArray(user.integrations) ? user.integrations : [];
  const existing = list.find((x) => x.provider === provider);
  if (existing) return existing;
  const next = { provider, status: "disconnected" };
  user.integrations = [...list, next];
  return next;
}

function newState() {
  return crypto.randomBytes(18).toString("hex");
}

function assertProvider(provider) {
  const p = String(provider || "").trim();
  if (!PROVIDERS.has(p)) {
    const err = new Error("Unsupported provider.");
    err.status = 400;
    throw err;
  }
  return p;
}

function nowPlusMs(ms) {
  return new Date(Date.now() + ms);
}

function normalizeScopes(value) {
  if (Array.isArray(value)) return value.map((s) => String(s));
  if (typeof value === "string") return value.split(/[,\s]+/).filter(Boolean);
  return [];
}

router.get("/status", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  const providers = {};
  for (const p of PROVIDERS) {
    const entry = getIntegration(user, p);
    providers[p] = {
      status: effectiveIntegrationStatus(entry),
      connectedAt: entry.connectedAt || null,
      lastSyncedAt: entry.sync?.lastSyncedAt || null,
      lastSyncStatus: entry.sync?.lastSyncStatus || "",
    };
  }

  return res.json({ ok: true, providers });
});

router.post("/:provider/authorize", requireAuth, async (req, res) => {
  const provider = assertProvider(req.params.provider);
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  const frontend = getFrontendOrigin();
  if (!frontend) return res.status(500).json({ error: "Missing FRONTEND_URL." });

  const backendOrigin = getBackendOrigin(req);
  const entry = getIntegration(user, provider);
  const state = newState();
  entry.meta = entry.meta || {};
  entry.meta.oauthState = state;
  entry.meta.oauthStateExpiresAt = nowPlusMs(10 * 60 * 1000).toISOString();
  await user.save();

  if (provider === "square") {
    const clientId = process.env.SQUARE_CLIENT_ID || "";
    if (!clientId) return res.status(500).json({ error: "Missing SQUARE_CLIENT_ID." });
    const scope = (process.env.SQUARE_SCOPES || "PAYMENTS_READ ORDERS_READ MERCHANT_PROFILE_READ").trim();
    const redirectUri = process.env.SQUARE_REDIRECT_URL || `${backendOrigin}/api/integrations/square/callback`;
    const base =
      process.env.SQUARE_ENV === "production"
        ? "https://connect.squareup.com/oauth2/authorize"
        : "https://connect.squareupsandbox.com/oauth2/authorize";
    const qp = new URLSearchParams({
      client_id: clientId,
      scope,
      state,
      redirect_uri: redirectUri,
    });
    const url = `${base}?${qp.toString()}`;
    return res.json({ ok: true, url });
  }

  // quickbooks
  const clientId = process.env.QBO_CLIENT_ID || "";
  if (!clientId) return res.status(500).json({ error: "Missing QBO_CLIENT_ID." });
  const redirectUri = process.env.QBO_REDIRECT_URL || `${backendOrigin}/api/integrations/quickbooks/callback`;
  const scope = (process.env.QBO_SCOPES || "com.intuit.quickbooks.accounting").trim();
  const qp = new URLSearchParams({
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return res.json({ ok: true, url: `https://appcenter.intuit.com/connect/oauth2?${qp.toString()}` });
});

router.get("/square/callback", async (req, res) => {
  const code = typeof req.query?.code === "string" ? req.query.code : "";
  const state = typeof req.query?.state === "string" ? req.query.state : "";
  const error = typeof req.query?.error === "string" ? req.query.error : "";
  const frontend = getFrontendOrigin();
  if (!frontend) return res.status(500).send("Missing FRONTEND_URL.");

  if (error) return res.redirect(`${frontend}/profile?integrations=error&provider=square`);
  if (!code || !state) return res.redirect(`${frontend}/profile?integrations=error&provider=square`);

  try {
    const UserModel = require("../models/User");
    const userModel = await UserModel.findOne({ "integrations.provider": "square", "integrations.meta.oauthState": state });
    if (!userModel) return res.redirect(`${frontend}/profile?integrations=error&provider=square`);

    const entry = getIntegration(userModel, "square");
    const expiresAtState = entry.meta?.oauthStateExpiresAt ? new Date(entry.meta.oauthStateExpiresAt) : null;
    if (!expiresAtState || expiresAtState < new Date()) {
      return res.redirect(`${frontend}/profile?integrations=expired&provider=square`);
    }

    const backendOrigin = getBackendOrigin(req);
    const redirectUri = process.env.SQUARE_REDIRECT_URL || `${backendOrigin}/api/integrations/square/callback`;
    const base =
      process.env.SQUARE_ENV === "production"
        ? "https://connect.squareup.com/oauth2/token"
        : "https://connect.squareupsandbox.com/oauth2/token";
    const clientId = process.env.SQUARE_CLIENT_ID || "";
    const clientSecret = process.env.SQUARE_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) return res.redirect(`${frontend}/profile?integrations=error&provider=square`);

    const resp = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || data?.error || "OAuth failed.");
      return data;
    });

    entry.status = "connected";
    entry.connectedAt = new Date();
    entry.meta = entry.meta || {};
    entry.meta.oauthState = "";
    entry.meta.oauthStateExpiresAt = "";
    entry.oauth = entry.oauth || {};
    entry.oauth.accessToken = String(resp.access_token || "");
    entry.oauth.refreshToken = String(resp.refresh_token || "");
    entry.oauth.tokenType = String(resp.token_type || "");
    entry.oauth.scopes = normalizeScopes(resp?.scope || resp?.scopes || []);
    entry.oauth.expiresAt = resp.expires_at ? new Date(resp.expires_at) : null;
    entry.merchantId = String(resp.merchant_id || "");
    await userModel.save();

    return res.redirect(`${frontend}/profile?integrations=connected&provider=square`);
  } catch (err) {
    console.error("[integrations] square callback", err);
    return res.redirect(`${frontend}/profile?integrations=error&provider=square`);
  }
});

router.get("/quickbooks/callback", async (req, res) => {
  const code = typeof req.query?.code === "string" ? req.query.code : "";
  const state = typeof req.query?.state === "string" ? req.query.state : "";
  const realmId = typeof req.query?.realmId === "string" ? req.query.realmId : "";
  const error = typeof req.query?.error === "string" ? req.query.error : "";
  const frontend = getFrontendOrigin();
  if (!frontend) return res.status(500).send("Missing FRONTEND_URL.");

  if (error) return res.redirect(`${frontend}/profile?integrations=error&provider=quickbooks`);
  if (!code || !state) return res.redirect(`${frontend}/profile?integrations=error&provider=quickbooks`);

  try {
    const UserModel = require("../models/User");
    const userModel = await UserModel.findOne({ "integrations.provider": "quickbooks", "integrations.meta.oauthState": state });
    if (!userModel) return res.redirect(`${frontend}/profile?integrations=error&provider=quickbooks`);
    const entry = getIntegration(userModel, "quickbooks");
    const expiresAtState = entry.meta?.oauthStateExpiresAt ? new Date(entry.meta.oauthStateExpiresAt) : null;
    if (!expiresAtState || expiresAtState < new Date()) {
      return res.redirect(`${frontend}/profile?integrations=expired&provider=quickbooks`);
    }

    const backendOrigin = getBackendOrigin(req);
    const redirectUri = process.env.QBO_REDIRECT_URL || `${backendOrigin}/api/integrations/quickbooks/callback`;
    const clientId = process.env.QBO_CLIENT_ID || "";
    const clientSecret = process.env.QBO_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) return res.redirect(`${frontend}/profile?integrations=error&provider=quickbooks`);

    const tokenResp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error_description || data?.error || "OAuth failed.");
      return data;
    });

    entry.status = "connected";
    entry.connectedAt = new Date();
    entry.meta = entry.meta || {};
    entry.meta.oauthState = "";
    entry.meta.oauthStateExpiresAt = "";
    entry.oauth = entry.oauth || {};
    entry.oauth.accessToken = String(tokenResp.access_token || "");
    entry.oauth.refreshToken = String(tokenResp.refresh_token || "");
    entry.oauth.tokenType = String(tokenResp.token_type || "");
    entry.oauth.scopes = normalizeScopes(tokenResp?.scope || []);
    entry.oauth.expiresAt =
      typeof tokenResp.expires_in === "number" ? nowPlusMs(tokenResp.expires_in * 1000) : null;
    entry.realmId = realmId || entry.realmId || "";
    await userModel.save();

    return res.redirect(`${frontend}/profile?integrations=connected&provider=quickbooks`);
  } catch (err) {
    console.error("[integrations] quickbooks callback", err);
    return res.redirect(`${frontend}/profile?integrations=error&provider=quickbooks`);
  }
});

router.post("/:provider/disconnect", requireAuth, async (req, res) => {
  const provider = assertProvider(req.params.provider);
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  const entry = getIntegration(user, provider);
  entry.status = "disconnected";
  entry.connectedAt = null;
  entry.externalId = "";
  entry.merchantId = "";
  entry.realmId = "";
  entry.locationIds = [];
  entry.oauth = {
    accessToken: "",
    refreshToken: "",
    tokenType: "",
    scopes: [],
    expiresAt: null,
  };
  entry.sync = { lastSyncedAt: null, lastSyncStatus: "", cursor: "" };
  entry.meta = {};
  await user.save();

  return res.json({ ok: true, profile: serializeUser(user) });
});

router.post("/:provider/sync-now", requireAuth, async (req, res) => {
  const provider = assertProvider(req.params.provider);
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });

  const entry = getIntegration(user, provider);
  try {
    if (provider === "square") {
      const result = await syncSquareForUser({ user, integration: entry });
      deriveInsightsForUser(user._id).catch(() => null);
      return res.json({ ok: true, result });
    }
    const result = await syncQboForUser({ user, integration: entry });
    deriveInsightsForUser(user._id).catch(() => null);
    return res.json({ ok: true, result });
  } catch (e) {
    entry.sync = entry.sync || {};
    entry.sync.lastSyncedAt = new Date();
    entry.sync.lastSyncStatus = `error: ${e?.message || "sync failed"}`;
    await user.save();
    return res.status(e?.status || 500).json({ error: e?.message || "Sync failed." });
  }
});

router.get("/context", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  const days = typeof req.query?.days === "string" ? req.query.days : "30";
  const context = await getBusinessContextForUser(user, { days });
  return res.json({ ok: true, context });
});

module.exports = router;

