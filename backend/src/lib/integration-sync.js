/** Shared rules for background sync + DB queries (keep aligned with syncSquareForUser / syncQboForUser). */

function trimStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function squareIntegrationReady(entry) {
  if (!entry || entry.provider !== "square") return false;
  const access = trimStr(entry.oauth?.accessToken || "");
  const refresh = trimStr(entry.oauth?.refreshToken || "");
  return !!(access || refresh);
}

function quickbooksIntegrationReady(entry) {
  if (!entry || entry.provider !== "quickbooks") return false;
  const access = trimStr(entry.oauth?.accessToken || "");
  const refresh = trimStr(entry.oauth?.refreshToken || "");
  const realmId = trimStr(entry.realmId || "");
  return !!(realmId && (access || refresh));
}

module.exports = {
  quickbooksIntegrationReady,
  squareIntegrationReady,
  trimStr,
};
