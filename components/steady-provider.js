"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  changePassword as changePasswordRequest,
  fetchAdminUsers,
  fetchMe,
  fetchProfile,
  loginUser,
  registerUser,
  resetPassword as resetPasswordRequest,
  requestForgotPassword,
  updateProfile,
} from "../lib/auth-client";
import { clearAuthSession, getStoredAuthToken, getStoredUser, storeAuthSession } from "../lib/auth-storage";
import { changePlan, createPortalSession, fetchSubscriptionStatus, redirectToCheckout, syncCheckoutSession } from "../lib/billing-client";
import { PLAN_IDS } from "../lib/plans";
import { getOrCreateSessionId } from "../lib/session";

const FREE_LIMIT = 3;

const EMPTY_PROFILE = {
  id: "",
  name: "",
  email: "",
  role: "guest",
  industry: "restaurant",
  planId: PLAN_IDS.FREE,
  planName: "Free",
  planSelected: false,
  subscriptionStatus: "inactive",
  currentPeriodEnd: null,
  questionsUsed: 0,
  questionsRemaining: FREE_LIMIT,
  dailyQuestionLimit: FREE_LIMIT,
  features: {
    premiumTools: false,
    dataIntegrations: false,
    prioritySupport: false,
  },
  integrations: [],
  hasActiveSubscription: false,
};

const SteadyContext = createContext(null);

async function callSteadyApi({ sessionId, authToken, system, messages, max_tokens }) {
  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-steady-session-id": sessionId,
      ...(authToken ? { "x-steady-auth-token": authToken } : {}),
    },
    body: JSON.stringify({ system, messages, max_tokens }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error?.message || data?.message || "Request failed.");
    error.details = data?.error || {};
    throw error;
  }
  return data;
}

async function callSteadyApiStream({ sessionId, authToken, system, messages, max_tokens, onText }) {
  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-steady-session-id": sessionId,
      ...(authToken ? { "x-steady-auth-token": authToken } : {}),
    },
    body: JSON.stringify({ system, messages, max_tokens, stream: true }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data?.error?.message || data?.message || "Request failed.");
    error.details = data?.error || {};
    throw error;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Streaming not supported by the browser.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  function handleEventData(json) {
    if (!json || typeof json !== "object") return;
    // Anthropic SSE events: content_block_delta with text_delta
    if (json.type === "content_block_delta" && json.delta?.type === "text_delta" && typeof json.delta?.text === "string") {
      const delta = json.delta.text;
      fullText += delta;
      onText?.(delta, fullText);
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newlines.
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = rawEvent.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          handleEventData(JSON.parse(payload));
        } catch {
          // ignore malformed data
        }
      }
    }
  }

  return {
    content: [{ text: fullText }],
  };
}

