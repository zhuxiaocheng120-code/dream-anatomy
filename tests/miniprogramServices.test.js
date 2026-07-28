const assert = require("node:assert/strict");
const test = require("node:test");

function createWxHarness(options = {}) {
  const storage = new Map(Object.entries(options.storage || {}));
  const requests = [];
  const wx = {
    login(payload = {}) {
      const response = typeof options.login === "function"
        ? options.login(payload)
        : { code: "wx-code-1" };
      setImmediate(() => {
        if (response.fail) {
          payload.fail(response.fail);
        } else {
          payload.success(response);
        }
      });
    },
    request(payload) {
      requests.push(payload);
      const response = typeof options.respond === "function"
        ? options.respond(payload)
        : { statusCode: 200, data: { analysis: { dreamSummary: "梦见学校走廊。", coreTheme: "寻找方向。", coreInterpretation: "可能与准备有关。" }, dreamResultCard: { coreInsight: "也许在寻找方向。" } } };
      setImmediate(() => {
        if (response.fail) {
          payload.fail(response.fail);
        } else {
          payload.success(response);
        }
      });
    },
    getStorageSync(key) {
      return storage.has(key) ? storage.get(key) : "";
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
    removeStorageSync(key) {
      storage.delete(key);
    }
  };

  return { wx, requests, storage };
}

test("mini program config, auth, and analytics adapters keep guest fallback and establish explicit WeChat identity", async () => {
  const { getConfig } = require("../miniprogram/config/config.example");
  const auth = require("../miniprogram/services/authAdapter");
  const analytics = require("../miniprogram/services/productAnalyticsAdapter");
  const { wx, requests, storage } = createWxHarness({
    respond: (payload) => {
      if (payload.url.endsWith("/api/v1/wechat-auth/login")) {
        return {
          statusCode: 200,
          data: {
            sessionToken: "wechat-session-token",
            expiresAt: "2026-07-27T00:00:00.000Z",
            account: { mode: "wechat", authenticated: true, cloudSyncAvailable: true }
          }
        };
      }
      if (payload.url.endsWith("/api/v1/wechat-auth/session")) {
        return {
          statusCode: 200,
          data: {
            expiresAt: "2026-07-27T00:00:00.000Z",
            account: { mode: "wechat", authenticated: true, cloudSyncAvailable: true }
          }
        };
      }
      if (payload.url.endsWith("/api/v1/wechat-auth/logout")) {
        return { statusCode: 200, data: { ok: true } };
      }
      return { statusCode: 500, data: { error: { code: "UPSTREAM_UNAVAILABLE" } } };
    }
  });
  const config = getConfig();
  assert.equal(config.API_BASE_URL, "https://dream-anatomy.onrender.com");
  assert.equal(config.REQUEST_TIMEOUT_MS, 45000);
  auth.clearLocalSession({ wx });
  assert.deepEqual(auth.getAuthState(), { mode: "guest", authenticated: false, cloudSyncAvailable: false });
  assert.deepEqual(await auth.initialize({ wx }), { mode: "guest", authenticated: false, cloudSyncAvailable: false });

  const loggedIn = await auth.login({ wx });
  assert.deepEqual(loggedIn, { mode: "wechat", authenticated: true, cloudSyncAvailable: true });
  assert.equal(auth.isCloudSyncAvailable(), true);
  assert.equal(await auth.getAccessToken({ wx }), "wechat-session-token");
  assert.equal(storage.has(auth.WECHAT_SESSION_TOKEN_KEY), true);
  assert.equal(requests[0].url, "https://dream-anatomy.onrender.com/api/v1/wechat-auth/login");
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].data.code, "wx-code-1");
  assert.equal(Object.hasOwn(requests[0].data, "openid"), false);
  assert.equal(Object.hasOwn(requests[0].data, "accountId"), false);

  const restored = await auth.initialize({ wx });
  assert.deepEqual(restored, { mode: "wechat", authenticated: true, cloudSyncAvailable: true });
  assert.equal(requests[1].url, "https://dream-anatomy.onrender.com/api/v1/wechat-auth/session");
  assert.equal(requests[1].header.Authorization, "Bearer wechat-session-token");

  assert.deepEqual(await auth.logout({ wx }), { mode: "guest", authenticated: false, cloudSyncAvailable: false });
  assert.equal(requests[2].url, "https://dream-anatomy.onrender.com/api/v1/wechat-auth/logout");
  assert.equal(requests[2].header.Authorization, "Bearer wechat-session-token");
  assert.equal(storage.has(auth.WECHAT_SESSION_TOKEN_KEY), false);
  assert.deepEqual(auth.getAuthState(), { mode: "guest", authenticated: false, cloudSyncAvailable: false });
  assert.equal(auth.isCloudSyncAvailable(), false);
  assert.equal(analytics.trackEvent("app_opened"), false);
  assert.equal(analytics.flush(), false);
  auth.clearLocalSession({ wx });
});

