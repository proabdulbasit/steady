const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env.local") });

const cors = require("cors");
const express = require("express");
const { connectToDatabase } = require("./lib/db");
const { startIntegrationScheduler } = require("./integrations/scheduler");
const { startBriefingDeliveryScheduler } = require("./integrations/briefing-delivery-scheduler");
const { startOutcomeFollowUpEmailScheduler } = require("./integrations/outcome-followup-scheduler");
const billingRoutes = require("./routes/billing");
const accessRoutes = require("./routes/access");
const webhookRoutes = require("./routes/webhook");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const conversationRoutes = require("./routes/conversations");
const integrationsRoutes = require("./routes/integrations");
const insightsRoutes = require("./routes/insights");
const briefingRoutes = require("./routes/briefing");
const documentUploadRoutes = require("./routes/document-upload");
const explainToTeamRoutes = require("./routes/explain-to-team");
const outcomesRoutes = require("./routes/outcomes");
const dailyPulseRoutes = require("./routes/daily-pulse");

const app = express();
const port = process.env.PORT || 4000;

// Temporary: allow all origins during early deployment/testing.
app.use(cors({ origin: "*", credentials: false }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/billing/webhook", webhookRoutes);
// Allow larger JSON bodies (chat attachments are stored as base64).
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/api/briefing", briefingRoutes);
app.use("/api/document-upload", documentUploadRoutes);
app.use("/api/explain-to-team", explainToTeamRoutes);
app.use("/api/outcomes", outcomesRoutes);
app.use("/api/daily-pulse", dailyPulseRoutes);

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    error: error.message || "Internal server error.",
  });
});

connectToDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Steady backend listening on port ${port}`);
    });
    startIntegrationScheduler();
    startBriefingDeliveryScheduler();
    startOutcomeFollowUpEmailScheduler();
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
