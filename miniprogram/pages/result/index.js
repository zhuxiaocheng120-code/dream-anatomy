const { createDreamStorage } = require("../../services/dreamStorage");
const { hasResultCard, normalizeResultCard } = require("../../services/resultCard");
const { sanitizeComplianceObject } = require("../../utils/complianceText");

const PENDING_RESULT_KEY = "dream_anatomy_pending_result_v1";

function getSummary(response) {
  return response && response.analysis && (response.analysis.dreamSummary || response.analysis.summary || "");
}

Page({
  data: {
    dreamText: "",
    analysis: null,
    resultCard: null,
    saved: false,
    errorMessage: ""
  },
  onLoad() {
    const pending = wx.getStorageSync(PENDING_RESULT_KEY) || {};
    const response = pending.response || {};
    const analysis = response.analysis ? sanitizeComplianceObject(response.analysis) : null;
    const resultCard = response.dreamResultCard ? sanitizeComplianceObject(response.dreamResultCard) : null;
    this.setData({
      dreamText: pending.dreamText || "",
      analysis,
      resultCard: hasResultCard(response.dreamResultCard) ? normalizeResultCard(resultCard) : null,
      errorMessage: response.analysis ? "" : "没有找到本次整理结果，请重新输入梦境。"
    });
  },
  saveToJournal() {
    if (this.data.saved) {
      this.setData({ errorMessage: "这条梦境已经保存在本机梦境日记。" });
      return;
    }
    const storage = createDreamStorage(wx);
    const response = wx.getStorageSync(PENDING_RESULT_KEY).response || {};
    const saved = storage.saveRecord({
      dreamText: this.data.dreamText,
      analysisType: "快速解析",
      sleepQuality: "未记录",
      reportContent: response,
      dreamResultCard: response.dreamResultCard || null
    });
    if (!saved.ok) {
      this.setData({ errorMessage: saved.message });
      return;
    }
    this.setData({ saved: true, errorMessage: "已保存到本机梦境日记。" });
  },
  goJournal() {
    wx.navigateTo({ url: "/pages/journal/index" });
  },
  getSummary
});
