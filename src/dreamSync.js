(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamSync = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const tableName = "dream_records";
  const syncedStatus = "synced";
  const pendingStatus = "pending_sync";
  const localStorageSource = "local_storage";
  const appSource = "app";

  function safeParseRecords(storage, storageKey) {
    try {
      const savedRecords = storage.getItem(storageKey);
      const parsedRecords = savedRecords ? JSON.parse(savedRecords) : [];
      return Array.isArray(parsedRecords) ? parsedRecords : [];
    } catch (error) {
      return [];
    }
  }

  function writeRecords(storage, storageKey, records) {
    storage.setItem(storageKey, JSON.stringify(records));
  }

  function toTextArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (!value) {
      return [];
    }

    const text = String(value).trim();

    if (!text) {
      return [];
    }

    if (text.length <= 80 && /[、,，]/.test(text)) {
      return text.split(/[、,，]/).map((item) => item.trim()).filter(Boolean);
    }

    return [text];
  }

  function textFromList(value) {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join("、");
    }

    return value || "未记录";
  }

  function getLocalRecordId(record) {
    return String(record.localRecordId || record.local_record_id || record.id);
  }

  function mapLocalRecordToSupabaseRow(record, user, options = {}) {
    const createdAt = record.createdAt || record.created_at || new Date().toISOString();

    return {
      user_id: user.id,
      local_record_id: getLocalRecordId(record),
      created_at: createdAt,
      raw_dream_text: record.rawDreamText || record.raw_dream_text || "",
      dream_summary: record.dreamSummary || record.dream_summary || "",
      emotions: toTextArray(record.emotions),
      symbols: toTextArray(record.symbols),
      sleep_quality: record.sleepQuality || record.sleep_quality || "未记录",
      analysis_type: record.analysisType || record.analysis_type || "快速解析",
      report_content: record.reportContent || record.report_content || {},
      source: options.source || record.source || localStorageSource,
      sync_status: options.syncStatus || syncedStatus
    };
  }

  function mapSupabaseRowToLocalRecord(row) {
    return {
      id: row.local_record_id || row.id,
      cloudId: row.id,
      userId: row.user_id,
      localRecordId: row.local_record_id || row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      rawDreamText: row.raw_dream_text || "",
      dreamSummary: row.dream_summary || "未记录",
      emotions: textFromList(row.emotions),
      symbols: textFromList(row.symbols),
      sleepQuality: row.sleep_quality || "未记录",
      analysisType: row.analysis_type || "梦境",
      reportContent: row.report_content || {},
      source: row.source || localStorageSource,
      syncStatus: row.sync_status || syncedStatus
    };
  }

  function decorateRecord(record, user, syncStatus, source, cloudId) {
    return {
      ...record,
      userId: user ? user.id : record.userId,
      localRecordId: getLocalRecordId(record),
      cloudId: cloudId || record.cloudId,
      source: source || record.source || localStorageSource,
      syncStatus
    };
  }

  function sortRecords(records) {
    return [...records].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }

  function mergeRecords(primaryRecords, fallbackRecords) {
    const seen = new Set();
    const merged = [];

    [...primaryRecords, ...fallbackRecords].forEach((record) => {
      const key = record.localRecordId || record.id;
      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      merged.push(record);
    });

    return sortRecords(merged);
  }

  async function upsertRows(client, rows) {
    const response = await client
      .from(tableName)
      .upsert(rows, { onConflict: "user_id,local_record_id" })
      .select();

    if (response.error) {
      throw response.error;
    }

    return response.data || [];
  }

  async function fetchRows(client, user) {
    const response = await client
      .from(tableName)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (response.error) {
      throw response.error;
    }

    return response.data || [];
  }

  function createDreamSyncController(options) {
    const storage = options.storage;
    const storageKey = options.storageKey;
    const onRecordsChange = options.onRecordsChange || function () {};
    const onStatusChange = options.onStatusChange || function () {};
    let client = options.client || null;
    let session = null;
    let cloudRecords = [];
    let cloudLoaded = false;
    let isSyncing = false;

    function getUser() {
      return session && session.user ? session.user : null;
    }

    function loadAllRecords() {
      return safeParseRecords(storage, storageKey);
    }

    function saveAllRecords(records) {
      writeRecords(storage, storageKey, records);
    }

    function upsertLocalRecord(record) {
      const records = loadAllRecords();
      const localRecordId = getLocalRecordId(record);
      const existingIndex = records.findIndex((item) => getLocalRecordId(item) === localRecordId);

      if (existingIndex >= 0) {
        records[existingIndex] = { ...records[existingIndex], ...record };
      } else {
        records.unshift(record);
      }

      saveAllRecords(sortRecords(records));
    }

    function markLocalRecords(recordsToMark, patch) {
      const ids = new Set(recordsToMark.map((record) => getLocalRecordId(record)));
      const records = loadAllRecords().map((record) => {
        if (!ids.has(getLocalRecordId(record))) {
          return record;
        }

        return {
          ...record,
          ...patch,
          localRecordId: getLocalRecordId(record)
        };
      });

      saveAllRecords(records);
    }

    function getPendingRecords(user) {
      return loadAllRecords().filter((record) => {
        return record.userId === user.id && record.syncStatus === pendingStatus;
      });
    }

    function getMigrationCandidates(user) {
      return loadAllRecords().filter((record) => {
        if (record.syncStatus === syncedStatus) {
          return false;
        }

        if (record.userId && record.userId !== user.id) {
          return false;
        }

        return !record.userId || record.syncStatus === pendingStatus;
      });
    }

    function getVisibleRecords() {
      const user = getUser();
      const records = loadAllRecords();

      if (!user) {
        return sortRecords(records.filter((record) => !record.userId));
      }

      const userLocalRecords = records.filter((record) => record.userId === user.id);
      const pendingRecords = userLocalRecords.filter((record) => record.syncStatus === pendingStatus);

      if (!cloudLoaded) {
        return sortRecords(userLocalRecords);
      }

      return mergeRecords(cloudRecords, pendingRecords);
    }

    function emitRecords() {
      onRecordsChange(getVisibleRecords());
    }

    async function loadCloudRecords() {
      const user = getUser();

      if (!client || !user) {
        cloudRecords = [];
        cloudLoaded = false;
        emitRecords();
        return [];
      }

      const rows = await fetchRows(client, user);
      cloudRecords = rows.map(mapSupabaseRowToLocalRecord);
      cloudLoaded = true;
      emitRecords();
      return cloudRecords;
    }

    async function retryPendingRecords() {
      const user = getUser();

      if (!client || !user) {
        return { syncedCount: 0 };
      }

      const pendingRecords = getPendingRecords(user);

      if (pendingRecords.length === 0) {
        return { syncedCount: 0 };
      }

      try {
        const rows = pendingRecords.map((record) =>
          mapLocalRecordToSupabaseRow(record, user, { source: record.source || appSource })
        );
        await upsertRows(client, rows);
        markLocalRecords(pendingRecords, {
          userId: user.id,
          syncStatus: syncedStatus
        });
        await loadCloudRecords();
        return { syncedCount: pendingRecords.length };
      } catch (error) {
        onStatusChange("部分记录暂未同步，将在网络恢复后重试。");
        emitRecords();
        return { syncedCount: 0, pendingCount: pendingRecords.length };
      }
    }

    async function syncCurrentUser() {
      const user = getUser();

      if (!client || !user || isSyncing) {
        emitRecords();
        return { migratedCount: 0, pendingCount: 0 };
      }

      isSyncing = true;
      const candidates = getMigrationCandidates(user);
      let migratedCount = 0;
      let pendingCount = 0;

      if (candidates.length > 0) {
        onStatusChange("正在整理你的梦境档案……");
      }

      try {
        if (candidates.length > 0) {
          const rows = candidates.map((record) =>
            mapLocalRecordToSupabaseRow(record, user, { source: record.source || localStorageSource })
          );
          await upsertRows(client, rows);
          markLocalRecords(candidates, {
            userId: user.id,
            syncStatus: syncedStatus,
            source: localStorageSource
          });
          migratedCount = candidates.length;
          onStatusChange(`已同步 ${migratedCount} 条本地梦境。`);
        }

        await retryPendingRecords();
        await loadCloudRecords();
      } catch (error) {
        if (candidates.length > 0) {
          markLocalRecords(candidates, {
            userId: user.id,
            syncStatus: pendingStatus,
            source: localStorageSource
          });
          pendingCount = candidates.length;
          onStatusChange("部分记录暂未同步，将在网络恢复后重试。");
        }

        emitRecords();
      } finally {
        isSyncing = false;
      }

      return { migratedCount, pendingCount };
    }

    async function setSession(nextSession, nextClient) {
      session = nextSession || null;

      if (nextClient) {
        client = nextClient;
      }

      if (!session) {
        cloudRecords = [];
        cloudLoaded = false;
        onStatusChange("");
        emitRecords();
        return { migratedCount: 0, pendingCount: 0 };
      }

      return syncCurrentUser();
    }

    async function saveRecord(record) {
      const user = getUser();

      if (!client || !user) {
        const localRecord = {
          ...record,
          localRecordId: getLocalRecordId(record)
        };
        upsertLocalRecord(localRecord);
        emitRecords();
        return { records: getVisibleRecords(), syncStatus: "local" };
      }

      try {
        const row = mapLocalRecordToSupabaseRow(record, user, { source: appSource });
        const savedRows = await upsertRows(client, [row]);
        const savedRow = savedRows[0] || row;
        const localRecord = decorateRecord(record, user, syncedStatus, appSource, savedRow.id);

        upsertLocalRecord(localRecord);
        await loadCloudRecords();
        return { records: getVisibleRecords(), syncStatus: syncedStatus };
      } catch (error) {
        const pendingRecord = decorateRecord(record, user, pendingStatus, appSource);

        upsertLocalRecord(pendingRecord);
        onStatusChange("部分记录暂未同步，将在网络恢复后重试。");
        emitRecords();
        return { records: getVisibleRecords(), syncStatus: pendingStatus };
      }
    }

    function setClient(nextClient) {
      client = nextClient;
    }

    return {
      getVisibleRecords,
      loadAllRecords,
      loadCloudRecords,
      retryPendingRecords,
      saveRecord,
      setClient,
      setSession,
      syncCurrentUser
    };
  }

  return {
    appSource,
    createDreamSyncController,
    localStorageSource,
    mapLocalRecordToSupabaseRow,
    mapSupabaseRowToLocalRecord,
    pendingStatus,
    syncedStatus,
    toTextArray
  };
});
