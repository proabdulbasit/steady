"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoldButton, GhostButton, PageShell, formatMessage } from "../../../components/steady-ui";
import { ExplainToMyTeam } from "../../../components/explain-to-my-team";
import { useSteady } from "../../../components/steady-provider";
import { analyzeDocumentUpload } from "../../../lib/document-upload-client";
import { scheduleOutcome } from "../../../lib/outcomes-client";

const ACCEPT = ".csv,text/csv,application/pdf,.pdf,image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp";
const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function classifyFile(file) {
  const name = (file?.name || "").toLowerCase();
  const type = (file?.type || "").toLowerCase();
  if (name.endsWith(".csv") || type === "text/csv" || type === "application/vnd.ms-excel") {
    return "csv";
  }
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (type.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(name)) {
    return "image";
  }
  return "";
}

export default function DocumentUploadPage() {
  const router = useRouter();
  const { isAuthenticated, isPremium, authToken, profileLoading } = useSteady();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [kind, setKind] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [csvPreview, setCsvPreview] = useState("");
  const [note, setNote] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [advice, setAdvice] = useState("");
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (profileLoading) return;
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, profileLoading, router]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearFile = useCallback(() => {
    setFile(null);
    setKind("");
    setCsvPreview("");
    setMeta(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  }, [previewUrl]);

  async function applyFile(next) {
    setError("");
    setAdvice("");
    setMeta(null);
    if (!next) return;

    if (next.size > MAX_BYTES) {
      setError("File is too large. Maximum size is 10 MB.");
      return;
    }

    const nextKind = classifyFile(next);
    if (!nextKind) {
      setError("Upload a CSV (.csv), PDF, or photo (JPG, PNG, GIF, WEBP).");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(next);
    setKind(nextKind);

    if (nextKind === "image") {
      setPreviewUrl(URL.createObjectURL(next));
      setCsvPreview("");
    } else if (nextKind === "csv") {
      setPreviewUrl("");
      try {
        const text = await next.text();
        const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
        setCsvPreview(lines.slice(0, 8).join("\n") + (lines.length > 8 ? "\n…" : ""));
      } catch {
        setCsvPreview("(Could not preview CSV text)");
      }
    } else {
      setPreviewUrl("");
      setCsvPreview("");
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) applyFile(dropped);
  }

  async function handleAnalyze() {
    if (!file) {
      setError("Choose a CSV, PDF, or photo first.");
      return;
    }
    if (!isPremium) {
      setError("Upgrade to Pro or Business to analyze uploaded documents.");
      return;
    }

    setLoading(true);
    setError("");
    setAdvice("");
    try {
      const data = await analyzeDocumentUpload({ authToken, file, note });
      setAdvice(data.advice || "No advice returned.");
      setMeta(data.document || null);
      scheduleOutcome({
        authToken,
        advice: data.advice || "",
        userPrompt: note || `Uploaded ${file.name}`,
        source: "document_upload",
      }).catch(() => null);
    } catch (err) {
      setError(err.message || "Unable to analyze document.");
    } finally {
      setLoading(false);
    }
  }

  if (profileLoading || !isAuthenticated) {
    return (
      <PageShell
        eyebrow="Tool"
        title="CSV, PDF & Photo Upload"
        description="Loading…"
      />
    );
  }

  return (
    <PageShell
        eyebrow="Tool"
        title="CSV, PDF & Photo Upload"
        description="Photograph or upload a sales report, invoice, PDF, or expense sheet. Steady reads the real numbers and gives specific advice — no Square or QuickBooks connection required."
      >
      {!isPremium && (
        <div style={upgradeBanner}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Pro feature</div>
            <div style={{ fontSize: 14, color: "var(--ink-2)" }}>
              Document analysis is included on Pro and Business plans.
            </div>
          </div>
          <Link href="/pricing" className="btn btn-primary btn-sm">
            See pricing
          </Link>
        </div>
      )}

      <div style={layoutGrid}>
        <section style={panel}>
          <div style={{ marginBottom: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Step 1
            </div>
            <h2 className="serif" style={{ margin: 0, fontSize: 22, color: "var(--ink)" }}>
              Add your document
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55 }}>
              Drop a CSV, PDF, or snap a photo of a printed report, invoice, or receipt.
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            style={{
              ...dropZone,
              borderColor: dragOver ? "var(--gold)" : "var(--line-strong)",
              background: dragOver ? "var(--gold-soft)" : "var(--bg)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "var(--gold-soft)",
                color: "var(--gold)",
                display: "grid",
                placeItems: "center",
                fontSize: 22,
                marginBottom: 14,
              }}
              aria-hidden
            >
              ↑
            </div>
            <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600, marginBottom: 6 }}>
              Drag & drop CSV, PDF, or photo
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 18 }}>
              CSV · PDF · JPG · PNG · GIF · WEBP · max 10 MB
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <GoldButton type="button" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                Choose file
              </GoldButton>
              <GhostButton type="button" onClick={() => cameraInputRef.current?.click()} disabled={loading}>
                Take photo
              </GhostButton>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) applyFile(f);
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) applyFile(f);
              }}
            />
          </div>

          {file && (
            <div style={fileCard}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700, marginBottom: 6 }}>
                  {kind === "csv" ? "CSV ready" : "Photo ready"}
                </div>
                <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {file.name}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
                  {formatBytes(file.size)}
                  {meta?.rowCount != null ? ` · ${meta.rowCount} rows analyzed` : ""}
                </div>
              </div>
              <GhostButton type="button" onClick={clearFile} disabled={loading}>
                Remove
              </GhostButton>
            </div>
          )}

          {kind === "image" && previewUrl && (
            <div style={{ marginTop: 14, borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)", maxHeight: 280 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Document preview" style={{ width: "100%", display: "block", objectFit: "contain", maxHeight: 280, background: "var(--bg-soft)" }} />
            </div>
          )}

          {kind === "csv" && csvPreview && (
            <pre style={csvBox}>{csvPreview}</pre>
          )}

          <label style={{ display: "block", marginTop: 18 }}>
            <span style={{ display: "block", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)", fontWeight: 600, marginBottom: 8 }}>
              Optional note
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Last month’s sales from my POS export — food cost feels high"
              style={textarea}
              maxLength={2000}
            />
          </label>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <GoldButton type="button" onClick={handleAnalyze} disabled={loading || !file || !isPremium}>
              {loading ? "Analyzing…" : "Analyze with Steady"}
            </GoldButton>
            {!isPremium && (
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                Requires Pro or Business
              </span>
            )}
          </div>

          {error && (
            <div role="alert" style={errorBanner}>
              {error}
            </div>
          )}
        </section>

        <aside style={sidePanel}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Why this exists
          </div>
          <h3 className="serif" style={{ margin: "0 0 12px", fontSize: 20, color: "var(--ink)" }}>
            Advice from your files — not waiting on integrations
          </h3>
          <ul style={{ margin: 0, padding: "0 0 0 18px", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.7 }}>
            <li>Export a CSV from any POS, spreadsheet, or bank download</li>
            <li>Photograph invoices, receipts, or printed expense sheets</li>
            <li>Steady reads the actual data and flags what matters</li>
            <li>Works even while Square / QuickBooks OAuth is pending</li>
          </ul>
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 10 }}>Also useful</div>
            <div style={{ display: "grid", gap: 8 }}>
              <Link href="/profile" style={sideLink}>
                Profile · integrations →
              </Link>
              <Link href="/tools/audit" style={sideLink}>
                Monthly business audit →
              </Link>
              <Link href="/chat" style={sideLink}>
                Open chat →
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {advice && (
        <section style={{ marginTop: 28, maxWidth: 900 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <h2 className="serif" style={{ margin: 0, fontSize: 22, color: "var(--ink)" }}>
              Steady&apos;s read
            </h2>
            {meta?.kind && (
              <span style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)", fontWeight: 600 }}>
                From {meta.kind === "csv" ? "CSV" : "photo"}
                {meta.fileName ? ` · ${meta.fileName}` : ""}
              </span>
            )}
          </div>
          <div style={resultBox}>
            {formatMessage(advice)}
            <ExplainToMyTeam advice={advice} />
          </div>
        </section>
      )}
    </PageShell>
  );
}

