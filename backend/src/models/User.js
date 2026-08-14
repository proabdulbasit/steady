const mongoose = require("mongoose");
const { ALLOWED_INDUSTRY_IDS } = require("../lib/industries");

const usageSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    questionsUsed: { type: Number, default: 0 },
  },
  { _id: false }
);

const integrationsSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    status: { type: String, default: "disconnected" },
    externalId: { type: String, default: "" },
    connectedAt: { type: Date, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    oauth: {
      accessToken: { type: String, default: "" },
      refreshToken: { type: String, default: "" },
      tokenType: { type: String, default: "" },
      scopes: { type: [String], default: [] },
      expiresAt: { type: Date, default: null },
    },
    // Provider-specific identifiers
    merchantId: { type: String, default: "" }, // Square
    realmId: { type: String, default: "" }, // QuickBooks
    locationIds: { type: [String], default: [] }, // Square
    sync: {
      lastSyncedAt: { type: Date, default: null },
      lastSyncStatus: { type: String, default: "" },
      cursor: { type: String, default: "" },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    sessionIds: { type: [String], default: [] },
    industry: {
      type: String,
      enum: ALLOWED_INDUSTRY_IDS,
      default: "restaurant",
      index: true,
    },
    planId: { type: String, default: "free", index: true },
    planSelected: { type: Boolean, default: true, index: true },
    stripeCustomerId: { type: String, default: "", index: true },
    stripeSubscriptionId: { type: String, default: "", index: true },
    subscriptionStatus: { type: String, default: "inactive" },
    currentPeriodEnd: { type: Date, default: null },
    usage: { type: usageSchema, default: null },
    integrations: { type: [integrationsSchema], default: [] },
    lastCheckoutSessionId: { type: String, default: "" },
    passwordResetTokenHash: { type: String, default: "" },
    passwordResetExpires: { type: Date, default: null },
    briefingDelivery: {
      emailEnabled: { type: Boolean, default: true },
      pushEnabled: { type: Boolean, default: true },
      lastDeliveredAt: { type: Date, default: null },
      lastDeliveryDateKey: { type: String, default: "" },
    },
    pushSubscriptions: {
      type: [
        {
          endpoint: { type: String, required: true },
          keys: {
            p256dh: { type: String, default: "" },
            auth: { type: String, default: "" },
          },
          userAgent: { type: String, default: "" },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
