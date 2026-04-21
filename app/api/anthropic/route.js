const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

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

  const requestedModel = typeof body.model === "string" ? body.model.trim() : "";
  const payload = {
    ...body,
    model: requestedModel || DEFAULT_MODEL,
  };

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

  return Response.json(json, { status: upstream.status });
}
