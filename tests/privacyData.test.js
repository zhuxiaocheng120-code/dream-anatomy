const assert = require("node:assert/strict");
const test = require("node:test");

const LegalDocuments = require("../src/legalDocuments");
const PrivacyData = require("../src/privacyData");
const ProductAnalytics = require("../src/productAnalytics");

function createFakeElement(tagName = "div") {
  const listeners = new Map();
  const element = {
    tagName: tagName.toUpperCase(),
    children: [],
    className: "",
    dataset: {},
    disabled: false,
    hidden: false,
    id: "",
    textContent: "",
    type: "",
    value: "",
    checked: false,
    attributes: {},
    classList: {
      values: new Set(),
      add(value) {
        this.values.add(value);
      },
      remove(value) {
        this.values.delete(value);
      },
      toggle(value, force) {
        const shouldAdd = force === undefined ? !this.values.has(value) : Boolean(force);
        if (shouldAdd) {
          this.values.add(value);
        } else {
          this.values.delete(value);
        }
      },
      contains(value) {
        return this.values.has(value);
      }
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    trigger(type, event = {}) {
      const listener = listeners.get(type);
      if (listener) {
        return listener({ target: this, preventDefault() {}, ...event });
      }
      return undefined;
    }
  };

  Object.defineProperty(element, "innerHTML", {
    set() {
      throw new Error("PrivacyData must not assign innerHTML");
    }
  });

  return element;
}

function createFakeDocument() {
  return {
    createElement: createFakeElement
  };
}

function createStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
    dump() {
      return Object.fromEntries(entries.entries());
    }
  };
}

function collectText(node) {
  return [
    node.textContent,
    ...node.children.flatMap((child) => collectText(child))
  ].filter(Boolean);
}

function createHarness(options = {}) {
  const elements = {
    view: createFakeElement("section"),
    entry: createFakeElement("button"),
    documentShell: createFakeElement("div"),
    status: createFakeElement("p"),
    exportButton: createFakeElement("button"),
    clearButton: createFakeElement("button"),
    deleteAccountButton: createFakeElement("button"),
    clearGuestButton: createFakeElement("button"),
    confirmShell: createFakeElement("div"),
    confirmTitle: createFakeElement("h3"),
    confirmBody: createFakeElement("p"),
    confirmInput: createFakeElement("input"),
    confirmCancel: createFakeElement("button"),
    confirmSubmit: createFakeElement("button"),
    registerConsent: createFakeElement("input")
  };
  const storage = options.storage || createStorage();
  const downloads = [];
  const confirmations = [];
  const appCalls = [];
  const dreamSync = options.dreamSync || {
    getVisibleRecords: () => options.records || [],
    loadAllRecords: () => options.records || [],
    deleteRecord: async (recordId) => ({ deletedCount: recordId ? 1 : 0, records: [] }),
    clearCurrentRecords: async () => ({ deletedCount: 0, records: [] }),
    clearCurrentLocalCache: () => ({ deletedCount: 0, records: [] }),
    getCurrentUser: () => options.user || null
  };

  const controller = PrivacyData.createPrivacyDataController({
    app: {
      renderDreamJournal(records) {
        appCalls.push({ type: "renderDreamJournal", records });
      },
      showDreamJournalList() {
        appCalls.push({ type: "showDreamJournalList" });
      },
      showView(viewName) {
        appCalls.push({ type: "showView", viewName });
      }
    },
    auth: options.auth || {},
    document: createFakeDocument(),
    dreamSync,
    elements,
    legalDocuments: LegalDocuments,
    productAnalytics: options.productAnalytics,
    runtimeEnv: { PUBLIC_SUPPORT_EMAIL: "support@example.com" },
    storage,
    storageKey: "dreamAnatomy.quickDecodeRecords",
    confirmAction: async (request) => {
      confirmations.push(request);
      return options.confirmResult !== undefined ? options.confirmResult : true;
    },
    downloadJson: (filename, data) => {
      downloads.push({ filename, data });
    },
    fetchJson: options.fetchJson
  });

  return { appCalls, confirmations, controller, downloads, elements, storage };
}

