const test = require("node:test");
const assert = require("node:assert/strict");
const {
  GroqClient,
  compactMessages,
  durationToMs,
  extractSearchSources,
  retryAfterMs,
} = require("../../src/lib/blog/groq");

test("large Groq prompts are compacted while preserving their beginning and end", () => {
  const content = `BEGIN-${"x".repeat(40000)}-END`;
  const [message] = compactMessages([{ role: "user", content }], 12000);

  assert.ok(message.content.length < content.length);
  assert.match(message.content, /^BEGIN-/);
  assert.match(message.content, /-END$/);
  assert.match(message.content, /Context shortened/);
});

test("Groq retry timing understands rate-limit headers and messages", () => {
  const response = {
    headers: new Headers({
      "retry-after": "1.5",
      "x-ratelimit-reset-tokens": "900ms",
    }),
  };
  assert.equal(durationToMs("2m"), 120000);
  assert.equal(retryAfterMs(response, "Please try again in 376ms"), 1500);
});

test("research uses Compound Mini and exposes raw search-result URLs", async () => {
  let requestBody;
  const client = new GroqClient({
    apiKey: "test-key",
    searchModel: "groq/compound-mini",
    maxRetries: 0,
    fetch: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          model: "groq/compound-mini",
          choices: [{
            message: {
              content: "Grounded research",
              executed_tools: [{
                search_results: {
                  results: [{
                    title: "Scheduling guidance",
                    url: "https://example.com/scheduling",
                  }],
                },
              }],
            },
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    },
  });

  const result = await client.research("Find a current small-business operations topic.");

  assert.equal(requestBody.model, "groq/compound-mini");
  assert.equal(requestBody.tools, undefined);
  assert.deepEqual(result.sources, [{
    title: "Scheduling guidance",
    url: "https://example.com/scheduling",
    publisher: "example.com",
  }]);
});

test("search-source extraction ignores duplicate and non-HTTPS results", () => {
  const body = {
    choices: [{
      message: {
        content: "See https://www.sba.gov/guide for official guidance.",
        executed_tools: [{
          search_results: [
            { title: "Primary", url: "https://example.com/source" },
            { title: "Duplicate", url: "https://example.com/source" },
            { title: "Unsafe", url: "http://example.com/source" },
          ],
        }],
      },
    }],
  };

  assert.deepEqual(extractSearchSources(body), [
    {
      title: "Primary",
      url: "https://example.com/source",
      publisher: "example.com",
    },
    {
      title: "www.sba.gov",
      url: "https://www.sba.gov/guide",
      publisher: "sba.gov",
    },
  ]);
});

test("browser-search JSON requests omit Groq's incompatible response format", async () => {
  let requestBody;
  const client = new GroqClient({
    apiKey: "test-key",
    researchModel: "openai/gpt-oss-20b",
    maxRetries: 0,
    fetch: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          model: "openai/gpt-oss-20b",
          choices: [{ message: { content: '{"opportunities":[]}' } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    },
  });

  const result = await client.json(
    [{ role: "user", content: "Research and return JSON." }],
    { research: true, webSearch: true }
  );

  assert.deepEqual(requestBody.tools, [{ type: "browser_search" }]);
  assert.equal(requestBody.response_format, undefined);
  assert.deepEqual(result.data, { opportunities: [] });
});

test("research falls back to GPT-OSS browser search after a 413", async () => {
  const models = [];
  const client = new GroqClient({
    apiKey: "test-key",
    searchModel: "groq/compound-mini",
    researchModel: "openai/gpt-oss-20b",
    maxRetries: 0,
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      models.push(body.model);
      if (body.model === "groq/compound-mini") {
        return new Response(
          JSON.stringify({ error: { message: "Request Entity Too Large" } }),
          { status: 413, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          model: body.model,
          choices: [{ message: { content: "Use https://www.irs.gov/" } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    },
  });

  const result = await client.research("Find official tax guidance.");
  assert.deepEqual(models, ["groq/compound-mini", "openai/gpt-oss-20b"]);
  assert.match(result.content, /irs\.gov/);
});

test("empty browser-search completions retry with a larger output budget", async () => {
  const requestBodies = [];
  const client = new GroqClient({
    apiKey: "test-key",
    researchModel: "openai/gpt-oss-20b",
    maxRetries: 0,
    fetch: async (_url, options) => {
      requestBodies.push(JSON.parse(options.body));
      const content =
        requestBodies.length === 1 ? "" : '{"opportunities":[]}';
      return new Response(
        JSON.stringify({
          model: "openai/gpt-oss-20b",
          choices: [{ finish_reason: "length", message: { content } }],
          usage: { completion_tokens: 2500 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    },
  });

  const result = await client.json(
    [{ role: "user", content: "Research and return JSON." }],
    { research: true, webSearch: true, maxTokens: 2500 }
  );

  assert.equal(requestBodies.length, 2);
  assert.equal(requestBodies[0].max_completion_tokens, 2500);
  assert.equal(requestBodies[1].max_completion_tokens, 4096);
  assert.deepEqual(result.data, { opportunities: [] });
});