export function SteadyProvider({ children }) {
  const [sessionId, setSessionId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");

  useEffect(() => {
    const nextSessionId = getOrCreateSessionId();
    const token = getStoredAuthToken();
    const storedUser = getStoredUser();

    setSessionId(nextSessionId || "");
    setAuthToken(token);
    if (storedUser) {
      setProfile({ ...EMPTY_PROFILE, ...storedUser });
    }

    if (!nextSessionId) {
      setProfileLoading(false);
      return;
    }

    refreshProfile(nextSessionId, token).catch(() => null);
  }, []);

  async function refreshProfile(activeSessionId = sessionId, token = authToken) {
    if (!activeSessionId) return;

    setProfileLoading(true);
    try {
      if (token) {
        const [{ user }, { profile: nextProfile }] = await Promise.all([fetchMe(token), fetchProfile(token)]);
        const merged = { ...EMPTY_PROFILE, ...(nextProfile || user || EMPTY_PROFILE) };
        setProfile(merged);
        storeAuthSession({ token, user: merged });
      } else {
        try {
          const guestStatus = await fetchSubscriptionStatus(activeSessionId);
          setProfile({ ...EMPTY_PROFILE, ...guestStatus });
        } catch {
          // Backend may be offline during local frontend dev.
          // Keep guest defaults instead of crashing the app.
          setProfile({ ...EMPTY_PROFILE, sessionId: activeSessionId });
        }
      }
      setBillingError("");
    } finally {
      setProfileLoading(false);
    }
  }

  function syncProfile(nextProfile, token = authToken) {
    const merged = { ...EMPTY_PROFILE, ...nextProfile };
    setProfile(merged);
    if (token && merged.id) {
      storeAuthSession({ token, user: merged });
    }
  }

  async function login(form) {
    const result = await loginUser({ ...form, sessionId });
    setAuthToken(result.token);
    syncProfile(result.user, result.token);
    return result;
  }

  async function register(form) {
    const result = await registerUser({ ...form, sessionId });
    setAuthToken(result.token);
    syncProfile(result.user, result.token);
    return result;
  }

  async function forgotPassword(email) {
    return requestForgotPassword(email);
  }

  async function completePasswordReset(payload) {
    const result = await resetPasswordRequest({ ...payload, sessionId });
    setAuthToken(result.token);
    syncProfile(result.user, result.token);
    return result;
  }

  async function changePassword(form) {
    return changePasswordRequest(authToken, form);
  }

  async function saveProfile(payload) {
    const result = await updateProfile(authToken, payload);
    syncProfile(result.profile);
    return result.profile;
  }

  function logout() {
    clearAuthSession();
    setAuthToken("");
    setProfile(EMPTY_PROFILE);
  }

  async function choosePlan(planId) {
    if (!sessionId) throw new Error("Missing session.");
    if (!authToken) throw new Error("Please sign in before purchasing a subscription.");

    setBillingLoading(true);
    setBillingError("");
    try {
      if (profile.planId === planId && profile.planId !== PLAN_IDS.FREE) {
        const portal = await createPortalSession({ sessionId, authToken });
        window.location.href = portal.url;
        return;
      }

      await redirectToCheckout(planId, sessionId, authToken);
    } catch (error) {
      setBillingError(error.message || "Unable to start checkout.");
      throw error;
    } finally {
      setBillingLoading(false);
    }
  }

  async function updatePlan(planId) {
    if (!authToken) throw new Error("Please sign in first.");
    setBillingLoading(true);
    setBillingError("");
    try {
      const result = await changePlan(planId, authToken);
      if (result?.profile) {
        syncProfile(result.profile, authToken);
      }
      return result?.profile || null;
    } catch (error) {
      setBillingError(error.message || "Unable to update plan.");
      throw error;
    } finally {
      setBillingLoading(false);
    }
  }

  async function syncCheckout(checkoutSessionId) {
    if (!authToken) return null;
    const result = await syncCheckoutSession(checkoutSessionId, authToken);
    if (result?.profile) {
      syncProfile(result.profile, authToken);
    }
    return result?.profile || null;
  }

  async function runAssistantRequest({ system, prompt, messages, maxTokens = 2000 }) {
    const data = await callSteadyApi({
      sessionId,
      authToken,
      system,
      messages: messages || [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
    });

    if (data?.steadyAccess?.user) {
      syncProfile(data.steadyAccess.user);
    } else if (data?.steadyAccess?.planId) {
      setProfile((current) => ({
        ...current,
        planId: data.steadyAccess.planId || current.planId,
        planName: data.steadyAccess.planName || current.planName,
        questionsUsed: data.steadyAccess.questionsUsed ?? current.questionsUsed,
        questionsRemaining: data.steadyAccess.questionsRemaining ?? current.questionsRemaining,
        dailyQuestionLimit: data.steadyAccess.dailyLimit ?? current.dailyQuestionLimit,
        features: data.steadyAccess.features || current.features,
      }));
    }

    return data;
  }

  async function runAssistantRequestStream({ system, prompt, messages, maxTokens = 2000, onText }) {
    // For streaming we prioritize UX; steadyAccess profile sync will update on next refresh.
    const data = await callSteadyApiStream({
      sessionId,
      authToken,
      system,
      messages: messages || [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      onText,
    });

    return data;
  }

  async function getAdminUsers() {
    const result = await fetchAdminUsers(authToken);
    return result.users || [];
  }

  const value = useMemo(
    () => ({
      sessionId,
      authToken,
      profile,
      profileLoading,
      billingLoading,
      billingError,
      isAuthenticated: Boolean(authToken && profile.id),
      isPremium: profile.planId !== PLAN_IDS.FREE,
      isBusiness: profile.planId === PLAN_IDS.BUSINESS,
      remainingQuestions: profile.questionsRemaining === null ? null : (profile.questionsRemaining ?? FREE_LIMIT),
      login,
      register,
      forgotPassword,
      completePasswordReset,
      changePassword,
      logout,
      saveProfile,
      refreshProfile,
      choosePlan,
      updatePlan,
      runAssistantRequest,
      runAssistantRequestStream,
      getAdminUsers,
      clearBillingError: () => setBillingError(""),
      syncCheckout,
    }),
    [sessionId, authToken, profile, profileLoading, billingLoading, billingError]
  );

  return <SteadyContext.Provider value={value}>{children}</SteadyContext.Provider>;
}

export function useSteady() {
  const context = useContext(SteadyContext);
  if (!context) {
    throw new Error("useSteady must be used inside SteadyProvider.");
  }
  return context;
}
