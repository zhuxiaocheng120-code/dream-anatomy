const { createDreamStorage } = require("../../services/dreamStorage");
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
        analysisText: sanitizeComplianceText(analysis.coreInterpretation || analysis.dreamSummary || "暂未生成文字整理。")
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
  deleteRecord() {
    const id = this.data.record && this.data.record.localRecordId;
    const deleted = createDreamStorage(wx).deleteRecord(id);
    if (!deleted.ok) {
      this.setData({ confirmVisible: false, errorMessage: "删除没有完成，请稍后再试。" });
      return;
    }
    wx.navigateTo({ url: "/pages/journal/index" });
  }
});