test("mini program auth clears invalid local session and keeps guest features available", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const cloudSync = require("../miniprogram/services/cloudSync");
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const { wx, storage } = createWxHarness({
    storage: {
      [auth.WECHAT_SESSION_TOKEN_KEY]: "expired-token",
      [cloudSync.CLOUD_SYNC_ENABLED_KEY]: true,
      [cloudSync.CLOUD_SYNC_PROMPT_KEY]: true
    },
    respond: () => ({
      statusCode: 401,
      data: { error: { code: "AUTH_INVALID", message: "微信登录状态已失效，请重新登录。" } }
    })
  });
  const dreamStorage = createDreamStorage(wx);
  const saved = dreamStorage.saveRecord({
    localRecordId: "previous-account-record",
    cloudRecordId: "cloud-from-previous-account",
    dreamText: "上一身份同步过的本机记录",
    reportContent: {},
    syncStatus: "synced",
    lastSyncedAt: "2026-07-28T00:00:00.000Z"
  });
  assert.equal(saved.record.syncStatus, "synced");

  assert.deepEqual(await auth.initialize({ wx }), { mode: "guest", authenticated: false, cloudSyncAvailable: false });
  assert.equal(storage.has(auth.WECHAT_SESSION_TOKEN_KEY), false);
  assert.equal(storage.has(cloudSync.CLOUD_SYNC_ENABLED_KEY), false);
  assert.equal(storage.has(cloudSync.CLOUD_SYNC_PROMPT_KEY), false);
  const scrubbed = dreamStorage.getRecords({ includeDeleted: true }).find((record) => record.localRecordId === "previous-account-record");
  assert.equal(scrubbed.cloudRecordId, "");
  assert.equal(scrubbed.lastSyncedAt, "");
  assert.equal(scrubbed.syncStatus, "local_only");
  await assert.rejects(
    () => auth.login({ wx: createWxHarness({ login: () => ({ fail: { errMsg: "login failed" } }) }).wx }),
    (error) => /微信身份/.test(error.message)
  );
  assert.deepEqual(auth.getAuthState(), { mode: "guest", authenticated: false, cloudSyncAvailable: false });
});

test("mini program account binding requires WeChat identity and confirms with bearer token only", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const accountBinding = require("../miniprogram/services/accountBinding");
  auth.clearLocalSession({ wx: createWxHarness().wx });

  const guestHarness = createWxHarness();
  await assert.rejects(
    () => accountBinding.confirmBinding("ABCD2345EF", { wx: guestHarness.wx }),
    (error) => error.code === "AUTH_INVALID" && /微信身份/.test(error.message)
  );

  const { wx, requests } = createWxHarness({
    storage: {
      [auth.WECHAT_SESSION_TOKEN_KEY]: "wechat-session-token"
    },
    respond: (payload) => {
      if (payload.url.endsWith("/api/miniprogram/account-binding/confirm")) {
        return { statusCode: 200, data: { status: "bound", message: "已完成账户绑定，梦境记录已合并。" } };
      }
      if (payload.url.endsWith("/api/miniprogram/account-binding/status")) {
        return { statusCode: 200, data: { status: "bound" } };
      }
      return { statusCode: 500, data: { error: { code: "UPSTREAM_UNAVAILABLE" } } };
    }
  });

  const result = await accountBinding.confirmBinding("ABCD-2345-EF", { wx });
  const status = await accountBinding.getBindingStatus({ wx });

  assert.equal(result.status, "bound");
  assert.equal(status.status, "bound");
  assert.equal(requests[0].url, "https://dream-anatomy.onrender.com/api/miniprogram/account-binding/confirm");
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].header.Authorization, "Bearer wechat-session-token");
  assert.deepEqual(requests[0].data, {
    bindingCode: "ABCD2345EF",
    confirmMerge: true
  });
  assert.equal(Object.hasOwn(requests[0].data, "userId"), false);
  assert.equal(Object.hasOwn(requests[0].data, "openid"), false);
  assert.equal(requests[1].url, "https://dream-anatomy.onrender.com/api/miniprogram/account-binding/status");
  assert.equal(requests[1].header.Authorization, "Bearer wechat-session-token");
});

test("mini program account binding maps safe errors without exposing identifiers", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const accountBinding = require("../miniprogram/services/accountBinding");
  const { wx } = createWxHarness({
    storage: {
      [auth.WECHAT_SESSION_TOKEN_KEY]: "wechat-session-token"
    },
    respond: () => ({
      statusCode: 400,
      data: { error: { code: "ACCOUNT_BINDING_INVALID", message: "绑定码无效或已过期，请重新生成。" } }
    })
  });

  await assert.rejects(
    () => accountBinding.confirmBinding("BAD-CODE", { wx }),
    (error) => error.code === "ACCOUNT_BINDING_INVALID" &&
      /绑定码/.test(error.message) &&
      !/openid|unionid|auth-user|wechat-account|session-token/i.test(error.message)
  );
});

test("quick analysis request uses Render backend structure and no Authorization header", async () => {
  const { requestQuickAnalysis } = require("../miniprogram/services/apiClient");
  const { wx, requests } = createWxHarness({
    respond: () => ({
      statusCode: 200,
      data: {
        analysis: {
          dreamSummary: "你梦见自己在学校走廊寻找教室。",
          coreTheme: "寻找方向与准备感。",
          coreInterpretation: "这可能与最近正在靠近某个选择有关。"
        },
        dreamResultCard: { coreInsight: "也许你正在靠近一个还没准备好的入口。" },
        dreamResultCardStatus: "ai_generated"
      }
    })
  });

  const result = await requestQuickAnalysis("梦见在学校找教室", { wx });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://dream-anatomy.onrender.com/api/v1/dream-analysis");
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].timeout, 45000);
  assert.equal(requests[0].header["Content-Type"], "application/json");
  assert.equal(Object.hasOwn(requests[0].header, "Authorization"), false);
  assert.deepEqual(requests[0].data, {
    analysisType: "quick",
    dreamText: "梦见在学校找教室",
    clientPlatform: "wechat_mini_program"
  });
  assert.equal(result.analysis.dreamSummary, "你梦见自己在学校走廊寻找教室。");
  assert.equal(result.dreamResultCardStatus, "ai_generated");
});

