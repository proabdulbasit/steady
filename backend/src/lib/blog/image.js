const crypto = require("node:crypto");

const REPLICATE_MODEL = "black-forest-labs/flux-1.1-pro";

function promptFingerprint(prompt) {
  return crypto.createHash("sha256").update(String(prompt || "").trim().toLowerCase()).digest("hex");
}

function parseCloudinaryUrl(value = process.env.CLOUDINARY_URL) {
  if (!value) throw new Error("Missing CLOUDINARY_URL.");
  const parsed = new URL(value);
  if (parsed.protocol !== "cloudinary:") throw new Error("CLOUDINARY_URL must use cloudinary://.");
  return {
    cloudName: parsed.hostname,
    apiKey: decodeURIComponent(parsed.username),
    apiSecret: decodeURIComponent(parsed.password),
  };
}

function cloudinarySignature(parameters, secret) {
  const payload = Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("sha1").update(`${payload}${secret}`).digest("hex");
}

function transformedUrl(url, transformation) {
  return url.replace("/upload/", `/upload/${transformation}/`);
}

function deriveVariants(url) {
  return [
    {
      aspectRatio: "16:9",
      url: transformedUrl(url, "c_fill,g_auto,w_1600,h_900,f_webp,q_auto"),
      width: 1600,
      height: 900,
    },
    {
      aspectRatio: "4:3",
      url: transformedUrl(url, "c_fill,g_auto,w_1200,h_900,f_webp,q_auto"),
      width: 1200,
      height: 900,
    },
    {
      aspectRatio: "1:1",
      url: transformedUrl(url, "c_fill,g_auto,w_1000,h_1000,f_webp,q_auto"),
      width: 1000,
      height: 1000,
    },
  ];
}

async function replicateFlux(prompt, options = {}) {
  const token = options.token || process.env.REPLICATE_API_TOKEN;
  const fetchImpl = options.fetch || global.fetch;
  if (!token) throw new Error("Missing REPLICATE_API_TOKEN.");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "wait=30",
  };
  let response = await fetchImpl(
    `https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "16:9",
          output_format: "webp",
          output_quality: 90,
          safety_tolerance: 2,
        },
      }),
    }
  );
  let prediction = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Replicate request failed (${response.status}): ${prediction.detail || response.statusText}`);
  }
  for (let poll = 0; !["succeeded", "failed", "canceled"].includes(prediction.status) && poll < 40; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await fetchImpl(prediction.urls.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Replicate polling failed (${response.status}).`);
  }
  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate image generation ${prediction.status || "timed out"}: ${prediction.error || ""}`);
  }
  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!output) throw new Error("Replicate did not return an image.");
  return { url: output, sourceId: prediction.id };
}

async function uploadCloudinary(sourceUrl, publicId, options = {}) {
  const fetchImpl = options.fetch || global.fetch;
  const credentials = parseCloudinaryUrl(options.cloudinaryUrl);
  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = {
    folder: "worksteady/blog",
    format: "webp",
    overwrite: options.overwrite ? "true" : "false",
    public_id: publicId,
    timestamp,
  };
  const form = new FormData();
  form.set("file", sourceUrl);
  for (const [key, value] of Object.entries(parameters)) form.set(key, String(value));
  form.set("api_key", credentials.apiKey);
  form.set("signature", cloudinarySignature(parameters, credentials.apiSecret));
  const response = await fetchImpl(
    `https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Cloudinary upload failed (${response.status}): ${body.error?.message || response.statusText}`);
  }
  const secureUrl = body.secure_url;
  if (!secureUrl) throw new Error("Cloudinary did not return a secure URL.");
  return {
    url: transformedUrl(secureUrl, "c_fill,g_auto,w_1600,h_900,f_webp,q_auto"),
    width: 1600,
    height: 900,
    sourceId: body.public_id,
    variants: deriveVariants(secureUrl),
  };
}

const IMAGE_PROMPT_NOISE =
  /photorealistic|cinematic|editorial|hyper[- ]real|16:9|aspect ratio|no text|no logos?|brand[- ]safe|studio lighting|bokeh|dslr|4k|ultra detailed|shot on|prompt|camera|lens/gi;
