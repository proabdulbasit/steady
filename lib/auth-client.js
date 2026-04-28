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

function withAuthHeaders(token, extraHeaders = {}) {
  return token
    ? {
        ...extraHeaders,
        Authorization: `Bearer ${token}`,
      }
    : extraHeaders;
}

export async function registerUser({ name, email, password, sessionId, industry }) {
  const response = await fetch(getBackendUrl("/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, sessionId, industry }),
  });

  return parseResponse(response);
}

export async function loginUser({ email, password, sessionId }) {
  const response = await fetch(getBackendUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, sessionId }),
  });

  return parseResponse(response);
}

export async function fetchMe(token) {
  const response = await fetch(getBackendUrl("/api/auth/me"), {
    headers: withAuthHeaders(token),
    cache: "no-store",
  });

  return parseResponse(response);
}

export async function fetchProfile(token) {
  const response = await fetch(getBackendUrl("/api/profile/me"), {
    headers: withAuthHeaders(token),
    cache: "no-store",
  });

  return parseResponse(response);
}

export async function updateProfile(token, payload) {
  const response = await fetch(getBackendUrl("/api/profile/me"), {
    method: "PATCH",
    headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function fetchAdminUsers(token) {
  const response = await fetch(getBackendUrl("/api/profile/admin/users"), {
    headers: withAuthHeaders(token),
    cache: "no-store",
  });

  return parseResponse(response);
}
