const BusinessMetricDaily = require("../models/BusinessMetricDaily");

function getSquareApiBase() {
  return process.env.SQUARE_ENV === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}

async function squareFetch(path, accessToken) {
  const res = await fetch(`${getSquareApiBase()}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": process.env.SQUARE_API_VERSION || "2025-01-15",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.errors?.[0]?.detail || "Square request failed.");
    err.details = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

async function squarePost(path, accessToken, jsonBody) {
  const res = await fetch(`${getSquareApiBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": process.env.SQUARE_API_VERSION || "2025-01-15",
    },
    body: JSON.stringify(jsonBody),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.errors?.[0]?.detail || "Square request failed.");
    err.details = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

async function refreshSquareToken(refreshToken) {
  const clientId = process.env.SQUARE_CLIENT_ID || "";
  const clientSecret = process.env.SQUARE_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) throw new Error("Missing SQUARE_CLIENT_ID/SQUARE_CLIENT_SECRET.");
  const res = await fetch(`${getSquareApiBase()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || "Square token refresh failed.");
    err.details = data;
    throw err;
  }
  return data;
}

function isoDateKey(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

async function ensureAccessToken({ integration }) {
  integration.oauth = integration.oauth || {};
  const access = typeof integration.oauth.accessToken === "string" ? integration.oauth.accessToken.trim() : "";
  const refresh = typeof integration.oauth.refreshToken === "string" ? integration.oauth.refreshToken.trim() : "";

  if (!access && !refresh) {
    const err = new Error("Square is not connected.");
    err.status = 400;
    throw err;
  }

  const expiresAt = integration.oauth?.expiresAt ? new Date(integration.oauth.expiresAt) : null;
  const soon = new Date(Date.now() + 60 * 1000);
  const needsRefresh = !!refresh && (!access || (expiresAt && expiresAt < soon));

  if (needsRefresh) {
    const refreshed = await refreshSquareToken(refresh);
    integration.oauth.accessToken = String(refreshed.access_token || "");
    integration.oauth.refreshToken = String(refreshed.refresh_token || refresh || "");
    integration.oauth.tokenType = String(refreshed.token_type || integration.oauth.tokenType || "");
    integration.oauth.expiresAt = refreshed.expires_at ? new Date(refreshed.expires_at) : integration.oauth.expiresAt;
    integration.merchantId = String(refreshed.merchant_id || integration.merchantId || "");
  }

  const finalAccess = String(integration.oauth.accessToken || "").trim();
  if (!finalAccess) {
    const err = new Error("Square is not connected.");
    err.status = 400;
    throw err;
  }
  return finalAccess;
}

async function resolveMerchantId(integration, accessToken) {
  let mid = String(integration.merchantId || "").trim();
  if (mid) return mid;
  try {
    const data = await squareFetch("/v2/merchants", accessToken);
    const list = data?.merchant || data?.merchants;
    const first = Array.isArray(list) ? list[0] : list;
    mid = String(first?.id || "").trim();
  } catch {
    /* ignore */
  }
  if (mid) integration.merchantId = mid;
  return mid;
}

async function hydrateLocationsAndMerchant(integration, accessToken) {
  const mid = await resolveMerchantId(integration, accessToken);
  if (!mid) return;

  try {
    const me = await squareFetch(`/v2/merchants/${encodeURIComponent(mid)}`, accessToken);
    const merchant = me?.merchant || me;
    integration.meta = integration.meta || {};
    integration.meta.squareProfile = {
      businessName: String(merchant?.business_name || merchant?.businessName || ""),
      country: String(merchant?.country || ""),
      currency: String(merchant?.currency || ""),
      mainLocationId: String(merchant?.main_location_id || ""),
    };
  } catch {
    /* MERCHANT_PROFILE_READ may be missing in some tokens */
  }

  try {
    let cursor = "";
    const ids = [];
    while (true) {
      const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const data = await squareFetch(`/v2/locations${q}`, accessToken);
      const locs = Array.isArray(data?.locations) ? data.locations : [];
      for (const l of locs) {
        if (l?.id) ids.push(String(l.id));
      }
      cursor = String(data?.cursor || "");
      if (!cursor) break;
    }
    integration.locationIds = ids;
  } catch {
    integration.locationIds = Array.isArray(integration.locationIds) ? integration.locationIds : [];
  }
}

async function listAllPayments({ accessToken, beginTimeIso }) {
  let cursor = "";
  const out = [];
  while (true) {
    const qp = new URLSearchParams({ begin_time: beginTimeIso, limit: "100" });
    if (cursor) qp.set("cursor", cursor);
    const data = await squareFetch(`/v2/payments?${qp.toString()}`, accessToken);
    out.push(...(Array.isArray(data?.payments) ? data.payments : []));
    cursor = String(data?.cursor || "");
    if (!cursor) break;
  }
  return out;
}

async function listAllRefunds({ accessToken, beginTimeIso }) {
  let cursor = "";
  const out = [];
  while (true) {
    const qp = new URLSearchParams({ begin_time: beginTimeIso, limit: "100" });
    if (cursor) qp.set("cursor", cursor);
    const data = await squareFetch(`/v2/refunds?${qp.toString()}`, accessToken);
    out.push(...(Array.isArray(data?.refunds) ? data.refunds : []));
    cursor = String(data?.cursor || "");
    if (!cursor) break;
  }
  return out;
}

/** Best-effort order counts by day (requires ORDERS_READ). */
async function searchOrdersForCounts({ accessToken, beginTimeIso }) {
  const out = [];
  let cursor = "";
  const startAt = new Date(beginTimeIso).toISOString();
  while (true) {
    const body = {
      query: {
        filter: {
          date_time_filter: {
            created_at: { start_at: startAt },
          },
        },
      },
      limit: 100,
    };
    if (cursor) body.cursor = cursor;
    let data;
    try {
      data = await squarePost("/v2/orders/search", accessToken, body);
    } catch {
      break;
    }
    out.push(...(Array.isArray(data?.orders) ? data.orders : []));
    cursor = String(data?.cursor || "");
    if (!cursor) break;
  }
  return out;
}

function defaultDayRow() {
  return { grossCents: 0, refundCents: 0, paymentCount: 0, refundCount: 0, orderCount: 0 };
}

async function syncSquareForUser({ user, integration }) {
  const accessToken = await ensureAccessToken({ integration });
  await hydrateLocationsAndMerchant(integration, accessToken);

  const begin = integration.sync?.lastSyncedAt
    ? new Date(integration.sync.lastSyncedAt).toISOString()
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [payments, refunds, orders] = await Promise.all([
    listAllPayments({ accessToken, beginTimeIso: begin }),
    listAllRefunds({ accessToken, beginTimeIso: begin }),
    searchOrdersForCounts({ accessToken, beginTimeIso: begin }),
  ]);

  const byDay = new Map();

  for (const p of payments) {
    const dateKey = isoDateKey(p.created_at || "");
    const row = byDay.get(dateKey) || defaultDayRow();
    row.grossCents += Number(p?.amount_money?.amount || 0);
    row.paymentCount += 1;
    byDay.set(dateKey, row);
  }
  for (const r of refunds) {
    const dateKey = isoDateKey(r.created_at || "");
    const row = byDay.get(dateKey) || defaultDayRow();
    row.refundCents += Number(r?.amount_money?.amount || 0);
    row.refundCount += 1;
    byDay.set(dateKey, row);
  }
  for (const o of orders) {
    const dateKey = isoDateKey(o.created_at || o.closed_at || o.updated_at || "");
    const row = byDay.get(dateKey) || defaultDayRow();
    row.orderCount += 1;
    byDay.set(dateKey, row);
  }

  const ops = [];
  for (const [date, agg] of byDay.entries()) {
    const netCents = agg.grossCents - agg.refundCents;
    const avgTicketCents = agg.paymentCount ? Math.round(agg.grossCents / agg.paymentCount) : 0;
    ops.push(
      BusinessMetricDaily.updateOne(
        { userId: user._id, provider: "square", date },
        {
          $set: {
            metrics: {
              grossRevenueCents: agg.grossCents,
              refundCents: agg.refundCents,
              netRevenueCents: netCents,
              paymentCount: agg.paymentCount,
              refundCount: agg.refundCount,
              orderCount: agg.orderCount,
              avgTicketCents,
              currency: "USD",
            },
          },
        },
        { upsert: true }
      )
    );
  }
  if (ops.length) await Promise.all(ops);

  integration.sync = integration.sync || {};
  integration.sync.lastSyncedAt = new Date();
  integration.sync.lastSyncStatus = `ok (${payments.length} payments, ${refunds.length} refunds, ${orders.length} orders)`;

  await user.save();
  return {
    ok: true,
    payments: payments.length,
    refunds: refunds.length,
    orders: orders.length,
    merchantId: integration.merchantId || "",
    locationCount: integration.locationIds?.length || 0,
  };
}

module.exports = { syncSquareForUser };
