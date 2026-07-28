const assert = require("node:assert/strict");
const test = require("node:test");

const { createWechatSessionHash } = require("../server/wechatSession");
const { createMiniProgramDreamSyncService } = require("../server/miniprogramDreamSync");

const env = {
  WECHAT_SESSION_HASH_SECRET: "session-secret"
};

function createRequest(token, body = {}) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
    params: {}
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeCloudClient(options = {}) {
  const state = {
    app_users: clone(options.app_users || []),
    wechat_accounts: clone(options.wechat_accounts || [{ id: "wechat-account-1", disabled_at: null }]),
    wechat_sessions: clone(options.wechat_sessions || []),
    dream_records: clone(options.dream_records || []),
    inserts: [],
    updates: [],
    failTable: options.failTable || "",
    insertConflictOnce: options.insertConflictOnce || "",
    missMaybeSingleOnce: options.missMaybeSingleOnce || ""
  };

  function matches(row, filters) {
    return filters.every((filter) => row[filter.column] === filter.value);
  }

  function createQuery(tableName) {
    const filters = [];
    const orderBy = { column: "", ascending: true };

    const query = {
      select() {
        return query;
      },
      eq(column, value) {
        filters.push({ column, value });
        return query;
      },
      is(column, value) {
        filters.push({ column, value });
        return query;
      },
      order(column, options = {}) {
        orderBy.column = column;
        orderBy.ascending = options.ascending !== false;
        return query;
      },
      limit() {
        return query;
      },
      maybeSingle: async () => {
        if (state.failTable === tableName) return { data: null, error: new Error(`${tableName} failed`) };
        if (state.missMaybeSingleOnce === tableName) {
          state.missMaybeSingleOnce = "";
          return { data: null, error: null };
        }
        return { data: clone(state[tableName].find((row) => matches(row, filters)) || null), error: null };
      },
      single: async () => {
        if (state.failTable === tableName) return { data: null, error: new Error(`${tableName} failed`) };
        const row = state[tableName].find((item) => matches(item, filters));
        return { data: clone(row || null), error: row ? null : new Error(`${tableName} not found`) };
      },
      then(resolve) {
        if (state.failTable === tableName) {
          return resolve({ data: null, error: new Error(`${tableName} failed`) });
        }
        let rows = state[tableName].filter((row) => matches(row, filters));
        if (orderBy.column) {
          rows = rows.sort((left, right) => {
            const compared = String(left[orderBy.column] || "").localeCompare(String(right[orderBy.column] || ""));
            return orderBy.ascending ? compared : -compared;
          });
        }
        return resolve({ data: clone(rows), error: null });
      }
    };

    return query;
  }

  return {
    state,
    from(tableName) {
      assert.ok(Object.hasOwn(state, tableName), `unexpected table ${tableName}`);
      return {
        select: createQuery(tableName).select,
        eq: createQuery(tableName).eq,
        insert(value) {
          const rows = Array.isArray(value) ? value : [value];
          if (state.failTable === tableName) {
            return { select: () => ({ single: async () => ({ data: null, error: new Error(`${tableName} failed`) }) }) };
          }
          if (state.insertConflictOnce === tableName) {
            state.insertConflictOnce = "";
            const error = new Error(`${tableName} unique conflict`);
            error.code = "23505";
            return { select: () => ({ single: async () => ({ data: null, error }) }) };
          }
          const inserted = rows.map((row) => ({
            id: row.id || `${tableName}-${state[tableName].length + 1}`,
            ...clone(row)
          }));
          state[tableName].push(...inserted);
          state.inserts.push({ tableName, rows: clone(inserted) });
          return {
            select() {
              return {
                single: async () => ({ data: clone(inserted[0]), error: null })
              };
            }
          };
        },
        update(values) {
          const filters = [];
          const api = {
            eq(column, value) {
              filters.push({ column, value });
              return api;
            },
            select() {
              return {
                single: async () => {
                  if (state.failTable === tableName) return { data: null, error: new Error(`${tableName} failed`) };
                  const row = state[tableName].find((item) => matches(item, filters));
                  if (!row) return { data: null, error: new Error(`${tableName} not found`) };
                  Object.assign(row, clone(values));
                  state.updates.push({ tableName, filters: clone(filters), values: clone(values) });
                  return { data: clone(row), error: null };
                }
              };
            },
            then(resolve) {
              if (state.failTable === tableName) return resolve({ data: null, error: new Error(`${tableName} failed`) });
              state[tableName].filter((row) => matches(row, filters)).forEach((row) => Object.assign(row, clone(values)));
              state.updates.push({ tableName, filters: clone(filters), values: clone(values) });
              return resolve({ data: null, error: null });
            }
          };
          return api;
        },
        upsert(value, options = {}) {
          const rows = Array.isArray(value) ? value : [value];
          if (state.failTable === tableName) {
            return { select: () => ({ single: async () => ({ data: null, error: new Error(`${tableName} failed`) }) }) };
          }
          const saved = rows.map((row) => {
            const existing = state[tableName].find((item) => (
              options.onConflict === "wechat_account_id" && item.wechat_account_id === row.wechat_account_id
            ));
            if (existing) {
              Object.assign(existing, clone(row));
              return existing;
            }
            const inserted = { id: row.id || `${tableName}-${state[tableName].length + 1}`, ...clone(row) };
            state[tableName].push(inserted);
            return inserted;
          });
          return {
            select() {
              return {
                single: async () => ({ data: clone(saved[0]), error: null })
              };
            }
          };
        }
      };
    }
  };
}