const TOPIC_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "their",
  "small",
  "business",
  "businesses",
  "owner",
  "owners",
  "practical",
  "guide",
  "using",
  "image",
  "photo",
  "photograph",
  "article",
]);

const UNSPLASH_CATALOG = [
  {
    id: "photo-1554224155-6726b3ff858f",
    url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Calculator, receipts, and a notebook on a finance desk",
    tags: ["finance", "invoice", "invoicing", "cash", "accounting", "bookkeeping", "tax", "money", "budget"],
  },
  {
    id: "photo-1553729459-efe14ef6055d",
    url: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Hands counting cash next to a calculator",
    tags: ["cash", "flow", "money", "payments", "revenue", "collections", "forecast"],
  },
  {
    id: "photo-1460925895917-afdab827c52f",
    url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Laptop showing charts and financial analytics",
    tags: ["forecast", "analytics", "dashboard", "ai", "cash", "planning", "budget", "finance"],
  },
  {
    id: "photo-1553413077-190dd305871c",
    url: "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Warehouse aisles stacked with inventory",
    tags: ["inventory", "warehouse", "stock", "retail", "logistics", "supply", "jit"],
  },
  {
    id: "photo-1586528116311-ad8dd3c8310d",
    url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Warehouse worker reviewing stock on pallet racks",
    tags: ["inventory", "warehouse", "retail", "fulfillment", "shipping", "stock"],
  },
  {
    id: "photo-1441986300917-64674bd600d8",
    url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Clothing hanging in a small retail shop",
    tags: ["retail", "store", "shop", "inventory", "merchandising", "customer"],
  },
  {
    id: "photo-1522071820081-009f0129c71c",
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Team collaborating around a table with laptops",
    tags: ["team", "remote", "collaboration", "meeting", "hiring", "management"],
  },
  {
    id: "photo-1600880292203-757bb62b4baf",
    url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "People on a video call in a bright office",
    tags: ["remote", "team", "video", "hybrid", "management", "meeting"],
  },
  {
    id: "photo-1586281380349-632531db7ed4",
    url: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Person working on a laptop at a home desk",
    tags: ["remote", "laptop", "home", "office", "productivity", "work"],
  },
  {
    id: "photo-1450101499163-c8848c66ca85",
    url: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Hands signing a stack of business documents",
    tags: ["compliance", "legal", "documents", "checklist", "contract", "policy"],
  },
  {
    id: "photo-1454165804606-c3d57bc86b40",
    url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Notebook, laptop, and coffee during a planning session",
    tags: ["planning", "operations", "checklist", "strategy", "management", "desk"],
  },
  {
    id: "photo-1542744173-8e7e53415bb0",
    url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Team meeting in a conference room",
    tags: ["meeting", "leadership", "hiring", "team", "management", "office"],
  },
  {
    id: "photo-1556740738-b6a63e27c4df",
    url: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Customer paying at a small cafe counter",
    tags: ["customer", "retail", "payments", "sales", "service", "store"],
  },
  {
    id: "photo-1486312338219-ce68d2c6f44d",
    url: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Close-up of hands typing on a laptop",
    tags: ["laptop", "software", "ai", "automation", "productivity", "office"],
  },
  {
    id: "photo-1497366216548-37526070297c",
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&h=900&q=80",
    alt: "Sunlit office with desks and plants",
    tags: ["office", "workplace", "operations", "space", "studio"],
  },
];

