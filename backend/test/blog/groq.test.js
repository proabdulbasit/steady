const test = require("node:test");
const assert = require("node:assert/strict");
const {
  compactMessages,
  durationToMs,
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
