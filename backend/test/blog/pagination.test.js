const test = require("node:test");
const assert = require("node:assert/strict");
const {
  blogPageHref,
  visiblePageItems,
} = require("../../../lib/blog-pagination");

test("visible page items keep first, last, and ellipsis", () => {
  assert.deepEqual(visiblePageItems(1, 1), [1]);
  assert.deepEqual(visiblePageItems(1, 4), [1, 2, 3, 4]);
  assert.deepEqual(visiblePageItems(1, 21), [1, 2, 3, "ellipsis", 21]);
  assert.deepEqual(visiblePageItems(21, 21), [1, "ellipsis", 19, 20, 21]);
  assert.deepEqual(visiblePageItems(10, 21), [1, "ellipsis", 9, 10, 11, "ellipsis", 21]);
});

test("blog page one has a clean URL", () => {
  assert.equal(blogPageHref(1), "/blog");
  assert.equal(blogPageHref(3), "/blog?page=3");
});
