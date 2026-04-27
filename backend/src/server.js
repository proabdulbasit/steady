const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env.local") });

const cors = require("cors");
const express = require("express");
const { connectToDatabase } = require("./lib/db");
const billingRoutes = require("./routes/billing");
const accessRoutes = require("./routes/access");
const webhookRoutes = require("./routes/webhook");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");

const app = express();
const port = process.env.PORT || 4000;

// Temporary: allow all origins during early deployment/testing.
app.use(cors({ origin: "*", credentials: false }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/billing/webhook", webhookRoutes);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/access", accessRoutes);

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
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