test("quick analysis maps stable errors and never falls back to local mock", async () => {
  const { requestQuickAnalysis } = require("../miniprogram/services/apiClient");
  const { mapApiError } = require("../miniprogram/services/errorMessages");

  assert.match(mapApiError("DAILY_LIMIT_REACHED"), /免费整理次数/);
  assert.match(mapApiError("RATE_LIMITED"), /太频繁/);
  assert.match(mapApiError("UPSTREAM_TIMEOUT"), /及时回应/);
  assert.match(mapApiError("FEATURE_DISABLED"), /正在开发/);

  const { wx } = createWxHarness({
    respond: () => ({
      statusCode: 429,
      data: { error: { code: "DAILY_LIMIT_REACHED", message: "今天的免费解析次数已经用完，稍后再来继续记录梦境。" } }
    })
  });

  await assert.rejects(
    () => requestQuickAnalysis("梦见海", { wx }),
    (error) => error.code === "DAILY_LIMIT_REACHED" && /免费整理次数/.test(error.message) && !/mock|示例/.test(error.message)
  );

  const failed = createWxHarness({ respond: () => ({ fail: { errMsg: "request:fail timeout" } }) });
  await assert.rejects(
    () => requestQuickAnalysis("梦见海", { wx: failed.wx }),
    (error) => error.code === "NETWORK_ERROR" && !/mock|示例/.test(error.message)
  );
});

test("quick analysis controller prevents duplicate submit while in flight", async () => {
  const { createQuickAnalysisController } = require("../miniprogram/services/apiClient");
  let resolveRequest;
  let count = 0;
  const controller = createQuickAnalysisController({
    requestQuickAnalysis: async () => {
      count += 1;
      return new Promise((resolve) => { resolveRequest = resolve; });
    }
  });

  const first = controller.submit("梦见飞行");
  const second = controller.submit("梦见飞行");
  assert.equal(controller.isSubmitting(), true);
  assert.strictEqual(first, second);
  assert.equal(count, 1);

  resolveRequest({ analysis: { dreamSummary: "梦见飞行。" } });
  const result = await first;
  assert.equal(result.analysis.dreamSummary, "梦见飞行。");
  assert.equal(controller.isSubmitting(), false);
});

test("dream storage saves, reads, exports, deletes, clears, and enforces schema limits", () => {
  const { createDreamStorage, STORAGE_KEY, STORAGE_VERSION, MAX_RECORDS } = require("../miniprogram/services/dreamStorage");
  const { wx } = createWxHarness();
  const storage = createDreamStorage(wx);

  const saved = storage.saveRecord({
    dreamText: "梦见一条河",
    sleepQuality: "未记录",
    analysisType: "快速解析",
    reportContent: { analysis: { dreamSummary: "河流梦。" } },
    dreamResultCard: { coreInsight: "也许在流动。" }
  });

  assert.equal(saved.ok, true);
  assert.equal(saved.record.storageVersion, STORAGE_VERSION);
  assert.match(saved.record.localRecordId, /^local_/);
  assert.equal(storage.getRecords().length, 1);
  assert.equal(storage.getRecord(saved.record.localRecordId).dreamText, "梦见一条河");

  const exported = storage.exportRecords();
  assert.equal(exported.exportVersion, 1);
  assert.equal(exported.records.length, 1);
  assert.doesNotMatch(JSON.stringify(exported), /token|principal_hash|Authorization/i);

  assert.equal(storage.deleteRecord(saved.record.localRecordId).ok, true);
  assert.equal(storage.getRecords().length, 0);

  wx.setStorageSync(STORAGE_KEY, "{bad json");
  assert.deepEqual(storage.getRecords(), []);

  wx.setStorageSync(STORAGE_KEY, []);
  for (let index = 0; index < MAX_RECORDS; index += 1) {
    assert.equal(storage.saveRecord({ dreamText: `梦 ${index}`, reportContent: {}, dreamResultCard: null }).ok, true);
  }
  const overflow = storage.saveRecord({ dreamText: "第 101 个梦", reportContent: {}, dreamResultCard: null });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.code, "LOCAL_RECORD_LIMIT_REACHED");
  assert.match(overflow.message, /导出或删除旧记录/);

  assert.equal(storage.clearRecords().ok, true);
  assert.equal(storage.getRecords().length, 0);
});

test("dream storage normalizes sync metadata and preserves delete tombstones for cloud sync", () => {
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const { wx } = createWxHarness();
  const storage = createDreamStorage(wx);

  const saved = storage.saveRecord({
    dreamText: "梦见一扇门",
    reportContent: { analysis: { dreamSummary: "门的记录。" } }
  });

  assert.equal(saved.ok, true);
  assert.equal(saved.record.syncStatus, "local_only");
  assert.equal(saved.record.cloudRecordId, "");
  assert.equal(saved.record.lastSyncedAt, "");
  assert.equal(typeof saved.record.updatedAt, "string");

  const marked = storage.markSynced(saved.record.localRecordId, {
    cloudRecordId: "cloud-one",
    lastSyncedAt: "2026-07-28T00:00:00.000Z"
  });
  assert.equal(marked.ok, true);
  assert.equal(storage.getRecord(saved.record.localRecordId).syncStatus, "synced");
  assert.equal(storage.getRecord(saved.record.localRecordId).cloudRecordId, "cloud-one");

  const deleted = storage.deleteRecord(saved.record.localRecordId);
  assert.equal(deleted.ok, true);
  assert.equal(storage.getRecords().length, 0);
  const tombstones = storage.getRecords({ includeDeleted: true });
  assert.equal(tombstones.length, 1);
  assert.equal(tombstones[0].deletedAt.length > 0, true);
  assert.equal(tombstones[0].syncStatus, "sync_failed");
});