function createLegalConsentClient(options = {}) {
  const state = {
    selects: [],
    upserts: [],
    row: options.row || null
  };

  return {
    state,
    from(tableName) {
      assert.equal(tableName, "legal_consents");

      return {
        select() {
          return {
            eq(column, value) {
              state.selects.push({ column, value });
              return {
                async maybeSingle() {
                  return { data: state.row, error: null };
                }
              };
            }
          };
        },
        upsert(row, upsertOptions) {
          state.upserts.push({ row, upsertOptions });
          state.row = row;
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: row, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
}

function createAnalyticsPreferenceClient(enabledByUser = {}) {
  const state = { reads: [], upserts: [] };
  return {
    state,
    from(tableName) {
      if (tableName === "legal_consents") {
        return {
          select() { return { eq() { return { maybeSingle: async () => ({ data: null, error: null }) }; } }; }
        };
      }
      assert.equal(tableName, "product_analytics_preferences");
      return {
        select() {
          return {
            eq(column, userId) {
              state.reads.push({ column, userId });
              return { maybeSingle: async () => ({ data: { enabled: Boolean(enabledByUser[userId]) }, error: null }) };
            }
          };
        },
        upsert(row, options) {
          state.upserts.push({ row, options });
          enabledByUser[row.user_id] = row.enabled;
          return Promise.resolve({ error: null });
        }
      };
    }
  };
}

function createRealAnalyticsController(storage) {
  let id = 0;
  return ProductAnalytics.createProductAnalyticsController({
    localStorage: storage,
    sessionStorage: createStorage(),
    createUuid: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    fetch: async () => ({ ok: true })
  });
}

test("renders privacy center entry and legal documents with Chinese text", () => {
  const { controller, elements } = createHarness();

  controller.render();
  controller.openLegalDocument("privacy");

  const viewText = collectText(elements.view).join("\n");
  const documentText = collectText(elements.documentShell).join("\n");

  assert.match(viewText, /隐私与数据/);
  assert.match(viewText, /隐私政策/);
  assert.match(viewText, /用户协议/);
  assert.match(viewText, /AI 使用说明/);
  assert.match(viewText, /导出我的数据/);
  assert.match(viewText, /帮助改进 Dream Anatomy/);
  assert.match(viewText, /删除我的产品分析数据/);
  assert.match(documentText, /support@example\.com/);
  assert.match(documentText, /Beta 技术版本/);
});

test("product analytics consent defaults off and saves only authenticated preferences", async () => {
  const calls = [];
  const productAnalytics = {
    getAnalyticsConsent: () => false,
    setAnalyticsConsent: async (enabled) => calls.push({ type: "set", enabled }),
    loadPreferenceForSession: async (detail) => calls.push({ type: "load", detail })
  };
  const { controller, elements } = createHarness({ productAnalytics });

  controller.render();
  const toggle = elements.view.children[1].children[5].children[2].children[0];
  assert.equal(toggle.checked, false);
  await toggle.trigger("change", { target: { checked: true } });
  await controller.handleSession({ authEvent: "SIGNED_IN", user: { id: "user-1" }, client: {} });

  assert.deepEqual(calls[0], { type: "set", enabled: true });
  assert.equal(calls[1].type, "load");
  assert.equal(calls[1].detail.user.id, "user-1");
});

test("turning off analytics clears the queue and deletion uses the analytics controller", async () => {
  const calls = [];
  const productAnalytics = {
    getAnalyticsConsent: () => true,
    setAnalyticsConsent: async (enabled) => calls.push({ type: "set", enabled }),
    deleteProductAnalyticsData: async () => calls.push({ type: "delete" })
  };
  const { controller, elements } = createHarness({ productAnalytics });

  controller.render();
  const analyticsCard = elements.view.children[1].children[5];
  const toggle = analyticsCard.children[2].children[0];
  await toggle.trigger("change", { target: { checked: false } });
  await analyticsCard.children[3].trigger("click");

  assert.deepEqual(calls, [{ type: "set", enabled: false }, { type: "delete" }]);
  assert.match(elements.status.textContent, /产品分析数据/);
});

test("privacy controller upserts authenticated analytics preference through the dedicated table", async () => {
  const storage = createStorage();
  const client = createAnalyticsPreferenceClient({ "user-1": false });
  const productAnalytics = createRealAnalyticsController(storage);
  const { controller, elements } = createHarness({ productAnalytics, storage });

  controller.render();
  await controller.handleSession({ authEvent: "SIGNED_IN", user: { id: "user-1" }, client });
  const toggle = elements.view.children[1].children[5].children[2].children[0];
  await toggle.trigger("change", { target: { checked: true } });

  assert.deepEqual(client.state.upserts, [{
    row: { user_id: "user-1", enabled: true },
    options: { onConflict: "user_id" }
  }]);
  assert.equal(storage.getItem("dreamAnatomy.productAnalytics.guestPreference"), null);
});

test("privacy controller keeps guest preference local and reloads preference on account switch", async () => {
  const storage = createStorage();
  const client = createAnalyticsPreferenceClient({ "user-1": true, "user-2": false });
  const productAnalytics = createRealAnalyticsController(storage);
  const { controller } = createHarness({ productAnalytics, storage });

  await productAnalytics.setAnalyticsConsent(true);
  assert.equal(storage.getItem("dreamAnatomy.productAnalytics.guestPreference"), "true");
  assert.equal(client.state.upserts.length, 0);

  await controller.handleSession({ authEvent: "SIGNED_IN", user: { id: "user-1" }, client });
  assert.equal(productAnalytics.getAnalyticsConsent(), true);
  await controller.handleSession({ authEvent: "SIGNED_IN", user: { id: "user-2" }, client });

  assert.deepEqual(client.state.reads, [
    { column: "user_id", userId: "user-1" },
    { column: "user_id", userId: "user-2" }
  ]);
  assert.equal(productAnalytics.getAnalyticsConsent(), false);
});

test("guest AI consent stores only current local legal versions after explicit confirmation", async () => {
  const storage = createStorage();
  const { controller, confirmations } = createHarness({ confirmResult: true, storage });

  assert.equal(storage.getItem("dreamAnatomy.legalConsent.guest"), null);
  assert.equal(await controller.ensureGuestAiConsent(), true);

  const saved = JSON.parse(storage.getItem("dreamAnatomy.legalConsent.guest"));
  assert.deepEqual(saved, LegalDocuments.getLegalVersions());
  assert.equal(confirmations.length, 1);
  assert.doesNotMatch(JSON.stringify(saved), /token|email|user/i);
});

test("export excludes tokens principal hashes email and full user ids", async () => {
  const record = {
    id: "dream-1",
    createdAt: "2026-07-17T01:02:03.000Z",
    rawDreamText: "我梦见一扇门。",
    dreamSummary: "门",
    emotions: "好奇",
    symbols: "门",
    sleepQuality: "未记录",
    analysisType: "快速解析",
    reportContent: {
      dreamResultCard: { coreInsight: "也许在靠近选择。" },
      userReflection: "这个梦让我想到一个还没有说出口的选择。",
      userReflectionUpdatedAt: "2026-07-20T09:00:00.000Z",
      sleepQualityScore: 65,
      sleepQualityLabel: "不错",
      sleepQualityUpdatedAt: "2026-07-20T09:30:00.000Z"
    }
  };
  const { controller, downloads } = createHarness({
    records: [record],
    user: { id: "12345678-1234-1234-1234-123456789abc", email: "private@example.com" }
  });

  await controller.exportData();

  assert.equal(downloads.length, 1);
  assert.match(downloads[0].filename, /^dream-anatomy-export-\d{4}-\d{2}-\d{2}\.json$/);

  const exportedText = JSON.stringify(downloads[0].data);
  assert.match(exportedText, /我梦见一扇门/);
  assert.match(exportedText, /这个梦让我想到一个还没有说出口的选择/);
  assert.match(exportedText, /sleepQualityScore/);
  assert.match(exportedText, /65/);
  assert.match(exportedText, /不错/);
  assert.doesNotMatch(exportedText, /private@example\.com/);
  assert.doesNotMatch(exportedText, /12345678-1234-1234-1234-123456789abc/);
  assert.doesNotMatch(exportedText, /access_token|refresh_token|principal_hash/i);
});

test("export does not manufacture sleep quality for untouched records", async () => {
  const record = {
    id: "dream-without-sleep",
    createdAt: "2026-07-17T01:02:03.000Z",
    rawDreamText: "我梦见一扇门。",
    dreamSummary: "门",
    emotions: "好奇",
    symbols: "门",
    analysisType: "快速解析",
    reportContent: {
      dreamResultCard: { coreInsight: "也许在靠近选择。" }
    }
  };
  const { controller, downloads } = createHarness({ records: [record] });

  await controller.exportData();

  const exportedRecord = downloads[0].data.dreams[0];
  assert.equal(exportedRecord.sleepQuality, undefined);
  assert.equal(exportedRecord.reportContent.sleepQualityScore, undefined);
  assert.equal(exportedRecord.reportContent.sleepQualityLabel, undefined);
  assert.equal(exportedRecord.reportContent.sleepQualityUpdatedAt, undefined);
});

test("export does not include full cloud record UUIDs", async () => {
  const cloudUuid = "12345678-1234-1234-1234-123456789abc";
  const { controller, downloads } = createHarness({
    records: [{
      id: cloudUuid,
      cloudId: cloudUuid,
      localRecordId: cloudUuid,
      createdAt: "2026-07-17T01:02:03.000Z",
      rawDreamText: "云端旧记录",
      dreamSummary: "云端旧记录",
      analysisType: "快速解析",
      reportContent: {}
    }]
  });

  await controller.exportData();

  assert.doesNotMatch(JSON.stringify(downloads[0].data), new RegExp(cloudUuid));
});

test("tracks export, deletion, and clearing only after each data action succeeds", async () => {
  const events = [];
  const productAnalytics = {
    trackEvent(name, properties) {
      events.push({ name, properties });
    }
  };
  const record = { id: "record-1", analysisType: "快速解析" };
  const { controller } = createHarness({
    confirmResult: "清空全部梦境",
    productAnalytics,
    records: [record],
    dreamSync: {
      getVisibleRecords: () => [record],
      loadAllRecords: () => [record],
      deleteRecord: async () => ({ deletedCount: 1, records: [] }),
      clearCurrentRecords: async () => ({ deletedCount: 1, records: [] }),
      clearCurrentLocalCache: () => ({ deletedCount: 0, records: [] }),
      getCurrentUser: () => null
    }
  });

  await controller.exportData();
  await controller.deleteDreamRecord(record);
  await controller.clearAllDreams();

  assert.deepEqual(events, [
    { name: "data_export_completed", properties: { record_count_bucket: "1" } },
    { name: "dream_deleted", properties: { analysis_type: "quick" } },
    { name: "all_dreams_cleared", properties: { record_count_bucket: "1" } }
  ]);
});

test("clear all requires exact confirmation text before deleting records", async () => {
  let clearCalls = 0;
  const { controller } = createHarness({
    confirmResult: "wrong text",
    dreamSync: {
      getVisibleRecords: () => [{ id: "one" }],
      loadAllRecords: () => [{ id: "one" }],
      clearCurrentRecords: async () => {
        clearCalls += 1;
        return { deletedCount: 1, records: [] };
      },
      clearCurrentLocalCache: () => ({ deletedCount: 0, records: [] }),
      getCurrentUser: () => ({ id: "user-1" })
    }
  });

  const result = await controller.clearAllDreams();

  assert.equal(result.cancelled, true);
  assert.equal(clearCalls, 0);
});

test("single dream deletion calls DreamSync and preserves UI on failure", async () => {
  let deleteCalls = 0;
  const { controller, appCalls, elements } = createHarness({
    confirmResult: true,
    dreamSync: {
      getVisibleRecords: () => [{ id: "record-1" }],
      loadAllRecords: () => [{ id: "record-1" }],
      deleteRecord: async () => {
        deleteCalls += 1;
        throw new Error("cloud failure");
      },
      clearCurrentRecords: async () => ({ deletedCount: 0, records: [] }),
      clearCurrentLocalCache: () => ({ deletedCount: 0, records: [] }),
      getCurrentUser: () => ({ id: "user-1" })
    }
  });

  await assert.rejects(() => controller.deleteDreamRecord({ id: "record-1" }), /cloud failure/);

  assert.equal(deleteCalls, 1);
  assert.equal(appCalls.some((call) => call.type === "showDreamJournalList"), false);
  assert.match(elements.status.textContent, /删除失败/);
});

test("account deletion sends Bearer token and confirmation text only", async () => {
  const requests = [];
  const { controller } = createHarness({
    confirmResult: "注销账户",
    auth: {
      async getClient() {
        return {
          auth: {
            getSession: async () => ({
              data: {
                session: {
                  access_token: "safe-token",
                  user: { id: "user-1", email: "x@example.com" }
                }
              }
            }),
            signOut: async () => ({ error: null })
          }
        };
      }
    },
    fetchJson: async (url, options) => {
      requests.push({ url, options });
      return { ok: true };
    }
  });

  await controller.deleteAccount();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/v1/account");
  assert.equal(requests[0].options.method, "DELETE");
  assert.equal(requests[0].options.headers.Authorization, "Bearer safe-token");
  assert.deepEqual(JSON.parse(requests[0].options.body), { confirmation: "注销账户" });
  assert.doesNotMatch(requests[0].options.body, /user-1|x@example\.com/);
});

test("session changes clear privacy state and leave admin-free user data view", () => {
  const { controller, elements } = createHarness();

  controller.openLegalDocument("terms");
  assert.notEqual(elements.documentShell.children.length, 0);

  controller.handleSession({ authEvent: "SIGNED_OUT", user: null });

  assert.equal(elements.documentShell.children.length, 0);
  assert.equal(elements.status.textContent, "");
});

test("login checks current legal consent and prompts stale versions once", async () => {
  const client = createLegalConsentClient({
    row: {
      privacy_policy_version: "old",
      terms_version: "old",
      ai_disclaimer_version: "old"
    }
  });
  const { controller, elements } = createHarness();

  await controller.handleSession({
    authEvent: "SIGNED_IN",
    user: { id: "user-1" },
    client
  });

  assert.deepEqual(client.state.selects, [{ column: "user_id", value: "user-1" }]);
  assert.match(elements.status.textContent, /请确认最新版本/);

  await controller.handleSession({
    authEvent: "TOKEN_REFRESHED",
    user: { id: "user-1" },
    client
  });

  assert.equal(client.state.selects.length, 1);
});

test("analytics preference failures do not block legal consent checks", async () => {
  const client = createLegalConsentClient({
    row: {
      privacy_policy_version: "old",
      terms_version: "old",
      ai_disclaimer_version: "old"
    }
  });
  const productAnalytics = {
    loadPreferenceForSession: async () => {
      throw new Error("analytics preference unavailable");
    },
    getAnalyticsConsent: () => false
  };
  const { controller, elements } = createHarness({ productAnalytics });

  await controller.handleSession({
    authEvent: "SIGNED_IN",
    user: { id: "user-1" },
    client
  });

  assert.deepEqual(client.state.selects, [{ column: "user_id", value: "user-1" }]);
  assert.match(elements.status.textContent, /请确认最新版本/);
});

test("acceptCurrentLegalVersions saves versions for the current authenticated user", async () => {
  const client = createLegalConsentClient();
  const { controller } = createHarness();
  await controller.handleSession({ authEvent: "SIGNED_IN", user: { id: "user-1" }, client });

  await controller.acceptCurrentLegalVersions();

  assert.equal(client.state.upserts.length, 1);
  assert.equal(client.state.upserts[0].row.user_id, "user-1");
  assert.deepEqual(client.state.upserts[0].upsertOptions, { onConflict: "user_id" });
  assert.equal(client.state.upserts[0].row.privacy_policy_version, LegalDocuments.getLegalVersions().privacyPolicyVersion);
});

test("switching accounts reloads the matching account consent record", async () => {
  const client = createLegalConsentClient({ row: null });
  const { controller } = createHarness();

  await controller.handleSession({ authEvent: "SIGNED_IN", user: { id: "user-1" }, client });
  await controller.handleSession({ authEvent: "SIGNED_IN", user: { id: "user-2" }, client });

  assert.deepEqual(client.state.selects, [
    { column: "user_id", value: "user-1" },
    { column: "user_id", value: "user-2" }
  ]);
});
