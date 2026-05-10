const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function getBackendUrl(path) {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Request failed.");
  }
  return data;
}

function withAuth(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function startIntegrationOAuth({ provider, authToken }) {
  const response = await fetch(getBackendUrl(`/api/integrations/${encodeURIComponent(provider)}/authorize`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

export async function disconnectIntegration({ provider, authToken }) {
  const response = await fetch(getBackendUrl(`/api/integrations/${encodeURIComponent(provider)}/disconnect`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

export async function syncIntegrationNow({ provider, authToken }) {
  const response = await fetch(getBackendUrl(`/api/integrations/${encodeURIComponent(provider)}/sync-now`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

export async function fetchIntegrationsStatus({ authToken }) {
  const response = await fetch(getBackendUrl("/api/integrations/status"), {
    headers: {
      ...withAuth(authToken),
    },
    cache: "no-store",
  });
  return parseResponse(response);
}

/** Normalized business context + canonicalSummary for AI prompting. */
export async function fetchIntegrationContext({ authToken, days = 30 }) {
  const q = Number.isFinite(Number(days)) ? `?days=${encodeURIComponent(String(days))}` : "";
  const response = await fetch(getBackendUrl(`/api/integrations/context${q}`), {
    headers: {
      ...withAuth(authToken),
    },
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function fetchInsightsList({ authToken }) {
  const response = await fetch(getBackendUrl("/api/insights"), {
    headers: {
      ...withAuth(authToken),
    },
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function refreshInsightsComputation({ authToken }) {
  const response = await fetch(getBackendUrl("/api/insights/refresh"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