test("cloud sync posts authenticated local records and marks them synced", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const cloudSync = require("../miniprogram/services/cloudSync");
  const { wx, requests, storage: rawStorage } = createWxHarness({
    storage: { [auth.WECHAT_SESSION_TOKEN_KEY]: "wechat-session-token" },
    respond: (payload) => {
      if (payload.url.endsWith("/api/v1/wechat-auth/session")) {
        return {
          statusCode: 200,
          data: {
            expiresAt: "2026-07-29T00:00:00.000Z",
            account: { mode: "wechat", authenticated: true, cloudSyncAvailable: true }
          }
        };
      }
      if (payload.url.endsWith("/api/miniprogram/dreams/sync")) {
        return {
          statusCode: 200,
          data: {
            ok: true,
            records: [{
              localRecordId: payload.data.records[0].localRecordId,
              cloudRecordId: "cloud-one",
              syncStatus: "synced",
              lastSyncedAt: "2026-07-28T00:00:00.000Z"
            }],
            restoredRecords: [],
            conflicts: [],
            deletedRecords: []
          }
        };
      }
      return { statusCode: 500, data: { error: { code: "UPSTREAM_UNAVAILABLE" } } };
    }
  });
  auth.clearLocalSession({ wx });
  rawStorage.set(auth.WECHAT_SESSION_TOKEN_KEY, "wechat-session-token");
  const dreamStorage = createDreamStorage(wx);
  const saved = dreamStorage.saveRecord({ dreamText: "梦见一扇门", reportContent: {} });
  cloudSync.setCloudSyncEnabled(wx, true);

  const result = await cloudSync.syncNow({ wx });

  assert.equal(result.ok, true);
  assert.equal(requests.some((item) => item.url.endsWith("/api/v1/dream-analysis")), false);
  const syncRequest = requests.find((item) => item.url.endsWith("/api/miniprogram/dreams/sync"));
  assert.equal(syncRequest.method, "POST");
  assert.equal(syncRequest.header.Authorization, "Bearer wechat-session-token");
  assert.equal(syncRequest.data.records[0].localRecordId, saved.record.localRecordId);
  assert.equal(syncRequest.data.records[0].dreamText, "梦见一扇门");
  const synced = dreamStorage.getRecord(saved.record.localRecordId);
  assert.equal(synced.syncStatus, "synced");
  assert.equal(synced.cloudRecordId, "cloud-one");
});

test("cloud sync failure preserves local dreams and marks them sync_failed", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const cloudSync = require("../miniprogram/services/cloudSync");
  const { wx, storage: rawStorage } = createWxHarness({
    storage: { [auth.WECHAT_SESSION_TOKEN_KEY]: "wechat-session-token" },
    respond: (payload) => {
      if (payload.url.endsWith("/api/miniprogram/dreams/sync")) {
        return { statusCode: 503, data: { error: { code: "UPSTREAM_UNAVAILABLE", message: "同步暂时失败。" } } };
      }
      return { statusCode: 200, data: {} };
    }
  });
  auth.clearLocalSession({ wx });
  rawStorage.set(auth.WECHAT_SESSION_TOKEN_KEY, "wechat-session-token");
  const storage = createDreamStorage(wx);
  const saved = storage.saveRecord({ dreamText: "梦见一条河", reportContent: {} });
  cloudSync.setCloudSyncEnabled(wx, true);

  await assert.rejects(
    () => cloudSync.syncNow({ wx }),
    (error) => error.code === "UPSTREAM_UNAVAILABLE"
  );

  const local = storage.getRecord(saved.record.localRecordId);
  assert.equal(local.dreamText, "梦见一条河");
  assert.equal(local.syncStatus, "sync_failed");
});

test("cloud restore merges cloud-only records and keeps conflict copies", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const cloudSync = require("../miniprogram/services/cloudSync");
  const { wx, storage: rawStorage } = createWxHarness({
    storage: { [auth.WECHAT_SESSION_TOKEN_KEY]: "wechat-session-token" },
    respond: (payload) => {
      if (payload.url.endsWith("/api/miniprogram/dreams")) {
        return {
          statusCode: 200,
          data: {
            ok: true,
            records: [{
              localRecordId: "cloud-local-one",
              cloudRecordId: "cloud-one",
              createdAt: "2026-07-28T00:00:00.000Z",
              updatedAt: "2026-07-28T00:00:00.000Z",
              lastSyncedAt: "2026-07-28T00:00:00.000Z",
              dreamText: "新设备恢复的梦",
              sleepQuality: "未记录",
              analysisType: "快速解析",
              reportContent: {},
              syncStatus: "synced"
            }]
          }
        };
      }
      return { statusCode: 200, data: {} };
    }
  });
  auth.clearLocalSession({ wx });
  rawStorage.set(auth.WECHAT_SESSION_TOKEN_KEY, "wechat-session-token");

  const result = await cloudSync.restoreFromCloud({ wx });
  const records = createDreamStorage(wx).getRecords();

  assert.equal(result.restoredCount, 1);
  assert.equal(records.length, 1);
  assert.equal(records[0].dreamText, "新设备恢复的梦");
  assert.equal(records[0].syncStatus, "synced");

  const storage = createDreamStorage(wx);
  storage.applySyncResult({
    conflicts: [{
      localRecordId: "cloud-local-one",
      cloudRecord: {
        localRecordId: "cloud-local-one",
        cloudRecordId: "cloud-one",
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:01:00.000Z",
        dreamText: "云端冲突副本",
        reportContent: {},
        syncStatus: "synced"
      }
    }]
  });

  const afterConflict = storage.getRecords();
  assert.equal(afterConflict.length, 2);
  assert.equal(afterConflict.some((record) => /conflict/.test(record.localRecordId)), true);
  assert.equal(afterConflict.some((record) => record.dreamText === "云端冲突副本"), true);
});

