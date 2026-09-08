const test = require("node:test");
const assert = require("node:assert/strict");
const {
  duplicateScore,
  findClosestDuplicate,
  normalizeText,
} = require("../../src/lib/blog/duplicate");

test("normalization removes punctuation and casing differences", () => {
  assert.equal(normalizeText("Cash-Flow: A Guide!"), "cash flow a guide");
});

test("exact normalized keywords are duplicates", () => {
  const result = duplicateScore(
    {
      title: "A Practical Cash Flow Guide",
      primaryKeyword: "small business cash flow",
      content: "Plan cash flow with a rolling weekly forecast and review.",
    },
    {
      title: "Small Business Cash Flow Planning",
      normalizedKeyword: "small business cash flow",
      content: "Use a weekly forecast to review cash flow and upcoming bills.",
    }
  );
  assert.equal(result.keyword, 1);
  assert.equal(result.duplicate, true);
});

test("unrelated topics receive a low score", () => {
  const result = duplicateScore(
    {
      title: "Restaurant Shift Handoffs",
      primaryKeyword: "restaurant shift handoff",
      content: "Create a concise checklist for opening and closing teams.",
    },
    {
      title: "Invoice Payment Forecasting",
      primaryKeyword: "accounts receivable forecast",
      content: "Group unpaid invoices by due date and customer payment behavior.",
    }
  );
  assert.ok(result.score < 0.3);
  assert.equal(result.duplicate, false);
});

test("closest duplicate returns the highest-scoring post", () => {
  const posts = [
    { title: "Hiring Plans", primaryKeyword: "staff hiring plan", content: "hire a team" },
    { title: "Cash Flow Planning", primaryKeyword: "cash flow planning", content: "weekly cash forecast" },
  ];
  const closest = findClosestDuplicate(
    { title: "Cash Flow Plan", primaryKeyword: "cash flow planning", content: "weekly cash forecast" },
    posts
  );
  assert.equal(closest.post.title, "Cash Flow Planning");
});