function collectTopicTerms({ title, category, prompt, keyword } = {}) {
  const text = [keyword, title, category, String(prompt || "").replace(IMAGE_PROMPT_NOISE, " ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");
  return [...new Set(text.split(/\s+/).filter((word) => word.length > 2 && !TOPIC_STOP_WORDS.has(word)))];
}

function buildUnsplashQueries({ title, category, prompt, keyword } = {}) {
  const terms = collectTopicTerms({ title, category, prompt, keyword });
  const queries = [];
  if (keyword) queries.push(`${String(keyword).trim()} small business`);
  if (title) queries.push(`${String(title).trim()} workplace`);
  if (terms.length) queries.push(`${terms.slice(0, 5).join(" ")} small business`);
  if (category) queries.push(`${String(category).trim()} small business office`);
  queries.push("small business workplace desk");
  return [...new Set(queries.map((query) => query.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function scorePhotoTags(tags, terms) {
  const haystack = (Array.isArray(tags) ? tags : []).join(" ").toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function pickCuratedUnsplashPhoto({ title, category, prompt, keyword, usedSourceIds = new Set() } = {}) {
  const terms = collectTopicTerms({ title, category, prompt, keyword });
  const ranked = UNSPLASH_CATALOG
    .filter((photo) => !usedSourceIds.has(photo.id))
    .map((photo) => ({ photo, score: scorePhotoTags(photo.tags, terms) }))
    .sort((left, right) => right.score - left.score || left.photo.id.localeCompare(right.photo.id));
  const best = ranked.find((entry) => entry.score > 0) || ranked[0];
  if (!best) throw new Error("No unused Unsplash catalog photo remained.");
  return best.photo;
}

function unsplashAccessKey(options = {}) {
  if (options.accessKey !== undefined) return String(options.accessKey || "");
  return process.env.UNSPLASH_ACCESS_KEY || "";
}

function unsplashHeaders(accessKey) {
  return {
    Accept: "application/json",
    Authorization: `Client-ID ${accessKey}`,
  };
}

function normalizeUnsplashPhoto(photo) {
  const raw = photo?.urls?.raw || photo?.urls?.full || photo?.urls?.regular || "";
  if (!photo?.id || !raw) return null;
  const url = new URL(raw);
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "crop");
  url.searchParams.set("w", "1600");
  url.searchParams.set("h", "900");
  url.searchParams.set("q", "80");
  const tags = [
    ...(Array.isArray(photo.tags) ? photo.tags.map((tag) => tag.title || tag) : []),
    photo.alt_description,
    photo.description,
  ]
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);
  return {
    id: photo.id,
    url: url.toString(),
    alt: photo.alt_description || photo.description || "",
    tags,
    downloadLocation: photo.links?.download_location || "",
  };
}

function isPremiumUnsplashUrl(url) {
  return /plus\.unsplash\.com|premium_photo/i.test(String(url || ""));
}

async function searchUnsplashPhotos(query, { fetch, accessKey, usedSourceIds = new Set() } = {}) {
  const key = unsplashAccessKey({ accessKey });
  const fetchImpl = fetch || global.fetch;
  const endpoint = new URL(
    key ? "https://api.unsplash.com/search/photos" : "https://unsplash.com/napi/search/photos"
  );
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("orientation", "landscape");
  endpoint.searchParams.set("per_page", "10");
  if (key) endpoint.searchParams.set("content_filter", "high");
  const response = await fetchImpl(endpoint, {
    headers: key
      ? unsplashHeaders(key)
      : {
          Accept: "application/json",
          "User-Agent": "WorkSteadyBlog/1.0 (+https://worksteady.app)",
        },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Unsplash search failed (${response.status}): ${body.errors?.[0] || response.statusText}`);
  }
  const terms = collectTopicTerms({ prompt: query });
  const photos = (body.results || [])
    .filter((photo) => !isPremiumUnsplashUrl(photo?.urls?.raw || photo?.urls?.regular || ""))
    .map(normalizeUnsplashPhoto)
    .filter(Boolean)
    .filter((photo) => !usedSourceIds.has(photo.id));
  photos.sort((left, right) => scorePhotoTags(right.tags, terms) - scorePhotoTags(left.tags, terms));
  return photos[0] || null;
}

async function selectUnsplashPhoto({
  title,
  category,
  prompt,
  keyword,
  usedSourceIds = new Set(),
  fetch,
  accessKey,
} = {}) {
  const queries = buildUnsplashQueries({ title, category, prompt, keyword });
  for (const query of queries) {
    try {
      const photo = await searchUnsplashPhotos(query, { fetch, accessKey, usedSourceIds });
      if (photo) return photo;
    } catch {
      // Try the next, more general query before using the curated catalog.
    }
  }
  return pickCuratedUnsplashPhoto({ title, category, prompt, keyword, usedSourceIds });
}

async function unsplashFeaturedImage({
  alt,
  slug,
  title,
  category,
  prompt,
  keyword,
  usedSourceIds = new Set(),
  fetch,
  accessKey,
}) {
  const photo = await selectUnsplashPhoto({
    title,
    category,
    prompt,
    keyword,
    usedSourceIds,
    fetch,
    accessKey,
  });
  const key = unsplashAccessKey({ accessKey });
  if (key && photo.downloadLocation) {
    const fetchImpl = fetch || global.fetch;
    await fetchImpl(photo.downloadLocation, { headers: unsplashHeaders(key) }).catch(() => {});
  }
  const uploaded = await uploadCloudinary(photo.url, `unsplash-${slug}`, {
    fetch,
    overwrite: true,
  });
  return {
    ...uploaded,
    alt: alt || photo.alt || `${title || "WorkSteady article"} featured image`,
    provider: "unsplash+cloudinary",
    sourceId: `${photo.id}:${uploaded.sourceId}`,
    prompt: `unsplash:${photo.id}`,
    promptFingerprint: promptFingerprint(`unsplash:${photo.id}`),
  };
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFallbackSvg({ title, category }) {
  const heading = escapeXml(String(title || "WorkSteady").slice(0, 72));
  const label = escapeXml(String(category || "Small business guidance").slice(0, 48));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#1c1917"/>
  <rect x="72" y="72" width="1456" height="756" rx="28" fill="#f4efe6"/>
  <text x="120" y="180" fill="#6b6258" font-family="Georgia, serif" font-size="28">${label}</text>
  <text x="120" y="320" fill="#1c1917" font-family="Georgia, serif" font-size="56">${heading}</text>
  <text x="120" y="760" fill="#6b6258" font-family="Georgia, serif" font-size="28">WorkSteady</text>
</svg>`;
}

async function fallbackFeaturedImage({
  alt,
  slug,
  title,
  category,
  fetch,
}) {
  const svg = buildFallbackSvg({ title, category });
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const uploaded = await uploadCloudinary(dataUri, `fallback-${slug}`, {
    fetch,
    overwrite: true,
  });
  return {
    ...uploaded,
    alt: alt || `${title || "WorkSteady article"} featured image`,
    provider: "cloudinary-fallback",
    sourceId: `fallback:${uploaded.sourceId}`,
    prompt: "",
    promptFingerprint: promptFingerprint(`fallback:${slug}`),
  };
}

async function generateFeaturedImage({
  prompt,
  alt,
  slug,
  title,
  category,
  keyword,
  usedFingerprints = new Set(),
  usedSourceIds = new Set(),
  fetch,
  accessKey,
}) {
  const safeAlt = alt || `${title || slug} featured image`;
  let generationError;
  if (String(prompt || "").trim()) {
    try {
      const fingerprint = promptFingerprint(prompt);
      if (usedFingerprints.has(fingerprint)) throw new Error("Duplicate image prompt rejected.");
      const generated = await replicateFlux(prompt, { fetch });
      if (usedSourceIds.has(generated.sourceId)) {
        throw new Error("Duplicate image source rejected.");
      }
      const uploaded = await uploadCloudinary(
        generated.url,
        `${slug}-${fingerprint.slice(0, 12)}`,
        { fetch }
      );
      return {
        ...uploaded,
        alt: safeAlt,
        provider: "replicate-flux+cloudinary",
        sourceId: `${generated.sourceId}:${uploaded.sourceId}`,
        prompt,
        promptFingerprint: fingerprint,
      };
    } catch (error) {
      generationError = error;
    }
  }
  try {
    return await unsplashFeaturedImage({
      alt: safeAlt,
      slug,
      title,
      category,
      prompt,
      keyword,
      usedSourceIds,
      fetch,
      accessKey,
    });
  } catch (error) {
    generationError = generationError || error;
  }
  try {
    return await fallbackFeaturedImage({ alt: safeAlt, slug, title, category, fetch });
  } catch (fallbackError) {
    throw generationError || fallbackError;
  }
}

module.exports = {
  buildFallbackSvg,
  buildUnsplashQueries,
  cloudinarySignature,
  deriveVariants,
  fallbackFeaturedImage,
  generateFeaturedImage,
  parseCloudinaryUrl,
  pickCuratedUnsplashPhoto,
  promptFingerprint,
  replicateFlux,
  unsplashFeaturedImage,
  uploadCloudinary,
};
