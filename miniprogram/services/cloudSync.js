const { getConfig } = require("../config/config.example");
const auth = require("./authAdapter");
const { createDreamStorage } = require("./dreamStorage");
const { mapApiError } = require("./errorMessages");

const CLOUD_SYNC_ENABLED_KEY = "dream_anatomy_cloud_sync_enabled_v1";
const CLOUD_SYNC_PROMPT_KEY = "dream_anatomy_cloud_sync_prompt_v1";
const SYNC_BATCH_SIZE = 50;

function getWx(options = {}) {
  return options.wx || (typeof wx !== "undefined" ? wx : null);
}

function getApiBaseUrl(options = {}) {
  const config = { ...getConfig(), ...(options.config || {}) };
  return String(config.API_BASE_URL || "").replace(/\/+$/, "");
}

function createCloudSyncError(code, message, statusCode) {
  const error = new Error(mapApiError(code, message || "梦境同步暂时没有完成，请稍后再试。"));
  error.code = code;
  error.statusCode = statusCode || 0;
  return error;
}

function isCloudSyncEnabled(wxRef) {
  try {
    return wxRef && wxRef.getStorageSync(CLOUD_SYNC_ENABLED_KEY) === true;
  } catch (error) {
    return false;
  }
}

function setCloudSyncEnabled(wxRef, enabled) {
  if (!wxRef || typeof wxRef.setStorageSync !== "function") return false;
  wxRef.setStorageSync(CLOUD_SYNC_ENABLED_KEY, enabled === true);
  return true;
}

function hasPromptBeenHandled(wxRef) {
  try {
    return wxRef && wxRef.getStorageSync(CLOUD_SYNC_PROMPT_KEY) === true;
  } catch (error) {
    return false;
  }
}

function markPromptHandled(wxRef) {
  if (wxRef && typeof wxRef.setStorageSync === "function") {
    wxRef.setStorageSync(CLOUD_SYNC_PROMPT_KEY, true);
  }
}

function hasPendingLocalRecords(wxRef) {
  return createDreamStorage(wxRef).getRecords({ includeDeleted: true })
    .some((record) => record.syncStatus !== "synced");
}

function requestCloud(path, options = {}) {
  const wxRef = getWx(options);
  if (!wxRef || typeof wxRef.request !== "function") {
    return Promise.reject(createCloudSyncError("NETWORK_ERROR", "网络暂时没有连接上，请稍后再试。"));
  }

  return auth.getAccessToken({ wx: wxRef }).then((token) => {
    if (!token) {
      throw createCloudSyncError("AUTH_INVALID", "请先建立微信身份。", 401);
    }

    const config = { ...getConfig(), ...(options.config || {}) };
    return new Promise((resolve, reject) => {
      wxRef.request({
        url: `${getApiBaseUrl(options)}${path}`,
        method: options.method || "GET",
        timeout: config.REQUEST_TIMEOUT_MS,
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        data: options.data || {},
        success(response) {
          const statusCode = response && response.statusCode ? response.statusCode : 0;
          const data = response && response.data ? response.data : {};
          if (statusCode < 200 || statusCode >= 300) {
            const apiError = data && data.error ? data.error : {};
            reject(createCloudSyncError(apiError.code || "UPSTREAM_UNAVAILABLE", apiError.message, statusCode));
            return;
          }
          resolve(data);
        },
        fail() {
          reject(createCloudSyncError("NETWORK_ERROR", "网络暂时没有连接上，请稍后再试。"));
        }
      });
    });
  });
}

function getPendingRecords(storage) {
  return storage.getRecords({ includeDeleted: true })
    .filter((record) => record.syncStatus !== "synced");
}

