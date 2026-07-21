const { requestQuickAnalysis } = require("../../services/apiClient");
const legal = require("../../services/legalDocuments");

const PENDING_RESULT_KEY = "dream_anatomy_pending_result_v1";

Page({
  data: {
    dreamText: "",
    agreed: false,
    crossBorderAgreed: false,
    submitting: false,
    errorMessage: "",
    legalVersions: legal.getLegalVersions()
  },
  onLoad() {
    const accepted = legal.hasAcceptedLegalVersions(wx);
    this.setData({ agreed: accepted, crossBorderAgreed: accepted });
  },
  onDreamInput(event) {
    this.setData({ dreamText: event.detail.value, errorMessage: "" });
  },
  toggleAgreement(event) {
    this.setData({ agreed: event.detail.value.length > 0, errorMessage: "" });
  },
  toggleCrossBorderAgreement(event) {
    this.setData({ crossBorderAgreed: event.detail.value.length > 0, errorMessage: "" });
  },
  openPrivacy() {
    wx.navigateTo({ url: "/pages/privacy/index?doc=privacy" });
  },
  openTerms() {
    wx.navigateTo({ url: "/pages/privacy/index?doc=terms" });
  },
  openAi() {
    wx.navigateTo({ url: "/pages/privacy/index?doc=ai" });
  },
  openCrossBorder() {
    wx.navigateTo({ url: "/pages/privacy/index?doc=cross-border" });
  },
  async submit() {
    if (this.data.submitting) return;
    if (!this.data.agreed) {
      this.setData({ errorMessage: "请先阅读并同意用户协议、隐私政策和 AI 使用说明。" });
      return;
    }
    if (!this.data.crossBorderAgreed) {
      this.setData({ errorMessage: "请先阅读境外处理说明，并单独同意必要的境外处理。" });
      return;
    }

    this.setData({ submitting: true, errorMessage: "" });
    legal.saveGuestLegalConsent(wx);
    try {
      const response = await requestQuickAnalysis(this.data.dreamText, { wx });
      wx.setStorageSync(PENDING_RESULT_KEY, {
        dreamText: this.data.dreamText.trim(),
        response
      });
      wx.navigateTo({ url: "/pages/result/index" });
    } catch (error) {
      this.setData({ errorMessage: error.message || "这次解析没有顺利完成，请稍后再试。" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