function createClientWithSession(options = {}) {
  const token = options.token || "wechat-session-token";
  const client = createFakeCloudClient({
    ...options,
    wechat_sessions: [{
      account_id: "wechat-account-1",
      token_hash: createWechatSessionHash(token, env.WECHAT_SESSION_HASH_SECRET),
      expires_at: "2026-07-29T00:00:00.000Z",
      revoked_at: null
    }]
  });
  return { client, token };
}

function createService(client, options = {}) {
  const logs = [];
  const logger = {
    error(...args) {
      logs.push(args.join(" "));
    },
    warn(...args) {
      logs.push(args.join(" "));
    }
  };
  return {
    logs,
    service: createMiniProgramDreamSyncService({
      getAdminClient: () => client,
      env,
      logger,
      now: () => new Date(options.now || "2026-07-28T00:00:00.000Z")
    })
  };
}

function createLocalRecord(overrides = {}) {
  return {
    localRecordId: overrides.localRecordId || "local-one",
    cloudRecordId: overrides.cloudRecordId || "",
    createdAt: overrides.createdAt || "2026-07-28T00:00:00.000Z",
    updatedAt: overrides.updatedAt || "2026-07-28T00:00:00.000Z",
    lastSyncedAt: overrides.lastSyncedAt || "",
    dreamText: overrides.dreamText || "我梦见一扇门",
    sleepQuality: overrides.sleepQuality || "未记录",
    analysisType: overrides.analysisType || "快速解析",
    reportContent: overrides.reportContent || { analysis: { dreamSummary: "门的记录。" } },
    dreamResultCard: overrides.dreamResultCard || { coreInsight: "也许在靠近一个入口。" },
    ...overrides
  };
}

test("mini program dream sync requires a valid WeChat session", async () => {
  const { client } = createClientWithSession();
  const { service } = createService(client);

  await assert.rejects(
    () => service.syncDreams(createRequest("", { records: [createLocalRecord()] })),
    (error) => error.code === "AUTH_INVALID" && error.status === 401
  );

  await assert.rejects(
    () => service.syncDreams(createRequest("bad-token", { records: [createLocalRecord()] })),
    (error) => error.code === "AUTH_INVALID" && error.status === 401
  );
});