async function syncNow(options = {}) {
  const wxRef = getWx(options);
  const storage = createDreamStorage(wxRef);
  const pending = getPendingRecords(storage);
  if (!pending.length) {
    return { ok: true, syncedCount: 0, restoredCount: 0 };
  }

  pending.forEach((record) => {
    storage.updateRecord(record.localRecordId, { syncStatus: "syncing" });
  });

  try {
    const combined = {
      records: [],
      restoredRecords: [],
      conflicts: [],
      deletedRecords: []
    };
    for (let index = 0; index < pending.length; index += SYNC_BATCH_SIZE) {
      const batch = pending.slice(index, index + SYNC_BATCH_SIZE);
      const result = await requestCloud("/api/miniprogram/dreams/sync", {
        ...options,
        method: "POST",
        data: { records: batch }
      });
      storage.applySyncResult(result);
      combined.records.push(...(result.records || []));
      combined.restoredRecords.push(...(result.restoredRecords || []));
      combined.conflicts.push(...(result.conflicts || []));
      combined.deletedRecords.push(...(result.deletedRecords || []));
    }
    return {
      ok: true,
      syncedCount: combined.records.length,
      restoredCount: combined.restoredRecords.length,
      conflictCount: combined.conflicts.length
    };
  } catch (error) {
    pending.forEach((record) => {
      const current = storage.getRecords({ includeDeleted: true }).find((item) => item.localRecordId === record.localRecordId);
      if (current && current.syncStatus !== "synced") {
        storage.markSyncFailed(record.localRecordId);
      }
    });
    throw error;
  }
}

async function restoreFromCloud(options = {}) {
  const wxRef = getWx(options);
  const result = await requestCloud("/api/miniprogram/dreams", {
    ...options,
    method: "GET"
  });
  const storage = createDreamStorage(wxRef);
  const merged = storage.mergeCloudRecords(result.records || []);
  storage.applySyncResult({ deletedRecords: result.deletedRecords || [] });
  return { ok: true, restoredCount: merged.restoredCount || 0 };
}

async function deleteCloudRecord(cloudRecordId, options = {}) {
  if (!cloudRecordId) {
    return { ok: false };
  }
  return requestCloud(`/api/miniprogram/dreams/${cloudRecordId}`, {
    ...options,
    method: "DELETE"
  });
}

async function enableSyncAndRun(options = {}) {
  const wxRef = getWx(options);
  setCloudSyncEnabled(wxRef, true);
  const syncResult = await syncNow(options);
  const restoreResult = await restoreFromCloud(options).catch(() => ({ restoredCount: 0 }));
  return {
    ok: true,
    syncedCount: syncResult.syncedCount || 0,
    restoredCount: restoreResult.restoredCount || 0,
    conflictCount: syncResult.conflictCount || 0
  };
}

function shouldPromptInitialSync(wxRef) {
  return !isCloudSyncEnabled(wxRef) && !hasPromptBeenHandled(wxRef) && hasPendingLocalRecords(wxRef);
}

function createCloudSyncController(wxRef, options = {}) {
  return {
    syncNow: () => syncNow({ ...options, wx: wxRef }),
    restoreFromCloud: () => restoreFromCloud({ ...options, wx: wxRef }),
    enableSyncAndRun: () => enableSyncAndRun({ ...options, wx: wxRef })
  };
}

async function maybePromptInitialSync({ wx: wxRef, onPrompt, ...options } = {}) {
  if (!shouldPromptInitialSync(wxRef)) {
    return { prompted: false, syncedCount: 0, restoredCount: 0 };
  }

  const accepted = typeof onPrompt === "function" ? await onPrompt() : false;
  markPromptHandled(wxRef);
  if (!accepted) {
    return { prompted: true, accepted: false, syncedCount: 0, restoredCount: 0 };
  }

  const result = await enableSyncAndRun({ ...options, wx: wxRef });
  return { prompted: true, accepted: true, ...result };
}

module.exports = {
  CLOUD_SYNC_ENABLED_KEY,
  CLOUD_SYNC_PROMPT_KEY,
  SYNC_BATCH_SIZE,
  createCloudSyncError,
  createCloudSyncController,
  deleteCloudRecord,
  enableSyncAndRun,
  hasPendingLocalRecords,
  isCloudSyncEnabled,
  markPromptHandled,
  maybePromptInitialSync,
  requestCloud,
  restoreFromCloud,
  setCloudSyncEnabled,
  shouldPromptInitialSync,
  syncNow
};
