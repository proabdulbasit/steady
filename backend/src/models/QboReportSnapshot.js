const mongoose = require("mongoose");

const QboReportSnapshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    realmId: { type: String, default: "", index: true },
    reportType: { type: String, required: true, index: true }, // ProfitAndLoss|BalanceSheet
    startDate: { type: String, required: true }, // YYYY-MM-DD
    endDate: { type: String, required: true }, // YYYY-MM-DD
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
    extracted: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

QboReportSnapshotSchema.index({ userId: 1, reportType: 1, startDate: 1, endDate: 1 }, { unique: true });

module.exports = mongoose.models.QboReportSnapshot || mongoose.model("QboReportSnapshot", QboReportSnapshotSchema);

