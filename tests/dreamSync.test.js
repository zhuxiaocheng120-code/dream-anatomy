const assert = require("node:assert/strict");
const test = require("node:test");

const DreamSync = require("../src/dreamSync");

const storageKey = "dreamAnatomy.quickDecodeRecords";
const user = { id: "user-1", email: "one@example.com" };

function createMemoryStorage(initialRecords = []) {
  const values = new Map([[storageKey, JSON.stringify(initialRecords)]]);

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function createRecord(overrides = {}) {
  return {
    id: overrides.id || "local-1",
    createdAt: overrides.createdAt || "2026-07-11T08:00:00.000Z",
    rawDreamText: overrides.rawDreamText || "我梦见一座学校和一场雨",
    dreamSummary: overrides.dreamSummary || "梦境整理",
    emotions: overrides.emotions || "紧张",
    symbols: overrides.symbols || "学校、雨",
    sleepQuality: overrides.sleepQuality || "未记录",
    analysisType: overrides.analysisType || "快速解析",
    reportContent: overrides.reportContent || { summary: "梦境整理" },
    ...overrides
  };
}

function createFakeSupabase(options = {}) {
  const state = {
    rows: options.rows ? [...options.rows] : [],
    upserts: [],
    upsertOptions: [],
    failUpsert: Boolean(options.failUpsert),
    failSelect: Boolean(options.failSelect)
  };

  return {
    state,
    from(tableName) {
      assert.equal(tableName, "dream_records");

      return {
        upsert(payload, upsertOptions) {
          const rows = Array.isArray(payload) ? payload : [payload];
          state.upserts.push(...rows);
          state.upsertOptions.push(upsertOptions || {});

          return {
            async select() {
              if (state.failUpsert) {
                return { data: null, error: new Error("upsert failed") };
              }

              rows.forEach((row) => {
                const existingIndex = state.rows.findIndex(
                  (item) => item.user_id === row.user_id && item.local_record_id === row.local_record_id
                );
                const savedRow = {
                  id: row.id || `cloud-${state.rows.length + 1}`,
                  ...row,
                  updated_at: row.updated_at || row.created_at
                };

                if (existingIndex >= 0) {
                  state.rows[existingIndex] = { ...state.rows[existingIndex], ...savedRow };
                } else {
                  state.rows.push(savedRow);
                }
              });

              return { data: rows, error: null };
            }
          };
        },
        select() {
          return {
            eq(column, value) {
              assert.equal(column, "user_id");

              return {
                async order(columnName) {
                  assert.equal(columnName, "created_at");

                  if (state.failSelect) {
                    return { data: null, error: new Error("select failed") };
                  }

                  return {
                    data: state.rows
                      .filter((row) => row.user_id === value)
                      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at)),
                    error: null
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}

function readStoredRecords(storage) {
  return JSON.parse(storage.getItem(storageKey) || "[]");
}

test("maps a local dream record to the Supabase row shape for the current user", () => {
  const record = createRecord();
  const row = DreamSync.mapLocalRecordToSupabaseRow(record, user);

  assert.equal(row.user_id, "user-1");
  assert.equal(row.local_record_id, "local-1");
  assert.equal(row.raw_dream_text, record.rawDreamText);
  assert.deepEqual(row.emotions, ["紧张"]);
  assert.deepEqual(row.symbols, ["学校", "雨"]);
  assert.equal(row.analysis_type, "快速解析");
  assert.equal(row.source, "local_storage");
  assert.equal(row.sync_status, "synced");
});

test("ignores a forged local user id when mapping rows for the current session user", () => {
  const record = createRecord({ userId: "attacker-supplied-user", user_id: "attacker-snake-user" });
  const row = DreamSync.mapLocalRecordToSupabaseRow(record, user);

  assert.equal(row.user_id, "user-1");
  assert.notEqual(row.user_id, record.userId);
  assert.notEqual(row.user_id, record.user_id);
});

test("migrates existing local records once and marks local copies as synced", async () => {
  const storage = createMemoryStorage([createRecord()]);
  const client = createFakeSupabase();
  const statuses = [];
  const controller = DreamSync.createDreamSyncController({
    client,
    storage,
    storageKey,
    onStatusChange: (message) => statuses.push(message)
  });

  const firstResult = await controller.setSession({ user });
  const secondResult = await controller.syncCurrentUser();

  assert.equal(firstResult.migratedCount, 1);
  assert.equal(secondResult.migratedCount, 0);
  assert.equal(client.state.upserts.length, 1);
  assert.deepEqual(client.state.upsertOptions[0], { onConflict: "user_id,local_record_id" });
  assert.equal(readStoredRecords(storage)[0].syncStatus, "synced");
  assert.equal(readStoredRecords(storage)[0].userId, "user-1");
  assert.ok(statuses.includes("正在整理你的梦境档案……"));
  assert.ok(statuses.includes("已同步 1 条本地梦境。"));
});

test("does not migrate pending records owned by another account", async () => {
  const storage = createMemoryStorage([
    createRecord({ id: "foreign-pending", userId: "user-2", syncStatus: "pending_sync" }),
    createRecord({ id: "current-pending", userId: "user-1", syncStatus: "pending_sync" })
  ]);
  const client = createFakeSupabase();
  const controller = DreamSync.createDreamSyncController({ client, storage, storageKey });

  const result = await controller.setSession({ user });

  assert.equal(result.migratedCount, 1);
  assert.deepEqual(client.state.upserts.map((row) => row.local_record_id), ["current-pending"]);
  assert.deepEqual(client.state.upserts.map((row) => row.user_id), ["user-1"]);
});

test("saves a new logged-in record to Supabase before updating the local cache", async () => {
  const storage = createMemoryStorage([]);
  const client = createFakeSupabase();
  const controller = DreamSync.createDreamSyncController({ client, storage, storageKey });
  await controller.setSession({ user });

  await controller.saveRecord(createRecord({ id: "new-local" }));

  assert.equal(client.state.rows.length, 1);
  assert.equal(client.state.rows[0].local_record_id, "new-local");
  assert.equal(readStoredRecords(storage)[0].syncStatus, "synced");
  assert.equal(readStoredRecords(storage)[0].userId, "user-1");
});

test("keeps failed cloud saves locally as pending and retries them later", async () => {
  const storage = createMemoryStorage([]);
  const client = createFakeSupabase({ failUpsert: true });
  const controller = DreamSync.createDreamSyncController({ client, storage, storageKey });
  await controller.setSession({ user });

  await controller.saveRecord(createRecord({ id: "pending-local" }));

  assert.equal(readStoredRecords(storage)[0].syncStatus, "pending_sync");
  assert.equal(readStoredRecords(storage)[0].userId, "user-1");

  client.state.failUpsert = false;
  const retryResult = await controller.retryPendingRecords();

  assert.equal(retryResult.syncedCount, 1);
  assert.equal(readStoredRecords(storage)[0].syncStatus, "synced");
});

test("hides a previous user's synced cloud and migrated local records after logout", async () => {
  const storage = createMemoryStorage([
    createRecord({ id: "cloud-owned", userId: "user-1", syncStatus: "synced" }),
    createRecord({ id: "anonymous-local" })
  ]);
  const controller = DreamSync.createDreamSyncController({
    client: createFakeSupabase(),
    storage,
    storageKey
  });

  await controller.setSession({ user });
  await controller.setSession(null);

  assert.deepEqual(controller.getVisibleRecords().map((record) => record.id), []);
});

test("switching accounts shows only the next account's records", async () => {
  const storage = createMemoryStorage([
    createRecord({ id: "user-one-local", userId: "user-1", syncStatus: "synced" }),
    createRecord({ id: "user-two-local", userId: "user-2", syncStatus: "pending_sync" })
  ]);
  const client = createFakeSupabase({
    rows: [
      {
        id: "cloud-one",
        user_id: "user-1",
        local_record_id: "user-one-cloud",
        created_at: "2026-07-12T08:00:00.000Z",
        raw_dream_text: "账号一的梦",
        dream_summary: "账号一",
        emotions: ["平静"],
        symbols: ["门"],
        sleep_quality: "未记录",
        analysis_type: "快速解析",
        report_content: {}
      },
      {
        id: "cloud-two",
        user_id: "user-2",
        local_record_id: "user-two-cloud",
        created_at: "2026-07-12T09:00:00.000Z",
        raw_dream_text: "账号二的梦",
        dream_summary: "账号二",
        emotions: ["好奇"],
        symbols: ["桥"],
        sleep_quality: "未记录",
        analysis_type: "快速解析",
        report_content: {}
      }
    ]
  });
  const controller = DreamSync.createDreamSyncController({ client, storage, storageKey });

  await controller.setSession({ user });
  assert.deepEqual(controller.getVisibleRecords().map((record) => record.userId), ["user-1"]);

  await controller.setSession({ user: { id: "user-2", email: "two@example.com" } });

  assert.deepEqual(
    controller.getVisibleRecords().map((record) => record.userId),
    ["user-2", "user-2"]
  );
  assert.ok(controller.getVisibleRecords().every((record) => !String(record.rawDreamText).includes("账号一")));
});
