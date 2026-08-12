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

/** Schedule follow-up after tool advice (chat does this automatically on save). */
export async function scheduleOutcome({ authToken, advice, userPrompt = "", source = "chat", conversationId = null }) {
  if (!BACKEND_URL) return null;
  const response = await fetch(getBackendUrl("/api/outcomes"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({ advice, userPrompt, source, conversationId }),
  });
  return parseResponse(response);
}

export async function fetchDueOutcomes({ authToken }) {
  const response = await fetch(getBackendUrl("/api/outcomes/due"), {
    headers: { ...withAuth(authToken) },
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function fetchPendingOutcomes({ authToken }) {
  const response = await fetch(getBackendUrl("/api/outcomes/pending"), {
    headers: { ...withAuth(authToken) },
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function respondToOutcome({ authToken, outcomeId, status, note = "" }) {
  const response = await fetch(getBackendUrl(`/api/outcomes/${encodeURIComponent(outcomeId)}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({ status, note }),
  });
  return parseResponse(response);
}

/** Local testing — make a pending checkup due now. */
export async function forceOutcomeDue({ authToken, outcomeId }) {
  const response = await fetch(getBackendUrl(`/api/outcomes/${encodeURIComponent(outcomeId)}/force-due`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuth(authToken),
    },
    body: JSON.stringify({}),
  });
  return parseResponse(response);
}

export function buildPartialFollowUpPrompt(outcome) {
  const advice = outcome?.adviceExcerpt || "the last plan Steady gave me";
  const ask = outcome?.userPromptExcerpt ? `Original problem: ${outcome.userPromptExcerpt}\n` : "";
  return `${ask}That advice only partly worked.

Advice was: "${advice}"

Here's what happened: [tell Steady what worked and what didn't]

Please adjust the plan with clearer steps for my team.`;
}
