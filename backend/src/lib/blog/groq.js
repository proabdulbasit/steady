const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonResponse(value) {
  if (value && typeof value === "object") return value;
  const text = String(value || "").trim();
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const firstObject = unfenced.indexOf("{");
    const firstArray = unfenced.indexOf("[");
    const starts = [firstObject, firstArray].filter((index) => index >= 0);
    if (!starts.length) throw new Error("Groq response did not contain JSON.");
    const start = Math.min(...starts);
    const end =
      unfenced[start] === "{"
        ? unfenced.lastIndexOf("}")
        : unfenced.lastIndexOf("]");
    if (end <= start) throw new Error("Groq response contained incomplete JSON.");
    return JSON.parse(unfenced.slice(start, end + 1));
  }
}

function compactMessages(messages, maxTotalChars = 24000) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const perMessage = Math.max(4000, Math.floor(maxTotalChars / Math.max(1, safeMessages.length)));
  return safeMessages.map((message) => {
    const content = String(message?.content || "");
    if (content.length <= perMessage) return message;
    const headLength = Math.floor(perMessage * 0.65);
    const tailLength = perMessage - headLength;
    return {
      ...message,
      content: `${content.slice(0, headLength)}

[Context shortened to fit the model request limit.]

${content.slice(-tailLength)}`,
    };
  });
}

class GroqClient {
  constructor(options = {}) {
    this.apiKey =
      options.apiKey ||
      (options.weekly ? process.env.GROQ_WEEKLY_API_KEY : "") ||
      process.env.GROQ_API_KEY;
    this.researchModel =
      options.researchModel || process.env.GROQ_RESEARCH_MODEL || "groq/compound";
    this.contentModel =
      options.contentModel || process.env.GROQ_CONTENT_MODEL || "openai/gpt-oss-120b";
    this.fallbackModel =
      options.fallbackModel || process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";
    this.fetch = options.fetch || global.fetch;
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 120000;
    if (!this.apiKey) throw new Error("Missing GROQ_API_KEY.");
    if (typeof this.fetch !== "function") throw new Error("Native fetch is unavailable.");
  }

  async chat(messages, options = {}) {
    const model =
      options.model ||
      (options.research ? this.researchModel : this.contentModel);
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.2,
            max_completion_tokens: options.maxTokens ?? 8000,
            ...(options.json ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: controller.signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(
            `Groq request failed (${response.status}): ${
              body.error?.message || response.statusText
            }`
          );
          error.status = response.status;
          throw error;
        }
        const content = body.choices?.[0]?.message?.content;
        if (!content) throw new Error("Groq returned an empty completion.");
        return {
          content,
          model: body.model || model,
          usage: body.usage || {},
          citations: body.citations || body.choices?.[0]?.message?.citations || [],
        };
      } catch (error) {
        lastError = error;
        if (error.status === 413 && !options.compactAttempt) {
          return this.chat(compactMessages(messages, 8000), {
            ...options,
            model,
            maxTokens: Math.min(
              options.maxTokens ?? 8000,
              options.research ? 1800 : 2600
            ),
            compactAttempt: true,
          });
        }
        const retryable =
          error.name === "AbortError" ||
          error.status === 408 ||
          error.status === 409 ||
          error.status === 429 ||
          error.status >= 500;
        if (!retryable || attempt === this.maxRetries) break;
        const jitter = Math.floor(Math.random() * 250);
        await sleep(750 * 2 ** attempt + jitter);
      } finally {
        clearTimeout(timer);
      }
    }
    if (
      !options.research &&
      !options.fallbackAttempt &&
      model !== this.fallbackModel
    ) {
      return this.chat(messages, {
        ...options,
        model: this.fallbackModel,
        fallbackAttempt: true,
      });
    }
    throw lastError;
  }

  async json(messages, options = {}) {
    const result = await this.chat(messages, { ...options, json: true });
    return { ...result, data: parseJsonResponse(result.content) };
  }

  async research(prompt) {
    return this.chat(
      [
        {
          role: "system",
          content:
            "Research current facts on the web. Cite reliable primary sources with direct HTTPS URLs. Distinguish evidence from inference and never invent search-volume metrics.",
        },
        { role: "user", content: prompt },
      ],
      { research: true, temperature: 0.1, maxTokens: 3500 }
    );
  }
}

module.exports = {
  GROQ_ENDPOINT,
  GroqClient,
  compactMessages,
  parseJsonResponse,
};
