const QboReportSnapshot = require("../models/QboReportSnapshot");
const BusinessMetricDaily = require("../models/BusinessMetricDaily");

async function refreshQboToken(refreshToken) {
  const clientId = process.env.QBO_CLIENT_ID || "";
  const clientSecret = process.env.QBO_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) throw new Error("Missing QBO_CLIENT_ID/QBO_CLIENT_SECRET.");
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error_description || data?.error || "QuickBooks token refresh failed.");
    err.details = data;
    throw err;
  }
  return data;
}

async function qboFetch({ realmId, accessToken, path }) {
  const base = "https://quickbooks.api.intuit.com";
  const url = `${base}/v3/company/${encodeURIComponent(realmId)}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.Fault?.Error?.[0]?.Message || "QuickBooks request failed.");
    err.details = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function findSummaryValue(report, label) {
  const stack = Array.isArray(report?.Rows?.Row) ? [...report.Rows.Row] : [];
  while (stack.length) {
    const row = stack.shift();
    if (!row) continue;
    if (Array.isArray(row.Row)) {
      stack.push(...row.Row);
      continue;
    }
    const name = row?.Summary?.ColData?.[0]?.value || row?.ColData?.[0]?.value || "";
    if (String(name).trim().toLowerCase() === String(label).trim().toLowerCase()) {
      const val = row?.Summary?.ColData?.[1]?.value || row?.ColData?.[1]?.value || "";
      const n = Number(String(val).replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

async function syncQboForUser({ user, integration }) {
  const realmId = typeof integration?.realmId === "string" ? integration.realmId.trim() : "";
  if (!realmId) {
    const err = new Error("QuickBooks is not connected.");
    err.status = 400;
    throw err;
  }

  integration.oauth = integration.oauth || {};
  const access = typeof integration.oauth.accessToken === "string" ? integration.oauth.accessToken.trim() : "";
  const refresh = typeof integration.oauth.refreshToken === "string" ? integration.oauth.refreshToken.trim() : "";

  if (!access && !refresh) {
    const err = new Error("QuickBooks is not connected.");
    err.status = 400;
    throw err;
  }

  const expiresAt = integration.oauth?.expiresAt ? new Date(integration.oauth.expiresAt) : null;
  const soon = new Date(Date.now() + 60 * 1000);
  const needsRefresh = !!refresh && (!access || (expiresAt && expiresAt < soon));

  if (needsRefresh) {
    const refreshed = await refreshQboToken(refresh);
    integration.oauth.accessToken = String(refreshed.access_token || "");
    integration.oauth.refreshToken = String(refreshed.refresh_token || refresh || "");
    integration.oauth.tokenType = String(refreshed.token_type || integration.oauth.tokenType || "");
    integration.oauth.scopes =
      typeof refreshed.scope === "string" ? refreshed.scope.split(" ") : integration.oauth.scopes || [];
    integration.oauth.expiresAt =
      typeof refreshed.expires_in === "number" ? new Date(Date.now() + refreshed.expires_in * 1000) : integration.oauth.expiresAt;
  }

  const accessToken = String(integration.oauth.accessToken || "").trim();
  if (!accessToken) {
    const err = new Error("QuickBooks is not connected.");
    err.status = 400;
    throw err;
  }

  const end = new Date();
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const startDate = fmtDate(start);
  const endDate = fmtDate(end);

  const pl = await qboFetch({
    realmId,
    accessToken,
    path: `/reports/ProfitAndLoss?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&minorversion=70`,
  });
  const bs = await qboFetch({
    realmId,
    accessToken,
    path: `/reports/BalanceSheet?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&minorversion=70`,
  });

  const plNetIncome = findSummaryValue(pl, "Net Income");
  const plTotalIncome = findSummaryValue(pl, "Total Income");
  const plTotalExpenses = findSummaryValue(pl, "Total Expenses");
  const plGrossProfit = findSummaryValue(pl, "Gross Profit");

  const extracted = {
    startDate,
    endDate,
    profitAndLoss: {
      totalIncome: plTotalIncome,
      totalExpenses: plTotalExpenses,
      grossProfit: plGrossProfit,
      netIncome: plNetIncome,
    },
  };

  integration.meta = integration.meta || {};
  integration.meta.qboFinancialsSummary = extracted;

  await QboReportSnapshot.updateOne(
    { userId: user._id, reportType: "ProfitAndLoss", startDate, endDate },
    { $set: { realmId, raw: pl, extracted } },
    { upsert: true }
  );
  await QboReportSnapshot.updateOne(
    { userId: user._id, reportType: "BalanceSheet", startDate, endDate },
    { $set: { realmId, raw: bs, extracted: { startDate, endDate } } },
    { upsert: true }
  );

  await BusinessMetricDaily.updateOne(
    { userId: user._id, provider: "quickbooks", date: endDate },
    {
      $set: {
        metrics: {
          periodStart: startDate,
          periodEnd: endDate,
          totalIncome: plTotalIncome,
          totalExpenses: plTotalExpenses,
          grossProfit: plGrossProfit,
          netIncome: plNetIncome,
          currency: "USD",
        },
      },
    },
    { upsert: true }
  );

  integration.sync = integration.sync || {};
  integration.sync.lastSyncedAt = new Date();
  integration.sync.lastSyncStatus = "ok (reports)";
  integration.sync.cursor = "";
  await user.save();

  return { ok: true };
}

module.exports = { syncQboForUser };