test("cloud restore never overwrites pending local edits or delete tombstones", () => {
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const { wx } = createWxHarness();
  const storage = createDreamStorage(wx);
  const saved = storage.saveRecord({
    localRecordId: "same-local",
    dreamText: "本机修改版本",
    reportContent: {}
  });
  storage.updateRecord(saved.record.localRecordId, {
    cloudRecordId: "cloud-one",
    syncStatus: "sync_failed",
    updatedAt: "2026-07-28T00:05:00.000Z"
  });

  const merged = storage.mergeCloudRecords([{
    localRecordId: "same-local",
    cloudRecordId: "cloud-one",
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:01:00.000Z",
    dreamText: "较旧云端版本",
    reportContent: {},
    syncStatus: "synced"
  }]);

  const records = storage.getRecords();
  assert.equal(merged.restoredCount, 0);
  assert.equal(records.some((record) => record.dreamText === "本机修改版本"), true);
  assert.equal(records.some((record) => record.dreamText === "较旧云端版本" && /conflict/.test(record.localRecordId)), true);

  const deleted = storage.saveRecord({
    localRecordId: "deleted-local",
    cloudRecordId: "cloud-deleted",
    dreamText: "准备删除",
    reportContent: {},
    syncStatus: "synced"
  });
  storage.deleteRecord(deleted.record.localRecordId);
  storage.mergeCloudRecords([{
    localRecordId: "deleted-local",
    cloudRecordId: "cloud-deleted",
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:02:00.000Z",
    dreamText: "不应复活",
    reportContent: {},
    syncStatus: "synced"
  }]);

  assert.equal(storage.getRecord("deleted-local"), null);
  assert.equal(storage.getRecords({ includeDeleted: true }).find((record) => record.localRecordId === "deleted-local").deletedAt.length > 0, true);
});

test("cloud restore applies server tombstones to stale local records", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const cloudSync = require("../miniprogram/services/cloudSync");
  const { wx, storage: rawStorage } = createWxHarness({
    storage: { [auth.WECHAT_SESSION_TOKEN_KEY]: "wechat-session-token" },
    respond: (payload) => {
      if (payload.url.endsWith("/api/miniprogram/dreams")) {
        return {
          statusCode: 200,
          data: {
            ok: true,
            records: [],
            deletedRecords: [{
              localRecordId: "stale-local",
              cloudRecordId: "cloud-stale",
              createdAt: "2026-07-28T00:00:00.000Z",
              updatedAt: "2026-07-28T00:10:00.000Z",
              deletedAt: "2026-07-28T00:10:00.000Z",
              lastSyncedAt: "2026-07-28T00:10:00.000Z",
              dreamText: "已在另一设备删除的梦",
              reportContent: {},
              syncStatus: "synced"
            }]
          }
        };
      }
      return { statusCode: 200, data: {} };
    }
  });
  auth.clearLocalSession({ wx });
  rawStorage.set(auth.WECHAT_SESSION_TOKEN_KEY, "wechat-session-token");
  const storage = createDreamStorage(wx);
  storage.saveRecord({
    localRecordId: "stale-local",
    cloudRecordId: "cloud-stale",
    dreamText: "旧设备仍保留的梦",
    reportContent: {},
    syncStatus: "synced",
    lastSyncedAt: "2026-07-28T00:00:00.000Z"
  });

  const result = await cloudSync.restoreFromCloud({ wx });

  assert.equal(result.restoredCount, 0);
  assert.equal(storage.getRecord("stale-local"), null);
  const tombstone = storage.getRecords({ includeDeleted: true }).find((record) => record.localRecordId === "stale-local");
  assert.equal(tombstone.deletedAt, "2026-07-28T00:10:00.000Z");
  assert.equal(tombstone.syncStatus, "synced");
});

test("cloud sync applies server-restored records to the original syncing record", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const cloudSync = require("../miniprogram/services/cloudSync");
  const { wx, storage: rawStorage } = createWxHarness({
    storage: { [auth.WECHAT_SESSION_TOKEN_KEY]: "wechat-session-token" },
    respond: (payload) => {
      if (payload.url.endsWith("/api/miniprogram/dreams/sync")) {
        return {
          statusCode: 200,
          data: {
            ok: true,
            records: [],
            restoredRecords: [{
              localRecordId: "restore-during-sync",
              cloudRecordId: "cloud-restore",
              createdAt: "2026-07-28T00:00:00.000Z",
              updatedAt: "2026-07-28T00:10:00.000Z",
              lastSyncedAt: "2026-07-28T00:11:00.000Z",
              dreamText: "云端较新版本",
              reportContent: { analysis: { dreamSummary: "云端摘要" } },
              syncStatus: "synced"
            }],
            conflicts: [],
            deletedRecords: []
          }
        };
      }
      return { statusCode: 200, data: {} };
    }
  });
  auth.clearLocalSession({ wx });
  rawStorage.set(auth.WECHAT_SESSION_TOKEN_KEY, "wechat-session-token");
  const storage = createDreamStorage(wx);
  storage.saveRecord({
    localRecordId: "restore-during-sync",
    dreamText: "本机较旧版本",
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:05:00.000Z",
    lastSyncedAt: "2026-07-28T00:04:00.000Z",
    syncStatus: "sync_failed",
    reportContent: { analysis: { dreamSummary: "本机摘要" } }
  });
  cloudSync.setCloudSyncEnabled(wx, true);

  await cloudSync.syncNow({ wx });

  const records = storage.getRecords({ includeDeleted: true });
  assert.equal(records.length, 1);
  assert.equal(records[0].dreamText, "云端较新版本");
  assert.equal(records[0].cloudRecordId, "cloud-restore");
  assert.equal(records[0].syncStatus, "synced");
});

