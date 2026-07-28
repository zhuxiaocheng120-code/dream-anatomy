const auth = require("../../services/authAdapter");
const accountBinding = require("../../services/accountBinding");
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
    bindingCode: "",
    bindingStatus: "unbound",
    expiresAt: "",
    isBusy: false,
    statusMessage: ""
  },
  async onShow() {
    const authState = await auth.initialize({ wx });
    this.setData({
      authState,
      bindingStatus: "unbound",
      expiresAt: auth.getSessionExpiresAt(),
      statusMessage: ""
    });
    if (authState.authenticated) {
      accountBinding.getBindingStatus({ wx })
        .then((result) => {
          this.setData({ bindingStatus: result.status || "unbound" });
        })
        .catch(() => {});
    }
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
  handleBindingCodeInput(event = {}) {
    this.setData({ bindingCode: event.detail && event.detail.value ? event.detail.value : "" });
  },
  async handleConfirmBinding() {
    if (this.data.isBusy) return;
    if (!this.data.authState.authenticated) {
      this.setData({ statusMessage: "请先建立微信身份，再绑定邮箱账户。" });
      return;
    }
    if (!this.data.bindingCode.trim()) {
      this.setData({ statusMessage: "请输入网页端生成的绑定码。" });
      return;
    }

    wx.showModal({
      title: "绑定邮箱账户",
      content: "绑定后，网页端与小程序端的梦境记录将合并并共享。",
      confirmText: "确认绑定",
      cancelText: "再想想",
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ isBusy: true, statusMessage: "正在完成账户绑定……" });
        try {
          const bindingResult = await accountBinding.confirmBinding(this.data.bindingCode, { wx });
          let syncMessage = "";
          try {
            const syncResult = await cloudSync.enableSyncAndRun({ wx });
            syncMessage = createSyncMessage(syncResult);
          } catch (error) {
            syncMessage = "本机梦境仍会保留，可稍后手动同步。";
          }
          this.setData({
            bindingCode: "",
            bindingStatus: "bound",
            statusMessage: bindingResult.message || `已完成账户绑定，梦境记录已合并。${syncMessage ? ` ${syncMessage}` : ""}`
          });
        } catch (error) {
          this.setData({ statusMessage: error && error.message ? error.message : "账户绑定暂时没有完成，请稍后再试。" });
        } finally {
          this.setData({ isBusy: false });
        }
      }
    });
  },
  goPrivacy() {
    wx.navigateTo({ url: "/pages/privacy/index" });
  }
});
