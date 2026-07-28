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

function normalizeRecord(record = {}) {
  const now = new Date().toISOString();
  const reportContent = record.reportContent && typeof record.reportContent === "object" && !Array.isArray(record.reportContent)
    ? record.reportContent
    : {};
  return {
    localRecordId: record.localRecordId || createLocalRecordId(),
    cloudRecordId: typeof record.cloudRecordId === "string" ? record.cloudRecordId : "",
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || record.createdAt || now,
    deletedAt: typeof record.deletedAt === "string" ? record.deletedAt : "",
    lastSyncedAt: typeof record.lastSyncedAt === "string" ? record.lastSyncedAt : "",
    syncStatus: record.syncStatus || (record.cloudRecordId ? "synced" : "local_only"),
    dreamText: typeof record.dreamText === "string" ? record.dreamText : "",
    sleepQuality: record.sleepQuality || "未记录",
    analysisType: record.analysisType || "快速解析",
    reportContent,
    dreamResultCard: record.dreamResultCard || reportContent.dreamResultCard || null,
    storageVersion: record.storageVersion || STORAGE_VERSION
  };
}

function createDreamStorage(wxRef) {
  function getAllRecords() {
    return readRecords(wxRef)
      .filter((record) => record && typeof record === "object")
      .map(normalizeRecord)
      .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  }

  function getRecords(options = {}) {
    return getAllRecords().filter((record) => options.includeDeleted || !record.deletedAt);
  }

  function replaceRecords(records) {
    writeRecords(wxRef, records.map(normalizeRecord));
    return { ok: true };
  }

  function updateRecord(localRecordId, patch = {}) {
    const records = getAllRecords();
    const index = records.findIndex((record) => record.localRecordId === localRecordId);
    if (index < 0) return { ok: false };
    const contentKeys = ["dreamText", "sleepQuality", "analysisType", "reportContent", "dreamResultCard"];
    const hasContentPatch = contentKeys.some((key) => Object.prototype.hasOwnProperty.call(patch, key));
    const nextPatch = { ...patch };
    if (hasContentPatch && records[index].syncStatus === "synced" && !Object.prototype.hasOwnProperty.call(nextPatch, "syncStatus")) {
      nextPatch.syncStatus = "local_only";
    }
    const next = normalizeRecord({
      ...records[index],
      ...nextPatch,
      localRecordId,
      updatedAt: patch.updatedAt || (hasContentPatch ? new Date().toISOString() : records[index].updatedAt) || new Date().toISOString()
    });
    records[index] = next;
    writeRecords(wxRef, records);
    return { ok: true, record: next };
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
    const record = normalizeRecord({
      localRecordId: input.localRecordId || createLocalRecordId(),
      cloudRecordId: input.cloudRecordId || "",
      createdAt: input.createdAt || now,
      updatedAt: now,
      deletedAt: input.deletedAt || "",
      lastSyncedAt: input.lastSyncedAt || "",
      syncStatus: input.syncStatus || (input.cloudRecordId ? "synced" : "local_only"),
      dreamText: typeof input.dreamText === "string" ? input.dreamText : "",
      sleepQuality: input.sleepQuality || "未记录",
      analysisType: input.analysisType || "快速解析",
      reportContent: input.reportContent || {},
      dreamResultCard: input.dreamResultCard || null,
      storageVersion: STORAGE_VERSION
    });
    writeRecords(wxRef, [record, ...getAllRecords()]);
    return { ok: true, record };
  }

  function getRecord(localRecordId) {
    return getRecords().find((record) => record.localRecordId === localRecordId) || null;
  }

  function markSynced(localRecordId, cloudInfo = {}) {
    return updateRecord(localRecordId, {
      cloudRecordId: cloudInfo.cloudRecordId || cloudInfo.id || "",
      lastSyncedAt: cloudInfo.lastSyncedAt || cloudInfo.syncedAt || new Date().toISOString(),
      syncStatus: "synced",
      deletedAt: cloudInfo.deletedAt || ""
    });
  }

  function markSyncFailed(localRecordId) {
    return updateRecord(localRecordId, {
      syncStatus: "sync_failed"
    });
  }

  function mergeCloudRecords(cloudRecords = []) {
    const records = getAllRecords();
    let restoredCount = 0;
    cloudRecords.forEach((cloudRecord) => {
      const normalized = normalizeRecord({
        ...cloudRecord,
        syncStatus: "synced",
        lastSyncedAt: cloudRecord.lastSyncedAt || new Date().toISOString()
      });
      const index = records.findIndex((record) => record.localRecordId === normalized.localRecordId);
      if (index >= 0) {
        if (records[index].deletedAt) {
          return;
        }
        if (records[index].syncStatus !== "synced") {
          records.push(normalizeRecord({
            ...normalized,
            localRecordId: `${normalized.localRecordId}_conflict_${Date.now().toString(36)}`
          }));
          return;
        }
        records[index] = normalized;
      } else {
        records.push(normalized);
        if (!normalized.deletedAt) restoredCount += 1;
      }
    });
    writeRecords(wxRef, records);
    return { ok: true, restoredCount };
  }

  function replaceWithCloudRecord(cloudRecord = {}) {
    const records = getAllRecords();
    const normalized = normalizeRecord({
      ...cloudRecord,
      syncStatus: "synced",
      lastSyncedAt: cloudRecord.lastSyncedAt || new Date().toISOString()
    });
    const index = records.findIndex((record) => record.localRecordId === normalized.localRecordId);
    if (index >= 0) {
      records[index] = normalized;
    } else {
      records.push(normalized);
    }
    writeRecords(wxRef, records);
    return normalized;
  }

  function applySyncResult(result = {}) {
    (result.records || []).forEach((record) => {
      markSynced(record.localRecordId, record);
    });
    (result.restoredRecords || []).forEach(replaceWithCloudRecord);
    (result.deletedRecords || []).forEach((record) => {
      updateRecord(record.localRecordId, {
        cloudRecordId: record.cloudRecordId || "",
        deletedAt: record.deletedAt || new Date().toISOString(),
        lastSyncedAt: record.lastSyncedAt || new Date().toISOString(),
        syncStatus: "synced"
      });
    });
    (result.conflicts || []).forEach((conflict) => {
      if (!conflict || !conflict.cloudRecord) return;
      if (conflict.localRecordId) {
        updateRecord(conflict.localRecordId, { syncStatus: "sync_failed" });
      }
      const conflictRecord = normalizeRecord({
        ...conflict.cloudRecord,
        localRecordId: `${conflict.cloudRecord.localRecordId || conflict.localRecordId}_conflict_${Date.now().toString(36)}`,
        syncStatus: "synced",
        lastSyncedAt: conflict.cloudRecord.lastSyncedAt || new Date().toISOString()
      });
      writeRecords(wxRef, [conflictRecord, ...getAllRecords()]);
    });
    return { ok: true };
  }

  function deleteRecord(localRecordId) {
    const record = getAllRecords().find((item) => item.localRecordId === localRecordId);
    if (!record) return { ok: false };
    const deletedAt = new Date().toISOString();
    return updateRecord(localRecordId, {
      deletedAt,
      updatedAt: deletedAt,
      syncStatus: "sync_failed"
    });
  }

  function clearRecords() {
    writeRecords(wxRef, []);
    return { ok: true };
  }

  function clearCloudMetadata() {
    const records = getAllRecords().map((record) => normalizeRecord({
      ...record,
      cloudRecordId: "",
      lastSyncedAt: "",
      syncStatus: record.deletedAt ? "sync_failed" : "local_only"
    }));
    writeRecords(wxRef, records);
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
    applySyncResult,
    clearCloudMetadata,
    clearRecords,
    deleteRecord,
    exportRecords,
    getRecord,
    getRecords,
    getStorageKey: () => STORAGE_KEY,
    markSynced,
    markSyncFailed,
    mergeCloudRecords,
    replaceWithCloudRecord,
    replaceRecords,
    updateRecord,
    saveRecord
  };
}

module.exports = { MAX_RECORDS, STORAGE_KEY, STORAGE_VERSION, createDreamStorage, normalizeRecord };
