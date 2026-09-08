const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertUsableSlug,
  createUniqueSlug,
  isReservedSlug,
  slugify,
} = require("../../src/lib/blog/slug");

test("slugify creates stable lowercase URL slugs", () => {
  assert.equal(slugify("  Café & Daily Decisions!  "), "cafe-and-daily-decisions");
  assert.equal(slugify("Owner’s Guide"), "owners-guide");
});

test("current application root routes are reserved", () => {
  for (const slug of [
    "admin",
    "api",
    "blog",
    "chat",
    "dashboard",
    "forgot-password",
    "login",
    "pricing",
    "privacy",
    "profile",
    "register",
    "reset-password",
    "signup",
    "terms",
    "tools",
    "_next",
    "sitemap.xml",
    "robots.txt",
    "favicon.ico",
    "sw.js",
  ]) {
    assert.equal(isReservedSlug(slug), true, slug);
    assert.throws(() => assertUsableSlug(slug), /Reserved blog slug/);
  }
});

test("createUniqueSlug increments without changing the base", async () => {
  const taken = new Set(["daily-operations", "daily-operations-2"]);
  const value = await createUniqueSlug(
    "Daily Operations",
    async (candidate) => taken.has(candidate)
  );
  assert.equal(value, "daily-operations-3");
});
