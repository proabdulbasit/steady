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

export async function fetchBriefingProcessingStatus({ authToken }) {
  const response = await fetch(getBackendUrl("/api/briefing/processing/status"), {
    headers: { ...withAuth(authToken) },
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function runBriefingProcessingNow({ authToken }) {
  const response = await fetch(getBackendUrl("/api/briefing/processing/run-now"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

export async function fetchLatestBriefingSummary({ authToken }) {
  const response = await fetch(getBackendUrl("/api/briefing/summary/latest"), {
    headers: { ...withAuth(authToken) },
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function generateBriefingSummary({ authToken, force = false }) {
  const response = await fetch(getBackendUrl("/api/briefing/summary/generate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({ force }),
  });
  return parseResponse(response);
}

export async function fetchBusinessInsightsDashboard({ authToken }) {
  const response = await fetch(getBackendUrl("/api/briefing/insights/latest"), {
    headers: { ...withAuth(authToken) },
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function refreshBusinessInsightsDashboard({ authToken }) {
  const response = await fetch(getBackendUrl("/api/briefing/insights/refresh"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

export async function fetchBriefingDeliveryStatus({ authToken }) {
  const response = await fetch(getBackendUrl("/api/briefing/delivery/status"), {
    headers: { ...withAuth(authToken) },
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function updateBriefingDeliveryPreferences({ authToken, emailEnabled, pushEnabled }) {
  const response = await fetch(getBackendUrl("/api/briefing/delivery/preferences"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({ emailEnabled, pushEnabled }),
  });
  return parseResponse(response);
}

export async function sendMailgunTestEmail({ authToken }) {
  const response = await fetch(getBackendUrl("/api/briefing/delivery/test-email"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

export async function sendBriefingDeliveryNow({ authToken, force = false }) {
  const response = await fetch(getBackendUrl("/api/briefing/delivery/send-now"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({ force }),
  });
  return parseResponse(response);
}

export async function fetchBriefingNotifications({ authToken }) {
  const response = await fetch(getBackendUrl("/api/briefing/notifications"), {
    headers: { ...withAuth(authToken) },
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function markBriefingNotificationRead({ authToken, id }) {
  const response = await fetch(getBackendUrl(`/api/briefing/notifications/${encodeURIComponent(id)}/read`), {
    method: "POST",
    headers: { ...withAuth(authToken) },
  });
  return parseResponse(response);
}

export async function subscribeBriefingPush({ authToken, subscription }) {
  const response = await fetch(getBackendUrl("/api/briefing/notifications/push-subscribe"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({ subscription }),
  });
  return parseResponse(response);
}

export async function unsubscribeBriefingPush({ authToken, endpoint = "" }) {
  const response = await fetch(getBackendUrl("/api/briefing/notifications/push-subscribe"), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({ endpoint }),
  });
  return parseResponse(response);
}
