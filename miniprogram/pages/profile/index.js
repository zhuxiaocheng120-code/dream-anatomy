const auth = require("../../services/authAdapter");

Page({
  data: {
    authState: auth.getAuthState()
  },
  onShow() {
    this.setData({ authState: auth.getAuthState() });
  },
  goPrivacy() {
    wx.navigateTo({ url: "/pages/privacy/index" });
  }
});