test("cloud sync conflicts leave the local record pending and add a cloud copy", () => {
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const { wx } = createWxHarness();
  const storage = createDreamStorage(wx);
  storage.saveRecord({
    localRecordId: "conflict-during-sync",
    dreamText: "本机版本",
    syncStatus: "syncing",
    reportContent: { analysis: { dreamSummary: "本机摘要" } }
  });

  storage.applySyncResult({
    conflicts: [{
      localRecordId: "conflict-during-sync",
      cloudRecord: {
        localRecordId: "conflict-during-sync",
        cloudRecordId: "cloud-conflict",
        dreamText: "云端版本",
        syncStatus: "synced",
        reportContent: { analysis: { dreamSummary: "云端摘要" } }
      }
    }]
  });

  const records = storage.getRecords({ includeDeleted: true });
  const local = records.find((record) => record.localRecordId === "conflict-during-sync");
  const cloudCopy = records.find((record) => record.localRecordId.startsWith("conflict-during-sync_conflict_"));
  assert.equal(local.syncStatus, "sync_failed");
  assert.equal(local.dreamText, "本机版本");
  assert.equal(cloudCopy.dreamText, "云端版本");
  assert.equal(cloudCopy.syncStatus, "synced");
});

test("cloud sync chunks more than fifty pending records and synced edits become pending", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const cloudSync = require("../miniprogram/services/cloudSync");
  const { wx, requests, storage: rawStorage } = createWxHarness({
    storage: { [auth.WECHAT_SESSION_TOKEN_KEY]: "wechat-session-token" },
    respond: (payload) => {
      if (payload.url.endsWith("/api/miniprogram/dreams/sync")) {
        return {
          statusCode: 200,
          data: {
            ok: true,
            records: payload.data.records.map((record, index) => ({
              localRecordId: record.localRecordId,
              cloudRecordId: `cloud-${record.localRecordId}-${index}`,
              syncStatus: "synced",
              lastSyncedAt: "2026-07-28T00:00:00.000Z"
            })),
            restoredRecords: [],
            conflicts: [],
            deletedRecords: []
          }
        };
      }
      return { statusCode: 200, data: {} };
    }
  });
  auth.clearLocalSession({ wx });
  rawStorage.set(auth.WECHAT_SESSION_TOKEN_KEY, "wechat-session-token");
  const storage = createDreamStorage(wx);
  const synced = storage.saveRecord({
    localRecordId: "synced-one",
    cloudRecordId: "cloud-synced-one",
    dreamText: "已同步旧内容",
    reportContent: {},
    syncStatus: "synced",
    lastSyncedAt: "2026-07-28T00:00:00.000Z"
  });
  storage.updateRecord(synced.record.localRecordId, { dreamText: "已同步后修改" });
  assert.equal(storage.getRecord(synced.record.localRecordId).syncStatus, "local_only");

  for (let index = 0; index < 51; index += 1) {
    storage.saveRecord({ localRecordId: `pending-${index}`, dreamText: `梦 ${index}`, reportContent: {} });
  }
  cloudSync.setCloudSyncEnabled(wx, true);

  await cloudSync.syncNow({ wx });
  const syncRequests = requests.filter((item) => item.url.endsWith("/api/miniprogram/dreams/sync"));

  assert.equal(syncRequests.length, 2);
  assert.equal(syncRequests[0].data.records.length, 50);
  assert.equal(syncRequests[1].data.records.length, 2);
  assert.equal(storage.getRecords().every((record) => record.syncStatus === "synced"), true);
});

