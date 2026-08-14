/**
 * Analyze uploaded business documents (CSV text or photos) with Anthropic.
 * Lets owners get specific advice without waiting on Square / QuickBooks OAuth.
 */

const MAX_CSV_CHARS = 80000;
const MAX_CSV_ROWS = 400;
const ANTHROPIC_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const DOCUMENT_SYSTEM = `You are Steady — a straight-talking AI co-pilot for small business owners (restaurants, auto shops, pawnshops, retail, and similar).

The user uploaded a business document (sales CSV, expense sheet, invoice photo, receipt, or PDF) because they may not have Square or QuickBooks connected yet.

Rules:
- Read the actual numbers / text from the document. Do not invent figures that are not present.
- If the image, CSV, or PDF is unclear, say what you can and cannot see.
- Be specific: dollar amounts, % changes, line items, dates when visible.
- Give practical advice they can use today — no corporate fluff.
- Never claim this replaces a bookkeeper or accountant for tax filings.

Structure your response exactly like this:

DOCUMENT TYPE:
[What you think this is — sales report, invoice, expense sheet, receipt, etc.]

WHAT THE NUMBERS SAY:
[2-4 short paragraphs grounded in the uploaded data]

RED FLAGS / WATCHOUTS:
[Bullet list of problems, missing info, or risks — or "None obvious" if clean]

OPPORTUNITIES:
[2-4 specific ways to improve based on this document]

Next move: [One concrete action for today]`;

function sniffCsvKind(fileName = "", mimeType = "") {
  const name = String(fileName).toLowerCase();
  const mime = String(mimeType).toLowerCase();
  if (name.endsWith(".csv") || mime === "text/csv" || mime === "application/vnd.ms-excel") {
    return true;
  }
  return false;
}

function sniffPdfKind(fileName = "", mimeType = "") {
  const mime = String(mimeType).toLowerCase();
  const name = String(fileName).toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

function sniffImageKind(fileName = "", mimeType = "") {
  const mime = String(mimeType).toLowerCase();
  if (ANTHROPIC_IMAGE_TYPES.has(mime)) return true;
  const name = String(fileName).toLowerCase();
  return /\.(jpe?g|png|gif|webp)$/i.test(name);
}

function normalizeMimeForAnthropic(mimeType = "", fileName = "") {
  const mime = String(mimeType).toLowerCase();
  if (ANTHROPIC_IMAGE_TYPES.has(mime)) return mime;
  const name = String(fileName).toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

/** Lightweight CSV → readable text (no external parser dependency). */
function csvBufferToText(buffer) {
  let raw = buffer.toString("utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!raw) {
    const err = new Error("CSV file is empty.");
    err.status = 400;
    throw err;
  }

  const lines = raw.split("\n").filter((line) => line.trim().length);
  const truncated = lines.length > MAX_CSV_ROWS;
  const kept = truncated ? lines.slice(0, MAX_CSV_ROWS) : lines;
  let text = kept.join("\n");
  if (truncated) {
    text += `\n… [truncated: showing first ${MAX_CSV_ROWS} of ${lines.length} rows]`;
  }
  if (text.length > MAX_CSV_CHARS) {
    text = `${text.slice(0, MAX_CSV_CHARS)}\n… [truncated to ${MAX_CSV_CHARS} characters]`;
  }

  return {
    text,
    rowCount: lines.length,
    columnHint: (lines[0] || "").split(/,|\t/).length,
  };
}

async function callAnthropic({ system, userContent, maxTokens = 2000, extraHeaders = {} }) {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) {
    const err = new Error("Missing ANTHROPIC_API_KEY on the backend.");
    err.status = 500;
    throw err;
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || "Anthropic request failed.");
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { model, text };
}

/**
 * @param {object} opts
 * @param {import("mongoose").Document|object} opts.user
 * @param {Buffer} opts.buffer
 * @param {string} opts.fileName
 * @param {string} opts.mimeType
 * @param {string} [opts.note]
 * @param {"csv"|"image"|"pdf"|"auto"} [opts.kind]
 */
async function analyzeUploadedDocument({ user, buffer, fileName, mimeType, note = "", kind = "auto" }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error("No file data received.");
    err.status = 400;
    throw err;
  }

  const ownerName = String(user?.name || "there").trim() || "there";
  const industry = String(user?.industry || "general").trim() || "general";
  const noteText = String(note || "").trim().slice(0, 2000);

  let resolvedKind = kind;
  if (resolvedKind === "auto") {
    if (sniffCsvKind(fileName, mimeType)) resolvedKind = "csv";
    else if (sniffImageKind(fileName, mimeType)) resolvedKind = "image";
    else if (sniffPdfKind(fileName, mimeType)) resolvedKind = "pdf";
    else {
      const err = new Error("Upload a CSV (.csv), PDF, or photo (JPG, PNG, GIF, WEBP) of a business document.");
      err.status = 400;
      throw err;
    }
  }

  let meta = {
    kind: resolvedKind,
    fileName: fileName || null,
    mimeType: mimeType || null,
    byteSize: buffer.length,
  };

  let extraHeaders = {};
  let userContent;

  if (resolvedKind === "csv") {
    const parsed = csvBufferToText(buffer);
    meta = { ...meta, rowCount: parsed.rowCount, columnHint: parsed.columnHint };
    userContent = [
      {
        type: "text",
        text: `Owner: ${ownerName}
Industry: ${industry}
File: ${fileName || "upload.csv"}
${noteText ? `Owner note: ${noteText}\n` : ""}
Below is the CSV contents. Analyze the real data and give specific advice.

--- CSV START ---
${parsed.text}
--- CSV END ---`,
      },
    ];
  } else if (resolvedKind === "image") {
    const mediaType = normalizeMimeForAnthropic(mimeType, fileName);
    if (!mediaType) {
      const err = new Error("Unsupported image type. Use JPG, PNG, GIF, or WEBP.");
      err.status = 400;
      throw err;
    }
    meta = { ...meta, mimeType: mediaType };
    const base64 = buffer.toString("base64");
    userContent = [
      {
        type: "text",
        text: `Owner: ${ownerName}
Industry: ${industry}
File: ${fileName || "photo"}
${noteText ? `Owner note: ${noteText}\n` : ""}
This photo is a business document (invoice, receipt, sales report, expense sheet, etc.). Read what you can see and give specific advice.`,
      },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64,
        },
      },
    ];
  } else if (resolvedKind === "pdf") {
    extraHeaders = { "anthropic-beta": "pdfs-2024-09-25" };
    userContent = [
      {
        type: "text",
        text: `Owner: ${ownerName}
Industry: ${industry}
File: ${fileName || "document.pdf"}
${noteText ? `Owner note: ${noteText}\n` : ""}
This PDF is a business document. Read what you can and give specific advice.`,
      },
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: buffer.toString("base64"),
        },
      },
    ];
  } else {
    const err = new Error("Unsupported document kind.");
    err.status = 400;
    throw err;
  }

  const { model, text } = await callAnthropic({
    system: DOCUMENT_SYSTEM,
    userContent,
    maxTokens: 2200,
    extraHeaders,
  });

  if (!text?.trim()) {
    const err = new Error("Unable to analyze this document. Try a clearer photo or a simpler CSV.");
    err.status = 502;
    throw err;
  }

  return {
    advice: text.trim(),
    model,
    document: meta,
  };
}

module.exports = {
  analyzeUploadedDocument,
  sniffCsvKind,
  sniffImageKind,
  sniffPdfKind,
  ANTHROPIC_IMAGE_TYPES,
  DOCUMENT_SYSTEM,
};
