const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isAllowedInternalUrl,
  validateReachableSources,
  validateQuality,
} = require("../../src/lib/blog/quality");
const {
  buildGenerationPrompt,
  ensureSourceCitations,
  normalizeEditorialScore,
} = require("../../src/lib/blog/pipeline");
const { buildBlogSchema } = require("../../src/lib/blog/schema");

function validPost(overrides = {}) {
  return {
    title: "A Better Weekly Cash Flow Review",
    slug: "weekly-cash-flow-review",
    excerpt: "A practical process for reviewing expected cash, bills, and operating decisions each week.",
    content: `## Review the starting position

Bring the current bank position and expected receipts into one simple review. [See WorkSteady pricing](/pricing).
The [SBA cash flow guide](https://www.sba.gov/example) provides additional context.

## Test the next decisions

Compare due dates, operating needs, and timing without treating uncertain receipts as guaranteed. [Explore practical tools](/tools/audit).
Use [IRS financial guidance](https://www.irs.gov/example) when tax obligations affect timing.

## Record owners and follow-up

Assign each action to an owner, set a review date, and document assumptions so the next review begins with context.`,
    primaryKeyword: "weekly cash flow review",
    secondaryKeywords: ["cash flow planning"],
    category: "Cash Flow",
    metaTitle: "A Better Weekly Cash Flow Review",
    metaDescription:
      "Use this practical weekly cash flow review to compare expected receipts, upcoming bills, assumptions, and the operating decisions your team needs to make.",
    canonicalUrl: "https://worksteady.app/weekly-cash-flow-review",
    featuredImage: {
      url: "https://res.cloudinary.com/demo/image/upload/example.webp",
      alt: "Owner reviewing a weekly cash flow plan",
      variants: [],
    },
    internalLinks: [
      { href: "/pricing", anchor: "WorkSteady pricing" },
      { href: "/tools/audit", anchor: "practical tools" },
    ],
    sourceReferences: [
      { title: "Cash flow guide", url: "https://www.sba.gov/example" },
      { title: "Financial guidance", url: "https://www.irs.gov/example" },
    ],
    author: { name: "WorkSteady Editorial Team", url: "https://worksteady.app" },
    publishedAt: new Date("2026-09-01T12:00:00.000Z"),
    updatedAt: new Date("2026-09-02T12:00:00.000Z"),
    ...overrides,
  };
}

test("quality validator hard-passes complete structured content", () => {
  const report = validateQuality(validPost(), {
    minWords: 60,
    qualityThreshold: 80,
  });
  assert.equal(report.hardPass, true);
  assert.equal(report.errors.length, 0);
  assert.equal(report.checks.h2Count, 3);
  assert.equal(report.checks.internalLinkCount, 2);
});

test("quality validator rejects H1, unsafe URLs, and missing image", () => {
  const post = validPost({
    content: `# Duplicate title\n\n${validPost().content}\n\n[unsafe](http://example.com)`,
    featuredImage: {},
  });
  const report = validateQuality(post, { minWords: 20 });
  assert.equal(report.hardPass, false);
  assert.match(report.errors.join(" "), /H1/);
  assert.match(report.errors.join(" "), /featured image/);
  assert.match(report.errors.join(" "), /safe HTTPS/);
});

test("schema builder is deterministic and emits article and breadcrumbs", () => {
  const post = validPost();
  const first = buildBlogSchema(post);
  const second = buildBlogSchema(post);
  assert.deepEqual(first, second);
  assert.deepEqual(first.article["@type"], ["Article", "BlogPosting"]);
  assert.equal(first.article.mainEntityOfPage["@id"], post.canonicalUrl);
  assert.equal(first.breadcrumb.itemListElement[2].item, post.canonicalUrl);
});

test("root-level article links are allowed while reserved routes stay protected", () => {
  assert.equal(isAllowedInternalUrl("/weekly-cash-flow-review"), true);
  assert.equal(isAllowedInternalUrl("/dashboard"), false);
});

test("source validation retries GET when HEAD is blocked or missing", async () => {
  const post = {
    sourceReferences: [
      { url: "https://www.sba.gov/" },
      { url: "https://example.com/placeholder" },
    ],
  };
  const result = await validateReachableSources(post, {
    fetch: async (url, options) => {
      if (String(url).includes("example.com")) {
        return new Response(null, { status: 404 });
      }
      if (options.method === "HEAD") {
        return new Response(null, { status: 404 });
      }
      return new Response("ok", { status: 200 });
    },
  });

  assert.deepEqual(result.reachable, ["https://www.sba.gov/"]);
  assert.match(result.broken.join(" "), /placeholder host|HTTP 404/);
});

test("source validation identifies the exact reachable URLs", async () => {
  const post = {
    sourceReferences: [
      { url: "https://www.sba.gov/reachable" },
      { url: "https://www.sba.gov/missing" },
    ],
  };
  const result = await validateReachableSources(post, {
    fetch: async (url) =>
      new Response(null, {
        status: String(url).endsWith("/missing") ? 404 : 200,
      }),
  });

  assert.deepEqual(result.reachable, ["https://www.sba.gov/reachable"]);
  assert.deepEqual(result.broken, [
    "https://www.sba.gov/missing returned HTTP 404",
  ]);
});

test("generation prompt requires verified URLs and a safe word-count margin", () => {
  const prompt = buildGenerationPrompt(
    { keyword: "cash flow" },
    "Research summary",
    [],
    [
      {
        title: "Cash flow guidance",
        url: "https://www.sba.gov/cash-flow",
        publisher: "SBA",
      },
    ]
  );

  assert.match(prompt, /1,400-1,800 useful words/);
  assert.match(prompt, /https:\/\/www\.sba\.gov\/cash-flow/);
  assert.match(prompt, /Use only URLs listed under/);
});

test("missing source URLs are appended as Markdown citations", () => {
  const content = ensureSourceCitations("## Advice\n\nPay invoices weekly.", [
    { title: "SBA", url: "https://www.sba.gov/", publisher: "SBA" },
    { title: "IRS", url: "https://www.irs.gov/", publisher: "IRS" },
  ]);
  assert.match(content, /https:\/\/www\.sba\.gov\//);
  assert.match(content, /https:\/\/www\.irs\.gov\//);
});

test("editorial scores on a 1-10 scale are normalized to 100", () => {
  assert.equal(normalizeEditorialScore(7), 70);
  assert.equal(normalizeEditorialScore(82), 82);
});
