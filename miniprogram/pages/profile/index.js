const auth = require("../../services/authAdapter");

Page({
  data: {
    authState: auth.getAuthState(),
    expiresAt: "",
    isBusy: false,
    statusMessage: ""
  },
  async onShow() {
    const authState = await auth.initialize({ wx });
    this.setData({
      authState,
      expiresAt: auth.getSessionExpiresAt(),
      statusMessage: ""
    });
  },
  async handleWechatLogin() {
    if (this.data.isBusy) return;
    this.setData({ isBusy: true, statusMessage: "正在建立微信身份……" });
    try {
      const authState = await auth.login({ wx });
      this.setData({
        authState,
        expiresAt: auth.getSessionExpiresAt(),
        statusMessage: "微信身份已建立。"
      });
    } catch (error) {
      this.setData({
        authState: auth.getAuthState(),
        statusMessage: error && error.message ? error.message : "微信身份暂时没有建立，游客功能仍可使用。"
      });
    } finally {
      this.setData({ isBusy: false });
    }
  },
  async handleWechatLogout() {
    if (this.data.isBusy) return;
    this.setData({ isBusy: true, statusMessage: "正在退出当前身份……" });
    const authState = await auth.logout({ wx });
    this.setData({
      authState,
      expiresAt: "",
      isBusy: false,
      statusMessage: "已退出当前身份。"
    });
  },
  goPrivacy() {
    wx.navigateTo({ url: "/pages/privacy/index" });
  }
});
