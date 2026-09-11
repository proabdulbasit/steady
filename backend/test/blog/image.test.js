const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFallbackSvg,
  generateFeaturedImage,
} = require("../../src/lib/blog/image");

process.env.CLOUDINARY_URL ||= "cloudinary://key:secret@demo";

test("fallback SVG includes the article title and category", () => {
  const svg = buildFallbackSvg({
    title: "Cash Flow Review",
    category: "Finance",
  });
  assert.match(svg, /Cash Flow Review/);
  assert.match(svg, /Finance/);
  assert.match(svg, /WorkSteady/);
});

test("Replicate credit failures fall back to a Cloudinary branded image", async () => {
  const uploads = [];
  const image = await generateFeaturedImage({
    prompt: "A photorealistic workshop desk",
    alt: "Owner reviewing invoices",
    slug: "automate-invoicing",
    title: "Automate Invoicing",
    category: "Finance",
    fetch: async (url, options) => {
      if (String(url).includes("replicate.com")) {
        return new Response(
          JSON.stringify({ detail: "You have insufficient credit to run this model." }),
          { status: 402, headers: { "content-type": "application/json" } }
        );
      }
      if (String(url).includes("cloudinary.com")) {
        uploads.push(options.body);
        return new Response(
          JSON.stringify({
            secure_url: "https://res.cloudinary.com/demo/image/upload/fallback.webp",
            public_id: "worksteady/blog/fallback-automate-invoicing",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
  });

  assert.equal(image.provider, "cloudinary-fallback");
  assert.match(image.url, /fallback\.webp/);
  assert.equal(image.alt, "Owner reviewing invoices");
  assert.equal(uploads.length, 1);
});
