const { createDreamStorage } = require("../../services/dreamStorage");
const { formatDisplayDate } = require("../../utils/dates");
const {
  createMiniProgramDisplayTitle,
  formatMiniProgramAnalysisType
} = require("../../utils/complianceText");

function createDisplayRecord(record) {
  return {
    ...record,
    displayDate: formatDisplayDate(record.createdAt),
    displayAnalysisType: formatMiniProgramAnalysisType(record.analysisType),
    syncStatusLabel: formatSyncStatus(record.syncStatus),
    title: createMiniProgramDisplayTitle(record)
  };
}

function formatSyncStatus(syncStatus) {
  if (syncStatus === "synced") return "已同步";
  if (syncStatus === "sync_failed") return "同步失败";
  return "待同步";
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