test("first batch sync creates an app user and writes dream_records with server resolved user_id", async () => {
  const { client, token } = createClientWithSession();
  const { service, logs } = createService(client);

  const result = await service.syncDreams(createRequest(token, { records: [createLocalRecord()] }));

  assert.equal(result.ok, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].syncStatus, "synced");
  assert.equal(result.records[0].cloudRecordId, "dream_records-1");
  assert.equal(client.state.app_users.length, 1);
  assert.equal(client.state.app_users[0].wechat_account_id, "wechat-account-1");
  assert.equal(client.state.dream_records.length, 1);
  assert.equal(client.state.dream_records[0].user_id, client.state.app_users[0].id);
  assert.equal(client.state.dream_records[0].local_record_id, "local-one");
  assert.equal(client.state.dream_records[0].raw_dream_text, "我梦见一扇门");
  assert.equal(client.state.dream_records[0].source, "wechat_miniprogram");
  assert.equal(client.state.dream_records[0].sync_status, "synced");
  assert.equal(logs.join("\n").includes("我梦见一扇门"), false);
});

test("repeated batch sync updates by user_id and local_record_id without duplicates", async () => {
  const { client, token } = createClientWithSession();
  const { service } = createService(client);

  await service.syncDreams(createRequest(token, { records: [createLocalRecord()] }));
  await service.syncDreams(createRequest(token, {
    records: [createLocalRecord({
      updatedAt: "2026-07-28T00:05:00.000Z",
      lastSyncedAt: "2026-07-28T00:00:00.000Z",
      dreamText: "我梦见同一扇门"
    })]
  }));

  assert.equal(client.state.dream_records.length, 1);
  assert.equal(client.state.dream_records[0].raw_dream_text, "我梦见同一扇门");
  assert.equal(client.state.dream_records[0].updated_at, "2026-07-28T00:05:00.000Z");
});

test("duplicate concurrent insert conflicts are re-read as idempotent sync", async () => {
  const localRecord = createLocalRecord();
  const { client, token } = createClientWithSession({
    app_users: [{ id: "app-user-existing", wechat_account_id: "wechat-account-1" }],
    insertConflictOnce: "dream_records",
    missMaybeSingleOnce: "dream_records",
    dream_records: [{
      id: "cloud-existing",
      user_id: "app-user-existing",
      local_record_id: "local-one",
      created_at: "2026-07-28T00:00:00.000Z",
      updated_at: "2026-07-28T00:00:00.000Z",
      raw_dream_text: localRecord.dreamText,
      dream_summary: "门的记录。",
      emotions: [],
      symbols: [],
      sleep_quality: "未记录",
      analysis_type: "快速解析",
      report_content: {
        ...localRecord.reportContent,
        dreamResultCard: localRecord.dreamResultCard
      },
      source: "wechat_miniprogram",
      sync_status: "synced",
      deleted_at: null,
      synced_at: "2026-07-28T00:00:00.000Z"
    }]
  });
  const { service } = createService(client);

  const result = await service.syncDreams(createRequest(token, { records: [localRecord] }));

  assert.equal(result.ok, true);
  assert.equal(client.state.dream_records.length, 1);
  assert.equal(result.records[0].cloudRecordId, "cloud-existing");
  assert.equal(result.records[0].syncStatus, "synced");
});

test("ambiguous sync without a last synced timestamp returns a conflict instead of overwriting cloud", async () => {
  const { client, token } = createClientWithSession({
    app_users: [{ id: "app-user-1", wechat_account_id: "wechat-account-1", supabase_user_id: null }],
    dream_records: [{
      id: "cloud-existing",
      user_id: "app-user-1",
      local_record_id: "local-one",
      created_at: "2026-07-28T00:00:00.000Z",
      updated_at: "2026-07-28T00:02:00.000Z",
      raw_dream_text: "云端已有版本",
      sleep_quality: "未记录",
      analysis_type: "快速解析",
      report_content: { analysis: { dreamSummary: "云端。" } },
      source: "wechat_miniprogram",
      sync_status: "synced",
      deleted_at: null,
      synced_at: "2026-07-28T00:02:00.000Z"
    }]
  });
  const { service } = createService(client);

  const result = await service.syncDreams(createRequest(token, {
    records: [createLocalRecord({
      updatedAt: "2026-07-28T00:05:00.000Z",
      lastSyncedAt: "",
      dreamText: "本地无法判断是否覆盖的版本"
    })]
  }));

  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].localRecordId, "local-one");
  assert.equal(result.conflicts[0].cloudRecord.dreamText, "云端已有版本");
  assert.equal(client.state.dream_records[0].raw_dream_text, "云端已有版本");
  assert.equal(client.state.updates.filter((update) => update.tableName === "dream_records").length, 0);
});

