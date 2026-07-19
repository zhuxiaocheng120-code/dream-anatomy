const { createDreamStorage } = require("../../services/dreamStorage");
const { formatDisplayDate } = require("../../utils/dates");

function createDisplayRecord(record) {
  const analysis = record.reportContent && record.reportContent.analysis ? record.reportContent.analysis : {};
  return {
    ...record,
    displayDate: formatDisplayDate(record.createdAt),
    title: analysis.dreamSummary || record.dreamText || "未命名梦境"
  };
}

Page({
  data: {
    records: []
  },
  onShow() {
    this.setData({ records: createDreamStorage(wx).getRecords().map(createDisplayRecord) });
  },
  goQuick() {
    wx.navigateTo({ url: "/pages/quick/index" });
  },
  openRecord(event) {
    wx.navigateTo({ url: `/pages/detail/index?id=${event.currentTarget.dataset.id}` });
  }
});
