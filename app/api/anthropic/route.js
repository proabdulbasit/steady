import { getPrompt } from "../../../lib/industry-prompts";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "";

async function requestAnthropic(apiKey, body) {
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: { message: text || "Upstream returned non-JSON response." } };
  }

  return { upstream, json };
}

async function requestAnthropicStream(apiKey, body) {
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  return upstream;
}

async function authorizeAccess(sessionId, authToken = "", consume = false) {
  if (!BACKEND_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL or BACKEND_URL.");
  }

  const response = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/api/access/authorize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ sessionId, consume }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data,
    };
  }

  return {
    ok: true,
    status: response.status,
    data,
  };
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: { message: "Missing ANTHROPIC_API_KEY in .env.local" } },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: { message: "Invalid JSON body." } }, { status: 400 });
  }

  const sessionId = req.headers.get("x-steady-session-id");
  const authToken = req.headers.get("x-steady-auth-token") || "";
  if (!sessionId) {
    return Response.json({ error: { message: "Missing session id." } }, { status: 400 });
  }
  if (!authToken) {
    return Response.json({ error: { message: "Please sign in before chatting." } }, { status: 401 });
  }

  const access = await authorizeAccess(sessionId, authToken, false);
  if (!access.ok) {
    return Response.json(
      {
        error: {
          message: access.data?.error || "Access denied.",
          planId: access.data?.planId || "free",
          questionsRemaining: access.data?.questionsRemaining ?? 0,
          dailyLimit: access.data?.dailyLimit ?? 3,
          features: access.data?.features || {},
        },
      },
      { status: access.status }
    );
  }

  const requestedModel = typeof body.model === "string" ? body.model.trim() : "";
  const industry = access.data?.user?.industry || "restaurant";
  const industrySystem = getPrompt(industry);
  const extraSystem = typeof body.system === "string" ? body.system : "";
  const payload = {
    ...body,
    system: extraSystem ? `${industrySystem}\n\n${extraSystem}` : industrySystem,
    model: requestedModel || DEFAULT_MODEL,
  };

  const wantsStream = body?.stream === true;

  if (wantsStream) {
    let upstream = await requestAnthropicStream(apiKey, payload);

    if (upstream.status === 404 && payload.model !== DEFAULT_MODEL) {
      upstream = await requestAnthropicStream(apiKey, { ...payload, model: DEFAULT_MODEL });
    }

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: { message: text || "Upstream returned non-JSON response." } };
      }
      return Response.json(
        {
          ...json,
          steadyAccess: access.data,
        },
        { status: upstream.status }
      );
    }

    // Consume after we know upstream accepted the request.
    authorizeAccess(sessionId, authToken, true)
      .then((consumptionResult) => {
        if (consumptionResult.ok) access.data = consumptionResult.data;
      })
      .catch(() => null);

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  }

  let { upstream, json } = await requestAnthropic(apiKey, payload);

  if (
    upstream.status === 404 &&
    json?.error?.type === "not_found_error" &&
    payload.model !== DEFAULT_MODEL
  ) {
    ({ upstream, json } = await requestAnthropic(apiKey, {
      ...payload,
      model: DEFAULT_MODEL,
    }));
  }

  if (upstream.ok) {
    const consumptionResult = await authorizeAccess(sessionId, authToken, true);
    if (consumptionResult.ok) {
      access.data = consumptionResult.data;
    }
  }

  return Response.json(
    {
      ...json,
      steadyAccess: access.data,
    },
    { status: upstream.status }
  );
}
