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

/**
 * Rewrite Steady advice into plain staff language.
 * @param {{ authToken: string, advice: string }} opts
 */
export async function explainToMyTeam({ authToken, advice }) {
  if (!BACKEND_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL.");
  }
  const response = await fetch(getBackendUrl("/api/explain-to-team"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ advice }),
  });
  return parseResponse(response);
}
