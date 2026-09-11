const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFallbackSvg,
  buildUnsplashQueries,
  generateFeaturedImage,
  pickCuratedUnsplashPhoto,
} = require("../../src/lib/blog/image");

process.env.CLOUDINARY_URL ||= "cloudinary://key:secret@demo";

function cloudinarySuccess(publicId = "worksteady/blog/unsplash-automate-invoicing") {
  return new Response(
    JSON.stringify({
      secure_url: "https://res.cloudinary.com/demo/image/upload/article.webp",
      public_id: publicId,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

test("fallback SVG includes the article title and category", () => {
  const svg = buildFallbackSvg({
    title: "Cash Flow Review",
    category: "Finance",
  });
  assert.match(svg, /Cash Flow Review/);
  assert.match(svg, /Finance/);
  assert.match(svg, /WorkSteady/);
});

test("Unsplash queries keep the article topic and drop image-prompt jargon", () => {
  const queries = buildUnsplashQueries({
    title: "Automate Invoicing to Boost Cash Flow",
    category: "Finance",
    keyword: "automated invoicing",
    prompt: "Photorealistic editorial photo, no text, no logos, cinematic lighting, invoices on a wooden desk",
  });
  assert.equal(queries.some((query) => /invoic/i.test(query)), true);
  assert.equal(queries.some((query) => /photorealistic|cinematic|no text/i.test(query)), false);
});

test("curated Unsplash photos match invoicing, inventory, and remote-team topics", () => {
  const invoice = pickCuratedUnsplashPhoto({
    title: "Automate Invoicing to Boost Cash Flow",
    category: "Finance",
    keyword: "automated invoicing",
  });
  assert.equal(invoice.tags.some((tag) => /invoice|finance|cash|accounting/.test(tag)), true);

  const inventory = pickCuratedUnsplashPhoto({
    title: "Implementing Just-in-Time Inventory for Small Retailers",
    category: "Operations",
    keyword: "just-in-time inventory",
  });
  assert.equal(inventory.tags.some((tag) => /inventory|warehouse|retail|stock/.test(tag)), true);

  const remote = pickCuratedUnsplashPhoto({
    title: "Best Practices for Managing Remote Teams",
    category: "Management",
    keyword: "remote team management",
  });
  assert.equal(remote.tags.some((tag) => /remote|team|meeting|management/.test(tag)), true);
  assert.notEqual(invoice.id, inventory.id);
});

test("Replicate credit failures fall back to a relevant Unsplash photo", async () => {
  const uploads = [];
  const image = await generateFeaturedImage({
    prompt: "A photorealistic workshop desk",
    alt: "Owner reviewing invoices",
    slug: "automate-invoicing",
    title: "Automate Invoicing",
    category: "Finance",
    keyword: "automated invoicing",
    accessKey: "test-key",
    fetch: async (url, options) => {
      const target = String(url);
      if (target.includes("replicate.com")) {
        return new Response(
          JSON.stringify({ detail: "You have insufficient credit to run this model." }),
          { status: 402, headers: { "content-type": "application/json" } }
        );
      }
      if (target.includes("api.unsplash.com/search/photos")) {
        assert.match(target, /invoic|finance|desk/i);
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "invoice-desk-1",
                alt_description: "Paper invoices and a calculator on a wooden desk",
                description: "Small business invoicing",
                tags: [{ title: "invoice" }, { title: "finance" }],
                urls: {
                  raw: "https://images.unsplash.com/photo-invoice-desk",
                },
                links: {
                  download_location: "https://api.unsplash.com/photos/invoice-desk-1/download",
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (target.includes("api.unsplash.com/photos/invoice-desk-1/download")) {
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      }
      if (target.includes("cloudinary.com")) {
        uploads.push(options.body.get("file"));
        return cloudinarySuccess();
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
  });

  assert.equal(image.provider, "unsplash+cloudinary");
  assert.match(image.sourceId, /invoice-desk-1/);
  assert.equal(image.alt, "Owner reviewing invoices");
  assert.equal(uploads.length, 1);
  assert.match(String(uploads[0]), /images\.unsplash\.com/);
});

test("branded artwork is used only after Unsplash is unavailable", async () => {
  const image = await generateFeaturedImage({
    prompt: "A photorealistic workshop desk",
    alt: "Owner reviewing invoices",
    slug: "automate-invoicing",
    title: "Automate Invoicing",
    category: "Finance",
    accessKey: "",
    fetch: async (url, options) => {
      const target = String(url);
      if (target.includes("replicate.com")) {
        return new Response(
          JSON.stringify({ detail: "You have insufficient credit to run this model." }),
          { status: 402, headers: { "content-type": "application/json" } }
        );
      }
      if (target.includes("cloudinary.com")) {
        const file = String(options.body.get("file") || "");
        if (file.startsWith("data:image/svg+xml")) {
          return new Response(
            JSON.stringify({
              secure_url: "https://res.cloudinary.com/demo/image/upload/fallback.webp",
              public_id: "worksteady/blog/fallback-automate-invoicing",
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: { message: "Unsplash host blocked" } }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
  });

  assert.equal(image.provider, "cloudinary-fallback");
  assert.match(image.url, /fallback\.webp/);
});
