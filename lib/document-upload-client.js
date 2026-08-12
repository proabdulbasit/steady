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

/** Check whether the current plan can use CSV / photo analysis. */
export async function fetchDocumentUploadCapabilities({ authToken }) {
  if (!BACKEND_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL.");
  }
  const response = await fetch(getBackendUrl("/api/document-upload/capabilities"), {
    headers: { ...withAuth(authToken) },
    cache: "no-store",
  });
  return parseResponse(response);
}

/**
 * Upload a CSV or photo and get Steady advice.
 * @param {{ authToken: string, file: File, note?: string }} opts
 */
export async function analyzeDocumentUpload({ authToken, file, note = "" }) {
  if (!BACKEND_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL.");
  }
  if (!file) {
    throw new Error("Choose a CSV or photo first.");
  }

  const form = new FormData();
  form.append("file", file);
  if (note && String(note).trim()) {
    form.append("note", String(note).trim());
  }

  const response = await fetch(getBackendUrl("/api/document-upload/analyze"), {
    method: "POST",
    headers: { ...withAuth(authToken) },
    body: form,
  });

  return parseResponse(response);
}
