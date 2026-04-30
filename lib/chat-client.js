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

export async function listConversations(token) {
  const response = await fetch(getBackendUrl("/api/conversations"), {
    headers: withAuthHeaders(token),
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function createConversation(token, { title = "", firstMessage = "" } = {}) {
  const response = await fetch(getBackendUrl("/api/conversations"), {
    method: "POST",
    headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ title, firstMessage }),
  });
  return parseResponse(response);
}

export async function fetchConversation(token, id) {
  const response = await fetch(getBackendUrl(`/api/conversations/${encodeURIComponent(id)}`), {
    headers: withAuthHeaders(token),
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function appendConversationMessages(token, id, messages) {
  const response = await fetch(getBackendUrl(`/api/conversations/${encodeURIComponent(id)}/messages`), {
    method: "POST",
    headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ messages }),
  });
  return parseResponse(response);
}

export async function updateConversation(token, id, payload) {
  const response = await fetch(getBackendUrl(`/api/conversations/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload || {}),
  });
  return parseResponse(response);
}

export async function deleteConversation(token, id) {
  const response = await fetch(getBackendUrl(`/api/conversations/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: withAuthHeaders(token),
  });
  return parseResponse(response);
}

