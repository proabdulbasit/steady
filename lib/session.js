export const STEADY_SESSION_KEY = "steady_session_id";

export function createAnonymousSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `steady_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateSessionId() {
  if (typeof window === "undefined") return null;

  const existing = window.localStorage.getItem(STEADY_SESSION_KEY);
  if (existing) return existing;

  const nextValue = createAnonymousSessionId();
  window.localStorage.setItem(STEADY_SESSION_KEY, nextValue);
  return nextValue;
}
