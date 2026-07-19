const { createDreamStorage } = require("../../services/dreamStorage");
const { formatDisplayDate } = require("../../utils/dates");

function getStorage() {
  return createDreamStorage(wx);
}

Page({
  data: {
    recentRecords: []
  },
  onShow() {
    const records = getStorage().getRecords().slice(0, 3).map((record) => ({
      ...record,
      displayDate: formatDisplayDate(record.createdAt),
      title: (record.reportContent && record.reportContent.analysis && record.reportContent.analysis.dreamSummary) || record.dreamText || "未命名梦境"
    }));
    this.setData({ recentRecords: records });
  },
  goQuick() {
    wx.navigateTo({ url: "/pages/quick/index" });
  },
  goJournal() {
    wx.navigateTo({ url: "/pages/journal/index" });
  },
  goPrivacy() {
    wx.navigateTo({ url: "/pages/privacy/index" });
  },
  goProfile() {
    wx.navigateTo({ url: "/pages/profile/index" });
  },
  showDeepComingSoon() {
    this.setData({ deepHint: "深度引导正在开发中，暂时不能进入。" });
  },
  openRecord(event) {
    wx.navigateTo({ url: `/pages/detail/index?id=${event.currentTarget.dataset.id}` });
  }
});
