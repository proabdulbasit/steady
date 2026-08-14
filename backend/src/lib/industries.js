/** Canonical industry ids — keep in sync with lib/industry-prompts.js INDUSTRY_OPTIONS. */
const ALLOWED_INDUSTRY_IDS = [
  "restaurant",
  "pawnshop",
  "auto_shop",
  "retail",
  "salon",
  "cleaning",
  "contractor",
  "food_truck",
  "landscaping",
  "gym",
  "laundromat",
  "photography",
  "pet_grooming",
  "tutoring",
  "daycare",
  "other",
];

const ALLOWED_INDUSTRIES = new Set(ALLOWED_INDUSTRY_IDS);

function normalizeIndustry(value, fallback = "other") {
  const id = typeof value === "string" ? value.trim() : "";
  return ALLOWED_INDUSTRIES.has(id) ? id : fallback;
}

module.exports = {
  ALLOWED_INDUSTRY_IDS,
  ALLOWED_INDUSTRIES,
  normalizeIndustry,
};
