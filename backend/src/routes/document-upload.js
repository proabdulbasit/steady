const express = require("express");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");
const { getUserById } = require("../lib/user-service");
const { getPlanConfig, PLAN_IDS } = require("../config/plans");
const {
  analyzeUploadedDocument,
  sniffCsvKind,
  sniffImageKind,
  sniffPdfKind,
} = require("../lib/document-upload-analyze");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

function multerSingle(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File is too large. Maximum size is 10 MB." });
      }
      return res.status(400).json({ error: err.message || "Upload failed." });
    }
    return next(err);
  });
}

/**
 * POST /api/document-upload/analyze
 * multipart: file + optional note
 * Analyzes CSV, PDF, or photo of a business document and returns Steady advice.
 */
router.post("/analyze", requireAuth, multerSingle, async (req, res) => {
  try {
    const user = await getUserById(req.auth.sub);
    if (!user) return res.status(404).json({ error: "User not found." });

    const plan = getPlanConfig(user.planId || PLAN_IDS.FREE);
    if (!plan.features?.premiumTools) {
      return res.status(403).json({
        error: "Upgrade to Pro or Business to analyze uploaded documents.",
        planId: plan.id,
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Attach a CSV, PDF, or photo as form field \"file\"." });
    }

    const fileName = req.file.originalname || "upload";
    const mimeType = req.file.mimetype || "";
    const note = typeof req.body?.note === "string" ? req.body.note : "";

    let kind = "auto";
    if (sniffCsvKind(fileName, mimeType)) kind = "csv";
    else if (sniffImageKind(fileName, mimeType)) kind = "image";
    else if (sniffPdfKind(fileName, mimeType)) kind = "pdf";
    else {
      return res.status(400).json({
        error: "Upload a CSV (.csv), PDF, or photo (JPG, PNG, GIF, WEBP) of a sales report, invoice, or expense sheet.",
      });
    }

    const result = await analyzeUploadedDocument({
      user,
      buffer: req.file.buffer,
      fileName,
      mimeType,
      note,
      kind,
    });

    return res.json({
      ok: true,
      advice: result.advice,
      model: result.model,
      document: result.document,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || "Unable to analyze document.",
    });
  }
});

/** Health / capability check for the frontend. */
router.get("/capabilities", requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found." });
  const plan = getPlanConfig(user.planId || PLAN_IDS.FREE);
  return res.json({
    ok: true,
    allowed: Boolean(plan.features?.premiumTools),
    planId: plan.id,
    accept: {
      csv: [".csv", "text/csv"],
      images: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      pdf: ["application/pdf", ".pdf"],
    },
    maxFileBytes: 10 * 1024 * 1024,
  });
});

module.exports = router;
