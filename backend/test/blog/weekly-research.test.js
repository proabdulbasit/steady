const test = require("node:test");
const assert = require("node:assert/strict");
const {
  compactResearchContext,
  maxOpportunities,
  normalizeOpportunity,
  pickSeedOpportunities,
} = require("../../scripts/blog-weekly");

test("research context stays compact for Groq", () => {
  const posts = Array.from({ length: 40 }, (_, index) => ({
    _id: `post-${index}`,
    slug: `topic-${index}`,
    title: `Topic ${index}`,
    excerpt: "A long excerpt that should not be sent to the research model.",
    primaryKeyword: `keyword ${index}`,
    category: "Operations",
    updatedAt: new Date(),
  }));
  const opportunities = Array.from({ length: 50 }, (_, index) => ({
    keyword: `queued ${index}`,
    type: "new",
    status: "approved",
    rationale: "Do not send this long rationale to Groq.",
  }));

  const context = compactResearchContext(posts, opportunities);
  assert.equal(context.posts.length, 24);
  assert.equal(context.opportunities.length, 40);
  assert.deepEqual(Object.keys(context.posts[0]).sort(), ["keyword", "slug", "title"]);
  assert.deepEqual(Object.keys(context.opportunities[0]).sort(), ["keyword", "status", "type"]);
});

test("max opportunities stay small enough to finish as JSON", () => {
  const previous = process.env.MAX_KEYWORD_OPPORTUNITIES;
  process.env.MAX_KEYWORD_OPPORTUNITIES = "8";
  try {
    assert.equal(maxOpportunities(), 5);
  } finally {
    if (previous === undefined) delete process.env.MAX_KEYWORD_OPPORTUNITIES;
    else process.env.MAX_KEYWORD_OPPORTUNITIES = previous;
  }
});

test("normalizeOpportunity keeps two reachable evidence links", () => {
  const item = normalizeOpportunity(
    {
      keyword: "overtime scheduling",
      titleSuggestion: "Cut overtime with simpler scheduling",
      type: "new",
      cluster: "Staffing",
      rationale: "Owners need a practical overtime plan.",
      businessRelevance: 88,
      evidence: [
        { title: "SBA", url: "https://www.sba.gov/", publisher: "SBA" },
        { title: "BLS", url: "https://www.bls.gov/", publisher: "BLS" },
        { title: "Extra", url: "https://www.irs.gov/", publisher: "IRS" },
      ],
    },
    new Map()
  );

  assert.equal(item.keyword, "overtime scheduling");
  assert.equal(item.evidence.length, 2);
  assert.equal(item.evidence[0].url, "https://www.sba.gov/");
});

test("normalizeOpportunity fills official sources when Groq omits evidence", () => {
  const item = normalizeOpportunity(
    {
      keyword: "collecting overdue invoices",
      type: "new",
    },
    new Map()
  );

  assert.equal(item.keyword, "collecting overdue invoices");
  assert.equal(item.titleSuggestion, "collecting overdue invoices");
  assert.ok(item.evidence.length >= 1);
  assert.match(item.evidence[0].url, /^https:\/\//);
});

test("seed topics skip keywords that are already published or queued", () => {
  const seeds = pickSeedOpportunities(
    [{ primaryKeyword: "collecting overdue invoices", title: "Invoices" }],
    [{ keyword: "restaurant food cost percentage", normalizedKeyword: "restaurant food cost percentage" }],
    2
  );

  assert.equal(seeds.length, 2);
  assert.equal(seeds[0].keyword, "hiring your first employee");
  assert.equal(seeds[1].keyword, "small business sales tax");
});

test("fresh seeds refill the queue after static seeds are exhausted", () => {
  const { pickFreshSeedOpportunities, ensureSeedCandidates } = require("../../scripts/blog-weekly");
  const posts = [
    { primaryKeyword: "collecting overdue invoices" },
    { primaryKeyword: "restaurant food cost percentage" },
    { primaryKeyword: "hiring your first employee" },
    { primaryKeyword: "small business sales tax" },
    { primaryKeyword: "service business pricing" },
    { primaryKeyword: "retail inventory shrinkage" },
    { primaryKeyword: "customer refund policy" },
    { primaryKeyword: "vendor payment terms" },
    { primaryKeyword: "employee handbook essentials" },
    { primaryKeyword: "late payroll tax deposits" },
    { primaryKeyword: "raise prices without losing customers" },
    { primaryKeyword: "small business cash flow forecast" },
    { primaryKeyword: "fire a bad employee legally" },
    { primaryKeyword: "respond to a bad online review" },
    { primaryKeyword: "cut overtime costs" },
    { primaryKeyword: "choose a bookkeeper" },
    { primaryKeyword: "supplier price increases" },
    { primaryKeyword: "small business marketing budget" },
    { primaryKeyword: "track job profitability" },
    { primaryKeyword: "handle no-show customers" },
  ];
  const staticSeeds = pickSeedOpportunities(posts, [], 3);
  assert.equal(staticSeeds.length, 0);

  const fresh = pickFreshSeedOpportunities(posts, [], 2);
  assert.equal(fresh.length, 2);
  assert.match(fresh[0].keyword, /\d{4}|busy owners|checklist/i);

  const ensured = ensureSeedCandidates(posts, [], 2, []);
  assert.equal(ensured.candidates.length, 2);
  assert.equal(ensured.usedFreshSeeds, true);
});
