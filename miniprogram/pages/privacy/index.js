const { createDreamStorage } = require("../../services/dreamStorage");
const legal = require("../../services/legalDocuments");

Page({
  data: {
    activeDocument: null,
    confirmVisible: false,
    exportText: "",
    message: ""
  },
  onLoad(options) {
    if (options.doc) this.openDocument({ currentTarget: { dataset: { type: options.doc } } });
  },
  openDocument(event) {
    this.setData({ activeDocument: legal.getLegalDocument(event.currentTarget.dataset.type) });
  },
  showClearConfirm() {
    this.setData({ confirmVisible: true });
  },
  hideClearConfirm() {
    this.setData({ confirmVisible: false });
  },
  clearLocalData() {
    createDreamStorage(wx).clearRecords();
    this.setData({ confirmVisible: false, message: "本机梦境数据已清除。" });
  },
  exportData() {
    const exported = createDreamStorage(wx).exportRecords();
    this.setData({
      exportText: JSON.stringify(exported, null, 2),
      message: "已生成个人数据导出内容。"
    });
  }
});