test("duplicate insert conflicts do not resurrect concurrently deleted tombstones", async () => {
  const { client, token } = createClientWithSession({
    app_users: [{ id: "app-user-existing", wechat_account_id: "wechat-account-1" }],
    insertConflictOnce: "dream_records",
    missMaybeSingleOnce: "dream_records",
    dream_records: [{
      id: "cloud-deleted",
      user_id: "app-user-existing",
      local_record_id: "local-one",
      created_at: "2026-07-28T00:00:00.000Z",
      updated_at: "2026-07-28T00:10:00.000Z",
      raw_dream_text: "已经删除的梦",
      dream_summary: "删除摘要",
      emotions: [],
      symbols: [],
      sleep_quality: "未记录",
      analysis_type: "快速解析",
      report_content: {},
      source: "wechat_miniprogram",
      sync_status: "synced",
      deleted_at: "2026-07-28T00:10:00.000Z",
      synced_at: "2026-07-28T00:10:00.000Z"
    }]
  });
  const { service } = createService(client);

  const result = await service.syncDreams(createRequest(token, { records: [createLocalRecord({ dreamText: "旧设备重新上传" })] }));

  assert.equal(result.deletedRecords.length, 1);
  assert.equal(result.records.length, 0);
  assert.equal(client.state.dream_records[0].deleted_at, "2026-07-28T00:10:00.000Z");
  assert.equal(client.state.dream_records[0].raw_dream_text, "已经删除的梦");
});

test("cloud newer records are restored instead of overwritten", async () => {
  const { client, token } = createClientWithSession({
    app_users: [{ id: "app-user-1", wechat_account_id: "wechat-account-1", supabase_user_id: null }],
    dream_records: [{
      id: "cloud-existing",
      user_id: "app-user-1",
      local_record_id: "local-one",
      created_at: "2026-07-28T00:00:00.000Z",
      updated_at: "2026-07-28T00:10:00.000Z",
      raw_dream_text: "云端较新的梦",
      sleep_quality: "未记录",
      analysis_type: "快速解析",
      report_content: { analysis: { dreamSummary: "云端版本。" } },
      source: "wechat_miniprogram",
      sync_status: "synced",
      deleted_at: null,
      synced_at: "2026-07-28T00:10:00.000Z"
    }]
  });
  const { service } = createService(client);

  const result = await service.syncDreams(createRequest(token, {
    records: [createLocalRecord({
      cloudRecordId: "cloud-existing",
      updatedAt: "2026-07-28T00:05:00.000Z",
      lastSyncedAt: "2026-07-28T00:01:00.000Z",
      dreamText: "本地较旧的梦"
    })]
  }));

  assert.equal(result.restoredRecords.length, 1);
  assert.equal(result.restoredRecords[0].dreamText, "云端较新的梦");
  assert.equal(client.state.dream_records[0].raw_dream_text, "云端较新的梦");
});

