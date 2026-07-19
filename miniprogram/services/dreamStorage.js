const { createLocalRecordId } = require("../utils/ids");

const STORAGE_KEY = "dream_anatomy_guest_records_v1";
const STORAGE_VERSION = 1;
const MAX_RECORDS = 100;

function readRecords(wxRef) {
  try {
    const value = wxRef.getStorageSync(STORAGE_KEY);
    if (!value) return [];
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function writeRecords(wxRef, records) {
  wxRef.setStorageSync(STORAGE_KEY, records);
}

function createDreamStorage(wxRef) {
  function getRecords() {
    return readRecords(wxRef)
      .filter((record) => record && typeof record === "object")
      .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  }

  function saveRecord(input = {}) {
    const records = getRecords();
    if (records.length >= MAX_RECORDS) {
      return {
        ok: false,
        code: "LOCAL_RECORD_LIMIT_REACHED",
        message: "本机梦境记录已达到 100 条，请先导出或删除旧记录。"
      };
    }
    const now = new Date().toISOString();
    const record = {
      localRecordId: input.localRecordId || createLocalRecordId(),
      createdAt: input.createdAt || now,
      updatedAt: now,
      dreamText: typeof input.dreamText === "string" ? input.dreamText : "",
      sleepQuality: input.sleepQuality || "未记录",
      analysisType: input.analysisType || "快速解析",
      reportContent: input.reportContent || {},
      dreamResultCard: input.dreamResultCard || null,
      storageVersion: STORAGE_VERSION
    };
    writeRecords(wxRef, [record, ...records]);
    return { ok: true, record };
  }

  function getRecord(localRecordId) {
    return getRecords().find((record) => record.localRecordId === localRecordId) || null;
  }

  function deleteRecord(localRecordId) {
    const before = getRecords();
    const after = before.filter((record) => record.localRecordId !== localRecordId);
    writeRecords(wxRef, after);
    return { ok: after.length !== before.length };
  }

  function clearRecords() {
    writeRecords(wxRef, []);
    return { ok: true };
  }

  function exportRecords() {
    return {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      records: getRecords()
    };
  }

  return {
    clearRecords,
    deleteRecord,
    exportRecords,
    getRecord,
    getRecords,
    getStorageKey: () => STORAGE_KEY,
    saveRecord
  };
}

module.exports = { MAX_RECORDS, STORAGE_KEY, STORAGE_VERSION, createDreamStorage };