const layoutGrid = {
  display: "grid",
  gap: 22,
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  alignItems: "start",
  maxWidth: 980,
};

const panel = {
  background: "var(--bg-elev)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-lg)",
  padding: 24,
  boxShadow: "var(--shadow-sm)",
};

const sidePanel = {
  background: "var(--bg-soft)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-lg)",
  padding: 22,
};

const dropZone = {
  border: "1.5px dashed var(--line-strong)",
  borderRadius: 16,
  padding: "28px 20px",
  textAlign: "center",
  transition: "border-color 0.15s ease, background 0.15s ease",
};

const fileCard = {
  marginTop: 14,
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid var(--line)",
  background: "var(--bg)",
};

const csvBox = {
  marginTop: 14,
  marginBottom: 0,
  padding: 14,
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "var(--bg)",
  fontSize: 12,
  lineHeight: 1.55,
  color: "var(--ink-2)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 180,
  overflow: "auto",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const textarea = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: 14,
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: 15,
  resize: "vertical",
  minHeight: 88,
};

const errorBanner = {
  marginTop: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--danger)",
  background: "var(--danger-soft)",
  color: "var(--ink)",
  fontSize: 14,
};

const upgradeBanner = {
  maxWidth: 980,
  marginBottom: 22,
  padding: "16px 18px",
  borderRadius: 14,
  border: "1px solid var(--gold-ring)",
  background: "var(--gold-soft)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const resultBox = {
  background: "var(--bg-elev)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-lg)",
  padding: 24,
  color: "var(--ink-2)",
  boxShadow: "var(--shadow-sm)",
};

const sideLink = {
  fontSize: 14,
  color: "var(--ink-2)",
  textDecoration: "none",
};