test("equal timestamp conflicts keep local and return a conflict copy instruction", async () => {
  const { client, token } = createClientWithSession({
    app_users: [{ id: "app-user-1", wechat_account_id: "wechat-account-1", supabase_user_id: null }],
    dream_records: [{
      id: "cloud-existing",
      user_id: "app-user-1",
      local_record_id: "local-one",
      created_at: "2026-07-28T00:00:00.000Z",
      updated_at: "2026-07-28T00:10:00.000Z",
      raw_dream_text: "云端版本",
      sleep_quality: "未记录",
      analysis_type: "快速解析",
      report_content: { analysis: { dreamSummary: "云端。" } },
      source: "wechat_miniprogram",
      sync_status: "synced",
      deleted_at: null,
      synced_at: "2026-07-28T00:10:00.000Z"
    }]
  });
  const { service } = createService(client);

  const result = await service.syncDreams(createRequest(token, {
    records: [createLocalRecord({
      cloudRecordId: "cloud-existing",
      updatedAt: "2026-07-28T00:10:00.000Z",
      lastSyncedAt: "2026-07-28T00:01:00.000Z",
      dreamText: "本地版本"
    })]
  }));

  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].localRecordId, "local-one");
  assert.equal(result.conflicts[0].cloudRecord.dreamText, "云端版本");
  assert.equal(client.state.dream_records[0].raw_dream_text, "云端版本");
});

test("soft deletes use deleted_at and old devices receive deleted tombstones", async () => {
  const { client, token } = createClientWithSession({
    app_users: [{ id: "app-user-1", wechat_account_id: "wechat-account-1", supabase_user_id: null }],
    dream_records: [{
      id: "cloud-existing",
      user_id: "app-user-1",
      local_record_id: "local-one",
      created_at: "2026-07-28T00:00:00.000Z",
      updated_at: "2026-07-28T00:00:00.000Z",
      raw_dream_text: "会被删除的梦",
      sleep_quality: "未记录",
      analysis_type: "快速解析",
      report_content: {},
      source: "wechat_miniprogram",
      sync_status: "synced",
      deleted_at: null,
      synced_at: "2026-07-28T00:00:00.000Z"
    }]
  });
  const { service } = createService(client);

  const deleted = await service.deleteDream(createRequest(token), "cloud-existing");
  assert.equal(deleted.ok, true);
  assert.equal(client.state.dream_records[0].deleted_at, "2026-07-28T00:00:00.000Z");

  const result = await service.syncDreams(createRequest(token, {
    records: [createLocalRecord({
      cloudRecordId: "cloud-existing",
      updatedAt: "2026-07-28T00:00:00.000Z",
      lastSyncedAt: "2026-07-28T00:00:00.000Z",
      dreamText: "旧设备重新上传"
    })]
  }));

  assert.equal(result.deletedRecords.length, 1);
  assert.equal(client.state.dream_records[0].raw_dream_text, "会被删除的梦");
});

test("direct update does not resurrect a soft-deleted cloud record", async () => {
  const { client, token } = createClientWithSession({
    app_users: [{ id: "app-user-1", wechat_account_id: "wechat-account-1", supabase_user_id: null }],
    dream_records: [{
      id: "cloud-deleted",
      user_id: "app-user-1",
      local_record_id: "local-one",
      created_at: "2026-07-28T00:00:00.000Z",
      updated_at: "2026-07-28T00:10:00.000Z",
      raw_dream_text: "已经删除的云端记录",
      sleep_quality: "未记录",
      analysis_type: "快速解析",
      report_content: {},
      source: "wechat_miniprogram",
      sync_status: "synced",
      deleted_at: "2026-07-28T00:10:00.000Z",
      synced_at: "2026-07-28T00:10:00.000Z"
    }]
  });
  const { service } = createService(client);

  const result = await service.updateDream(createRequest(token, createLocalRecord({
    cloudRecordId: "cloud-deleted",
    updatedAt: "2026-07-28T00:20:00.000Z",
    dreamText: "旧设备试图修改已删除记录"
  })), "cloud-deleted");

  assert.equal(result.ok, true);
  assert.equal(result.record.deletedAt, "2026-07-28T00:10:00.000Z");
  assert.equal(client.state.dream_records[0].deleted_at, "2026-07-28T00:10:00.000Z");
  assert.equal(client.state.dream_records[0].raw_dream_text, "已经删除的云端记录");
});

