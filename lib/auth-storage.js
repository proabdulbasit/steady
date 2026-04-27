export const STEADY_AUTH_TOKEN_KEY = "steady_auth_token";
export const STEADY_USER_KEY = "steady_user";

export function getStoredAuthToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STEADY_AUTH_TOKEN_KEY) || "";
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STEADY_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeAuthSession({ token, user }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STEADY_AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(STEADY_USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STEADY_AUTH_TOKEN_KEY);
  window.localStorage.removeItem(STEADY_USER_KEY);
}
