const { createDreamStorage } = require("../../services/dreamStorage");
const { hasResultCard, normalizeResultCard } = require("../../services/resultCard");

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
    this.setData({
      dreamText: pending.dreamText || "",
      analysis: response.analysis || null,
      resultCard: hasResultCard(response.dreamResultCard) ? normalizeResultCard(response.dreamResultCard) : null,
      errorMessage: response.analysis ? "" : "没有找到本次解析结果，请重新输入梦境。"
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