test("listDreams returns only current app user's active cloud dreams and deleted tombstones", async () => {
  const { client, token } = createClientWithSession({
    app_users: [{ id: "app-user-1", wechat_account_id: "wechat-account-1", supabase_user_id: null }],
    dream_records: [
      {
        id: "cloud-current",
        user_id: "app-user-1",
        local_record_id: "local-current",
        created_at: "2026-07-28T00:00:00.000Z",
        updated_at: "2026-07-28T00:00:00.000Z",
        raw_dream_text: "当前用户的梦",
        sleep_quality: "未记录",
        analysis_type: "快速解析",
        report_content: {},
        source: "wechat_miniprogram",
        sync_status: "synced",
        deleted_at: null,
        synced_at: "2026-07-28T00:00:00.000Z"
      },
      {
        id: "cloud-deleted",
        user_id: "app-user-1",
        local_record_id: "local-deleted",
        created_at: "2026-07-28T00:00:00.000Z",
        updated_at: "2026-07-28T00:10:00.000Z",
        raw_dream_text: "当前用户已删除的梦",
        sleep_quality: "未记录",
        analysis_type: "快速解析",
        report_content: {},
        source: "wechat_miniprogram",
        sync_status: "synced",
        deleted_at: "2026-07-28T00:10:00.000Z",
        synced_at: "2026-07-28T00:10:00.000Z"
      },
      {
        id: "cloud-other",
        user_id: "other-user",
        local_record_id: "local-other",
        created_at: "2026-07-28T00:00:00.000Z",
        updated_at: "2026-07-28T00:00:00.000Z",
        raw_dream_text: "其他用户的梦",
        sleep_quality: "未记录",
        analysis_type: "快速解析",
        report_content: {},
        source: "wechat_miniprogram",
        sync_status: "synced",
        deleted_at: null,
        synced_at: "2026-07-28T00:00:00.000Z"
      }
    ]
  });
  const { service } = createService(client);

  const result = await service.listDreams(createRequest(token));

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].cloudRecordId, "cloud-current");
  assert.equal(result.records[0].dreamText, "当前用户的梦");
  assert.equal(result.deletedRecords.length, 1);
  assert.equal(result.deletedRecords[0].cloudRecordId, "cloud-deleted");
  assert.equal(result.deletedRecords[0].deletedAt, "2026-07-28T00:10:00.000Z");
  assert.equal(JSON.stringify(result).includes("其他用户的梦"), false);
});

test("validation rejects forged user id, oversized batches, and long dream text before writing", async () => {
  const { client, token } = createClientWithSession();
  const { service } = createService(client);

  await assert.rejects(
    () => service.syncDreams(createRequest(token, { userId: "forged-user", records: [createLocalRecord()] })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );

  await assert.rejects(
    () => service.syncDreams(createRequest(token, { records: [createLocalRecord({ user_id: "forged-user" })] })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );

  await assert.rejects(
    () => service.syncDreams(createRequest(token, { records: Array.from({ length: 51 }, (_, index) => createLocalRecord({ localRecordId: `local-${index}` })) })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );

  await assert.rejects(
    () => service.syncDreams(createRequest(token, { records: [createLocalRecord({ dreamText: "梦".repeat(5001) })] })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );

  await assert.rejects(
    () => service.syncDreams(createRequest(token, { records: [createLocalRecord({ localRecordId: "x".repeat(129) })] })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );

  await assert.rejects(
    () => service.syncDreams(createRequest(token, { records: [createLocalRecord({ reportContent: "not-json-object" })] })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );

  await assert.rejects(
    () => service.syncDreams(createRequest(token, {
      records: [createLocalRecord({
        reportContent: {
          analysis: {
            dreamSummary: "摘要",
            coreInterpretation: "x".repeat(5001)
          }
        }
      })]
    })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );

  await assert.rejects(
    () => service.syncDreams(createRequest(token, {
      records: [createLocalRecord({
        reportContent: {
          blocks: Array.from({ length: 101 }, (_, index) => `片段 ${index}`)
        }
      })]
    })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );

  assert.equal(client.state.dream_records.length, 0);
});
