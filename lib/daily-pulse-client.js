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

/** Local calendar YYYY-MM-DD for the owner's "today". */
export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchPulseToday({ authToken, dateKey = localDateKey() }) {
  const q = new URLSearchParams({ dateKey });
  const response = await fetch(getBackendUrl(`/api/daily-pulse/today?${q}`), {
    headers: { ...withAuth(authToken) },
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function logPulse({ authToken, level, dateKey = localDateKey() }) {
  const response = await fetch(getBackendUrl("/api/daily-pulse"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({ level, dateKey }),
  });
  return parseResponse(response);
}

export async function dismissPulsePattern({ authToken, dateKey = localDateKey() }) {
  const response = await fetch(getBackendUrl("/api/daily-pulse/dismiss-pattern"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({ dateKey }),
  });
  return parseResponse(response);
}

export async function fetchPulseHistory({ authToken, limit = 30 }) {
  const q = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(getBackendUrl(`/api/daily-pulse/history?${q}`), {
    headers: { ...withAuth(authToken) },
    cache: "no-store",
  });
  return parseResponse(response);
}

/** Local testing — seed prior weeks so a 3x weekday pattern can fire. */
export async function seedPulsePattern({ authToken, level = "slow", count = 2, dateKey = localDateKey() }) {
  const response = await fetch(getBackendUrl("/api/daily-pulse/seed-pattern"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({ level, count, dateKey }),
  });
  return parseResponse(response);
}