test("detail deletion marks the local tombstone synced after cloud delete succeeds", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const { createDreamStorage } = require("../miniprogram/services/dreamStorage");
  const cloudSync = require("../miniprogram/services/cloudSync");
  const { wx, storage: rawStorage } = createWxHarness({
    storage: { [auth.WECHAT_SESSION_TOKEN_KEY]: "wechat-session-token" },
    respond: (payload) => {
      if (payload.url.endsWith("/api/miniprogram/dreams/cloud-detail-one")) {
        return {
          statusCode: 200,
          data: {
            ok: true,
            record: {
              localRecordId: "detail-one",
              cloudRecordId: "cloud-detail-one",
              deletedAt: "2026-07-28T00:10:00.000Z",
              lastSyncedAt: "2026-07-28T00:10:00.000Z",
              syncStatus: "synced"
            }
          }
        };
      }
      return { statusCode: 200, data: {} };
    }
  });
  auth.clearLocalSession({ wx });
  rawStorage.set(auth.WECHAT_SESSION_TOKEN_KEY, "wechat-session-token");
  cloudSync.setCloudSyncEnabled(wx, true);
  const storage = createDreamStorage(wx);
  storage.saveRecord({
    localRecordId: "detail-one",
    cloudRecordId: "cloud-detail-one",
    dreamText: "准备删除的记录",
    reportContent: {},
    syncStatus: "synced",
    lastSyncedAt: "2026-07-28T00:00:00.000Z"
  });
  const navigations = [];
  wx.navigateTo = (payload) => navigations.push(payload);

  let pageDefinition;
  const previousPage = global.Page;
  const previousWx = global.wx;
  global.Page = (definition) => { pageDefinition = definition; };
  global.wx = wx;
  const detailPath = require.resolve("../miniprogram/pages/detail/index.js");
  delete require.cache[detailPath];
  require(detailPath);
  try {
    const page = {
      ...pageDefinition,
      data: { ...pageDefinition.data },
      setData(patch) {
        this.data = { ...this.data, ...patch };
      }
    };
    page.onLoad({ id: "detail-one" });

    await page.deleteRecord();
  } finally {
    global.Page = previousPage;
    global.wx = previousWx;
  }

  const tombstone = storage.getRecords({ includeDeleted: true }).find((record) => record.localRecordId === "detail-one");
  assert.equal(tombstone.syncStatus, "synced");
  assert.equal(tombstone.deletedAt, "2026-07-28T00:10:00.000Z");
  assert.equal(tombstone.lastSyncedAt, "2026-07-28T00:10:00.000Z");
  assert.equal(navigations[0].url, "/pages/journal/index");
});

test("profile login does not restore cloud dreams until the user manually enables sync", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const cloudSync = require("../miniprogram/services/cloudSync");
  const { wx, requests } = createWxHarness({
    respond: (payload) => {
      if (payload.url.endsWith("/api/v1/wechat-auth/login")) {
        return {
          statusCode: 200,
          data: {
            sessionToken: "wechat-session-token",
            expiresAt: "2026-07-29T00:00:00.000Z",
            account: { mode: "wechat", authenticated: true, cloudSyncAvailable: true }
          }
        };
      }
      if (payload.url.endsWith("/api/miniprogram/dreams")) {
        return {
          statusCode: 200,
          data: {
            ok: true,
            records: [{
              localRecordId: "cloud-only",
              cloudRecordId: "cloud-only",
              dreamText: "不应自动恢复的云端记录",
              reportContent: {},
              syncStatus: "synced"
            }],
            deletedRecords: []
          }
        };
      }
      return { statusCode: 200, data: {} };
    }
  });
  auth.clearLocalSession({ wx });
  cloudSync.setCloudSyncEnabled(wx, false);
  wx.showModal = () => {
    throw new Error("modal should not open without pending local records");
  };

  let pageDefinition;
  const previousPage = global.Page;
  const previousWx = global.wx;
  global.Page = (definition) => { pageDefinition = definition; };
  global.wx = wx;
  const profilePath = require.resolve("../miniprogram/pages/profile/index.js");
  delete require.cache[profilePath];
  require(profilePath);
  try {
    const page = {
      ...pageDefinition,
      data: { ...pageDefinition.data },
      setData(patch) {
        this.data = { ...this.data, ...patch };
      }
    };
    await page.handleWechatLogin();
    assert.equal(page.data.statusMessage, "微信身份已建立。");
  } finally {
    global.Page = previousPage;
    global.wx = previousWx;
  }

  assert.equal(requests.some((payload) => payload.url.endsWith("/api/miniprogram/dreams")), false);
  assert.equal(cloudSync.isCloudSyncEnabled(wx), false);
});

test("cloud sync exposes controller and prompt helper interfaces", async () => {
  const cloudSync = require("../miniprogram/services/cloudSync");
  const { wx } = createWxHarness();
  const controller = cloudSync.createCloudSyncController(wx);

  assert.equal(typeof controller.syncNow, "function");
  assert.equal(typeof controller.restoreFromCloud, "function");
  assert.equal(typeof cloudSync.maybePromptInitialSync, "function");
});

test("mini program legal versions match Web and guest consent follows versions", () => {
  const webLegal = require("../src/legalDocuments");
  const miniLegal = require("../miniprogram/services/legalDocuments");
  const miniSource = require("node:fs").readFileSync(require("node:path").join(__dirname, "../miniprogram/services/legalDocuments.js"), "utf8");
  const { wx } = createWxHarness();

  assert.doesNotMatch(miniSource, /\.\.\/\.\.\/src\/legalDocuments/);
  assert.deepEqual(miniLegal.getLegalVersions(), {
    privacyPolicyVersion: webLegal.PRIVACY_POLICY_VERSION,
    termsVersion: webLegal.TERMS_VERSION,
    aiDisclaimerVersion: webLegal.AI_DISCLAIMER_VERSION,
    crossBorderConsentVersion: webLegal.CROSS_BORDER_CONSENT_VERSION
  });
  assert.equal(miniLegal.hasAcceptedLegalVersions(wx), false);
  miniLegal.saveGuestLegalConsent(wx);
  assert.equal(miniLegal.hasAcceptedLegalVersions(wx), true);
  wx.setStorageSync(miniLegal.LEGAL_CONSENT_KEY, {
    privacyPolicyVersion: "old",
    termsVersion: webLegal.TERMS_VERSION,
    aiDisclaimerVersion: webLegal.AI_DISCLAIMER_VERSION,
    crossBorderConsentVersion: webLegal.CROSS_BORDER_CONSENT_VERSION
  });
  assert.equal(miniLegal.hasAcceptedLegalVersions(wx), false);
  wx.setStorageSync(miniLegal.LEGAL_CONSENT_KEY, {
    privacyPolicyVersion: webLegal.PRIVACY_POLICY_VERSION,
    termsVersion: webLegal.TERMS_VERSION,
    aiDisclaimerVersion: webLegal.AI_DISCLAIMER_VERSION
  });
  assert.equal(miniLegal.hasAcceptedLegalVersions(wx), false);

  assert.equal(miniLegal.getLegalDocument("privacy").title, "隐私政策");
  assert.equal(miniLegal.getLegalDocument("terms").title, "用户协议");
  assert.equal(miniLegal.getLegalDocument("ai").title, "AI 使用说明");
  assert.equal(miniLegal.getLegalDocument("cross-border").title, "境外处理说明");

  const aiDocument = JSON.stringify(miniLegal.getLegalDocument("ai"));
  const privacyDocument = JSON.stringify(miniLegal.getLegalDocument("privacy"));
  assert.match(aiDocument, /本功能不是解梦、算命、占卜、吉凶判断或未来预测服务/);
  assert.match(aiDocument, /摘要整理、情绪词识别、意象关键词整理/);
  assert.doesNotMatch(`${aiDocument}\n${privacyDocument}`, /AI 解梦|梦境解析|象征解释|潜意识分析/);
});

