const test = require("node:test");
const assert = require("node:assert/strict");
const { compactMessages } = require("../../src/lib/blog/groq");

test("large Groq prompts are compacted while preserving their beginning and end", () => {
  const content = `BEGIN-${"x".repeat(40000)}-END`;
  const [message] = compactMessages([{ role: "user", content }], 12000);

  assert.ok(message.content.length < content.length);
  assert.match(message.content, /^BEGIN-/);
  assert.match(message.content, /-END$/);
  assert.match(message.content, /Context shortened/);
});
