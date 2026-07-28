const { createDreamStorage } = require("../../services/dreamStorage");
const cloudSync = require("../../services/cloudSync");
const { formatDisplayDate } = require("../../utils/dates");
const { hasResultCard, normalizeResultCard } = require("../../services/resultCard");
const {
  formatMiniProgramAnalysisType,
  sanitizeComplianceObject,
  sanitizeComplianceText
} = require("../../utils/complianceText");

Page({
  data: {
    record: null,
    displayRecord: {},
    displayDate: "",
    resultCard: null,
    confirmVisible: false,
    errorMessage: ""
  },
  formatSyncStatus(syncStatus) {
    if (syncStatus === "synced") return "已同步";
    if (syncStatus === "sync_failed") return "同步失败";
    return "待同步";
  },
  onLoad(options) {
    const record = createDreamStorage(wx).getRecord(options.id);
    if (!record) {
      this.setData({ errorMessage: "没有找到这条本机梦境记录。" });
      return;
    }
    const reportContent = record.reportContent || {};
    const analysis = sanitizeComplianceObject(reportContent.analysis || {});
    const rawCard = record.dreamResultCard || reportContent.dreamResultCard;
    const card = rawCard ? sanitizeComplianceObject(rawCard) : null;
    this.setData({
      record,
      displayRecord: {
        displayAnalysisType: formatMiniProgramAnalysisType(record.analysisType),
        analysisText: sanitizeComplianceText(analysis.coreInterpretation || analysis.dreamSummary || "暂未生成文字整理。"),
        syncStatusLabel: this.formatSyncStatus(record.syncStatus)
      },
      displayDate: formatDisplayDate(record.createdAt),
      resultCard: hasResultCard(rawCard)
        ? normalizeResultCard(card)
        : null
    });
  },
  showDeleteConfirm() {
    this.setData({ confirmVisible: true });
  },
  hideDeleteConfirm() {
    this.setData({ confirmVisible: false });
  },
  async deleteRecord() {
    const id = this.data.record && this.data.record.localRecordId;
    const cloudRecordId = this.data.record && this.data.record.cloudRecordId;
    const storage = createDreamStorage(wx);
    const deleted = storage.deleteRecord(id);
    if (!deleted.ok) {
      this.setData({ confirmVisible: false, errorMessage: "删除没有完成，请稍后再试。" });
      return;
    }
    if (cloudSync.isCloudSyncEnabled(wx) && cloudRecordId) {
      try {
        const result = await cloudSync.deleteCloudRecord(cloudRecordId, { wx });
        if (result && result.record) {
          storage.markSynced(id, result.record);
        }
      } catch (error) {
        // The local tombstone remains and will retry on the next manual sync.
      }
    }
    wx.navigateTo({ url: "/pages/journal/index" });
  }
});
