const auth = require("../../services/authAdapter");
const cloudSync = require("../../services/cloudSync");

function createSyncMessage(result = {}) {
  const syncedCount = result.syncedCount || 0;
  const restoredCount = result.restoredCount || 0;
  if (syncedCount && restoredCount) {
    return `已同步 ${syncedCount} 条本机梦境，已恢复 ${restoredCount} 条梦境记录。`;
  }
  if (syncedCount) {
    return `已同步 ${syncedCount} 条本机梦境。`;
  }
  if (restoredCount) {
    return `已恢复 ${restoredCount} 条梦境记录。`;
  }
  return "梦境档案已是最新。";
}

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
  async handlePostLoginSync() {
    if (cloudSync.shouldPromptInitialSync(wx)) {
      wx.showModal({
        title: "云端同步",
        content: "检测到本机保存的梦境记录，是否同步到云端，以便更换设备后恢复？",
        confirmText: "同步到云端",
        cancelText: "暂不处理",
        success: async (result) => {
          cloudSync.markPromptHandled(wx);
          if (!result.confirm) {
            this.setData({ statusMessage: "已暂不处理。你可以稍后在数据管理中手动同步。" });
            return;
          }
          await this.handleManualSync();
        }
      });
      return;
    }
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
      await this.handlePostLoginSync();
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
    cloudSync.setCloudSyncEnabled(wx, false);
    this.setData({
      authState,
      expiresAt: "",
      isBusy: false,
      statusMessage: "已退出当前身份。"
    });
  },
  async handleManualSync() {
    if (this.data.isBusy) return;
    if (!this.data.authState.authenticated) {
      this.setData({ statusMessage: "请先建立微信身份，再同步梦境档案。" });
      return;
    }
    this.setData({ isBusy: true, statusMessage: "正在同步梦境档案……" });
    try {
      const result = await cloudSync.enableSyncAndRun({ wx });
      cloudSync.markPromptHandled(wx);
      this.setData({ statusMessage: createSyncMessage(result) });
    } catch (error) {
      this.setData({ statusMessage: error && error.message ? error.message : "同步暂时没有完成，本机梦境仍会保留。" });
    } finally {
      this.setData({ isBusy: false });
    }
  },
  goPrivacy() {
    wx.navigateTo({ url: "/pages/privacy/index" });
  }
});
