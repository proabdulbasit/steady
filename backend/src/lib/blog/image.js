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
  usedFingerprints = new Set(),
  usedSourceIds = new Set(),
  fetch,
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
    return await fallbackFeaturedImage({ alt: safeAlt, slug, title, category, fetch });
  } catch (fallbackError) {
    throw generationError || fallbackError;
  }
}

module.exports = {
  buildFallbackSvg,
  cloudinarySignature,
  deriveVariants,
  fallbackFeaturedImage,
  generateFeaturedImage,
  parseCloudinaryUrl,
  promptFingerprint,
  replicateFlux,
  uploadCloudinary,
};
