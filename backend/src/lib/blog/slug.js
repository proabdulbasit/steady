const { RESERVED_ROOT_SLUGS } = require("./constants");

const NORMALIZED_RESERVED_SLUGS = new Set(
  [...RESERVED_ROOT_SLUGS].map((value) =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  )
);

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

function isReservedSlug(slug) {
  const raw = String(slug || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  const normalized = slugify(slug);
  return RESERVED_ROOT_SLUGS.has(raw) || NORMALIZED_RESERVED_SLUGS.has(normalized);
}

function assertUsableSlug(value) {
  const slug = slugify(value);
  if (!slug) throw new Error("A title that produces a non-empty slug is required.");
  if (isReservedSlug(slug)) throw new Error(`Reserved blog slug: ${slug}`);
  return slug;
}

async function createUniqueSlug(value, exists, { currentId = null } = {}) {
  if (typeof exists !== "function") throw new TypeError("exists must be a function.");
  const base = assertUsableSlug(value);
  for (let suffix = 1; suffix <= 1000; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    if (!(await exists(candidate, currentId))) return candidate;
  }
  throw new Error(`Could not create a unique slug for "${base}".`);
}

module.exports = {
  assertUsableSlug,
  createUniqueSlug,
  isReservedSlug,
  slugify,
};
