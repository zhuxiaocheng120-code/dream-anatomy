const { createDreamStorage } = require("../../services/dreamStorage");
const { formatDisplayDate } = require("../../utils/dates");
const { hasResultCard, normalizeResultCard } = require("../../services/resultCard");

Page({
  data: {
    record: null,
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
    this.setData({
      record,
      displayDate: formatDisplayDate(record.createdAt),
      resultCard: hasResultCard(record.dreamResultCard || (record.reportContent && record.reportContent.dreamResultCard))
        ? normalizeResultCard(record.dreamResultCard || (record.reportContent && record.reportContent.dreamResultCard))
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
