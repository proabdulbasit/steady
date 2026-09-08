const test = require("node:test");
const assert = require("node:assert/strict");
const { serializePost } = require("../../src/lib/blog/serialize");

test("public serializer omits prompts and internal audit fields", () => {
  const serialized = serializePost({
    _id: "post-id",
    title: "Safe public post",
    slug: "safe-public-post",
    excerpt: "Excerpt",
    content: "Content",
    featuredImage: {
      url: "https://example.com/image.webp",
      alt: "Alt",
      provider: "private-provider",
      sourceId: "private-source-id",
      prompt: "private prompt",
      variants: [],
    },
    sourceReferences: [
      {
        title: "Public source",
        url: "https://www.sba.gov/example",
        publisher: "U.S. Small Business Administration",
      },
    ],
    validationReport: { errors: ["internal"] },
    previousSlugs: ["old-private-slug"],
    normalizedKeyword: "private keyword",
    contentHash: "private hash",
    createdBy: "automation",
  });
  const json = JSON.stringify(serialized);
  for (const secret of [
    "private prompt",
    "private-provider",
    "private-source-id",
    "validationReport",
    "old-private-slug",
    "private keyword",
    "private hash",
    "createdBy",
  ]) {
    assert.equal(json.includes(secret), false, secret);
  }
  assert.deepEqual(serialized.sourceReferences, [
    {
      title: "Public source",
      url: "https://www.sba.gov/example",
      publisher: "U.S. Small Business Administration",
      accessedAt: undefined,
    },
  ]);
});