test("result card normalization avoids fake zero scores and unsafe text", () => {
  const { hasResultCard, normalizeResultCard } = require("../miniprogram/services/resultCard");
  assert.equal(hasResultCard({}), false);
  assert.equal(hasResultCard({ coreInsight: "只有一句话" }), false);
  assert.equal(hasResultCard({
    archetype: { id: "seeker" },
    coreInsight: "这个梦可能与你正在寻找方向有关。",
    dimensions: [{ id: "symbol_depth", score: 55, rationale: ["门出现在梦里。"] }]
  }), false);
  assert.equal(hasResultCard({
    archetype: { id: "unknown" },
    coreInsight: "这个梦可能与你正在寻找方向有关。",
    dimensions: [
      { id: "symbol_depth", score: 55, rationale: ["门出现在梦里。"] },
      { id: "emotion_intensity", score: 62, rationale: ["紧张来自寻找。"] },
      { id: "self_awareness", score: 48, rationale: ["梦里有观察。"] },
      { id: "growth_signal", score: 50, rationale: ["出现选择线索。"] }
    ]
  }), false);
  assert.equal(hasResultCard({
    archetype: { id: "creator" },
    coreInsight: "这个梦可能与你正在寻找方向有关。",
    dimensions: [
      { id: "symbol_depth", score: 55, rationale: ["门出现在梦里。"] },
      { id: "emotion_intensity", score: 62, rationale: ["紧张来自寻找。"] },
      { id: "self_awareness", score: 48, rationale: ["梦里有观察。"] },
      { id: "growth_signal", score: 50, rationale: ["出现选择线索。"] }
    ]
  }), true);

  const card = normalizeResultCard({
    archetype: { id: "creator", summary: "你就是创造者", evidence: ["梦里有一扇门。"] },
    coreInsight: "这个梦可能与你正在寻找方向有关。",
    dimensions: [{ id: "symbol_depth", score: "", summary: "门和走廊是线索。", rationale: ["门出现在梦里。"] }],
    symbols: [{ name: "门", contextMeaning: "可能与选择有关。", evidence: "梦里出现门。", reflectionQuestion: "门让你想到什么？" }],
    emotionalProfile: { primary: "紧张", intensity: "", evidence: "找不到教室。" },
    reflectionQuestions: ["这扇门让你想到什么？"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  });

  assert.equal(card.archetype.nameZh, "创造者");
  assert.equal(card.archetype.summary.includes("你就是"), false);
  assert.equal(card.dimensions[0].score, null);
  assert.equal(card.emotionalProfile.intensity, null);
  assert.equal(card.symbols.length, 1);
});

test("compliance text lowers high-risk AI display terms without mutating records", () => {
  const {
    formatMiniProgramAnalysisType,
    sanitizeComplianceObject,
    sanitizeComplianceText
  } = require("../miniprogram/utils/complianceText");

  assert.equal(sanitizeComplianceText("这个梦预示着命运改变"), "这个记录片段可能让你联想到生活体验改变");
  assert.equal(formatMiniProgramAnalysisType("快速解析"), "AI 整理");
  assert.equal(formatMiniProgramAnalysisType("深度引导"), "深度记录");

  const raw = {
    insight: "潜意识告诉你这意味着机会",
    nested: { text: "梦境解析和梦境画像" },
    list: ["象征着变化", "吉凶判断"]
  };
  const cleaned = sanitizeComplianceObject(raw);

  assert.notStrictEqual(cleaned, raw);
  assert.equal(raw.insight, "潜意识告诉你这意味着机会");
  assert.doesNotMatch(JSON.stringify(cleaned), /潜意识告诉你|意味着|梦境解析|梦境画像|象征着|吉凶/);
});

test("mini program display titles sanitize saved AI summaries without mutating records", () => {
  const { createMiniProgramDisplayTitle } = require("../miniprogram/utils/complianceText");
  const record = {
    dreamText: "我梦见一扇门",
    reportContent: {
      analysis: {
        dreamSummary: "这个梦预示着命运改变，也有梦境画像线索。"
      }
    }
  };

  const title = createMiniProgramDisplayTitle(record);
  assert.equal(record.reportContent.analysis.dreamSummary, "这个梦预示着命运改变，也有梦境画像线索。");
  assert.doesNotMatch(title, /预示|命运|梦境画像/);
  assert.match(title, /记录片段|生活体验|梦境线索卡/);
});
