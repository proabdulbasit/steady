const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isAllowedInternalUrl,
  validateQuality,
} = require("../../src/lib/blog/quality");
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
