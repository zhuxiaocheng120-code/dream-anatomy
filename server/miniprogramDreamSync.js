const { createApiError } = require("./aiErrors");
const { createWechatSessionStore } = require("./wechatSession");

const maxBatchRecords = 50;
const maxDreamTextLength = 5000;
const maxLocalRecordIdLength = 128;
const maxTextFieldLength = 5000;
const maxReportContentBytes = 120000;
const maxReportContentDepth = 12;
const maxReportContentCollectionLength = 100;

function toDate(value) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function toIso(value, fallback = new Date()) {
  const date = toDate(value);
  return (date || fallback).toISOString();
}

function toMs(value) {
  const date = toDate(value);
  return date ? date.getTime() : null;
}

function normalizeText(value, maxLength = maxTextFieldLength) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, maxLength);
}

function getTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertValidReportContentValue(value, depth = 0) {
  if (depth > maxReportContentDepth) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    if (value.length > maxTextFieldLength) {
      throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
    }
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    if (value.length > maxReportContentCollectionLength) {
      throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
    }
    value.forEach((item) => assertValidReportContentValue(item, depth + 1));
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > maxReportContentCollectionLength) {
      throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
    }
    entries.forEach(([key, item]) => {
      if (typeof key !== "string" || key.length > 120) {
        throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
      }
      assertValidReportContentValue(item, depth + 1);
    });
    return;
  }
  throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
}

function validateReportContentObject(value) {
  assertValidReportContentValue(value, 0);
  const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (bytes > maxReportContentBytes) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item, 80)).filter(Boolean).slice(0, 8);
  }
  if (typeof value === "string") {
    return value.split(/[，,、]/).map((item) => normalizeText(item, 80)).filter(Boolean).slice(0, 8);
  }
  return [];
}

function assertSuccess(response, message = "梦境同步暂时没有完成，请稍后再试。") {
  if (response && response.error) {
    throw createApiError("INTERNAL_ERROR", message, 500);
  }
  return response ? response.data : null;
}

function isUniqueConflict(error) {
  return error && (error.code === "23505" || /duplicate key|unique/i.test(String(error.message || "")));
}

function validateIsoField(record, fieldName) {
  if (record[fieldName] && !toDate(record[fieldName])) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }
}

function validateLocalRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }
  if (Object.prototype.hasOwnProperty.call(input, "user_id") || Object.prototype.hasOwnProperty.call(input, "userId")) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }

  const localRecordId = getTrimmedString(input.localRecordId);
  if (!localRecordId || localRecordId.length > maxLocalRecordIdLength) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }

  const dreamText = getTrimmedString(input.dreamText);
  if (dreamText.length > maxDreamTextLength) {
    throw createApiError("INVALID_REQUEST", "梦境内容最多 5000 字。", 400);
  }

  validateIsoField(input, "createdAt");
  validateIsoField(input, "updatedAt");
  validateIsoField(input, "lastSyncedAt");
  validateIsoField(input, "deletedAt");

  if (input.reportContent !== undefined && (
    !input.reportContent ||
    typeof input.reportContent !== "object" ||
    Array.isArray(input.reportContent)
  )) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }

  const reportContent = input.reportContent ? { ...input.reportContent } : {};
  validateReportContentObject(reportContent);
  if (input.dreamResultCard && typeof input.dreamResultCard === "object" && !Array.isArray(input.dreamResultCard)) {
    validateReportContentObject(input.dreamResultCard);
    reportContent.dreamResultCard = reportContent.dreamResultCard || input.dreamResultCard;
  }
  validateReportContentObject(reportContent);

  return {
    localRecordId,
    cloudRecordId: normalizeText(input.cloudRecordId, 128),
    createdAt: input.createdAt || "",
    updatedAt: input.updatedAt || "",
    lastSyncedAt: input.lastSyncedAt || "",
    deletedAt: input.deletedAt || "",
    dreamText,
    sleepQuality: normalizeText(input.sleepQuality, 80) || "未记录",
    analysisType: normalizeText(input.analysisType, 80) || "快速解析",
    reportContent,
    dreamResultCard: reportContent.dreamResultCard || null
  };
}

function getDreamSummary(reportContent = {}) {
  const analysis = reportContent.analysis && typeof reportContent.analysis === "object" ? reportContent.analysis : {};
  return normalizeText(
    analysis.dreamSummary ||
      analysis.summary ||
      reportContent.dreamSummary ||
      reportContent.summary ||
      "",
    500
  );
}

function getEmotions(reportContent = {}) {
  const analysis = reportContent.analysis && typeof reportContent.analysis === "object" ? reportContent.analysis : {};
  const emotionalReading = analysis.emotionalReading && typeof analysis.emotionalReading === "object"
    ? analysis.emotionalReading
    : {};
  return normalizeStringArray(
    analysis.emotions ||
      emotionalReading.primaryEmotion ||
      emotionalReading.primary ||
      reportContent.emotions ||
      []
  );
}

function getSymbols(reportContent = {}, dreamResultCard = null) {
  const analysis = reportContent.analysis && typeof reportContent.analysis === "object" ? reportContent.analysis : {};
  const card = dreamResultCard || reportContent.dreamResultCard || {};
  const cardSymbols = Array.isArray(card.symbols) ? card.symbols.map((item) => item && item.name).filter(Boolean) : [];
  const analysisSymbols = Array.isArray(analysis.symbolReading)
    ? analysis.symbolReading.map((item) => item && (item.symbol || item.name)).filter(Boolean)
    : analysis.symbols;
  return normalizeStringArray(cardSymbols.length ? cardSymbols : (analysisSymbols || reportContent.symbols || []));
}

function mapLocalRecordToDreamRow(record, userId, nowDate = new Date()) {
  const createdAt = toIso(record.createdAt, nowDate);
  const updatedAt = toIso(record.updatedAt || record.createdAt, nowDate);
  const deletedAt = record.deletedAt ? toIso(record.deletedAt, nowDate) : null;

  return {
    user_id: userId,
    local_record_id: record.localRecordId,
    created_at: createdAt,
    updated_at: updatedAt,
    raw_dream_text: record.dreamText,
    dream_summary: getDreamSummary(record.reportContent),
    emotions: getEmotions(record.reportContent),
    symbols: getSymbols(record.reportContent, record.dreamResultCard),
    sleep_quality: record.sleepQuality || "未记录",
    analysis_type: record.analysisType,
    report_content: record.reportContent,
    source: "wechat_miniprogram",
    sync_status: "synced",
    deleted_at: deletedAt,
    synced_at: nowDate.toISOString()
  };
}

function mapDreamRowToMiniRecord(row) {
  const reportContent = row.report_content && typeof row.report_content === "object" ? row.report_content : {};
  return {
    localRecordId: row.local_record_id,
    cloudRecordId: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || "",
    lastSyncedAt: row.synced_at || row.updated_at || "",
    dreamText: row.raw_dream_text || "",
    sleepQuality: row.sleep_quality || "未记录",
    analysisType: row.analysis_type || "快速解析",
    reportContent,
    dreamResultCard: reportContent.dreamResultCard || null,
    syncStatus: "synced"
  };
}

async function resolveAppUserId(client, wechatAccountId, nowDate) {
  const existing = assertSuccess(await client
    .from("app_users")
    .select("id")
    .eq("wechat_account_id", wechatAccountId)
    .maybeSingle());
  if (existing && existing.id) return existing.id;

  const inserted = assertSuccess(await client
    .from("app_users")
    .upsert({
      wechat_account_id: wechatAccountId,
      created_at: nowDate.toISOString(),
      updated_at: nowDate.toISOString()
    }, { onConflict: "wechat_account_id" })
    .select("id")
    .single());

  if (!inserted || !inserted.id) {
    throw createApiError("INTERNAL_ERROR", "梦境同步暂时没有完成，请稍后再试。", 500);
  }

  return inserted.id;
}

async function findDreamByLocalId(client, userId, localRecordId) {
  return assertSuccess(await client
    .from("dream_records")
    .select("*")
    .eq("user_id", userId)
    .eq("local_record_id", localRecordId)
    .maybeSingle());
}

async function findDreamByCloudId(client, userId, cloudRecordId) {
  return assertSuccess(await client
    .from("dream_records")
    .select("*")
    .eq("id", cloudRecordId)
    .eq("user_id", userId)
    .maybeSingle());
}

async function insertDreamRow(client, row) {
  const response = await client
    .from("dream_records")
    .insert(row)
    .select("*")
    .single();
  if (response && response.error) {
    if (isUniqueConflict(response.error)) {
      return null;
    }
    throw createApiError("INTERNAL_ERROR", "梦境同步暂时没有完成，请稍后再试。", 500);
  }
  return response ? response.data : null;
}

async function updateDreamRow(client, cloudRecordId, userId, values) {
  return assertSuccess(await client
    .from("dream_records")
    .update(values)
    .eq("id", cloudRecordId)
    .eq("user_id", userId)
    .select("*")
    .single());
}

function isBothChanged(record, existing) {
  const lastSyncedMs = toMs(record.lastSyncedAt);
  const localMs = toMs(record.updatedAt);
  const cloudMs = toMs(existing && existing.updated_at);
  if (lastSyncedMs === null || localMs === null || cloudMs === null) return false;
  return localMs > lastSyncedMs && cloudMs > lastSyncedMs;
}

function stableStringify(value) {
  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function hasSameDreamContent(row, existing) {
  return String(row.raw_dream_text || "") === String(existing.raw_dream_text || "") &&
    String(row.sleep_quality || "") === String(existing.sleep_quality || "") &&
    String(row.analysis_type || "") === String(existing.analysis_type || "") &&
    stableStringify(row.report_content || {}) === stableStringify(existing.report_content || {});
}

function createConflictResult(record, existing) {
  return {
    type: "conflict",
    localRecordId: record.localRecordId,
    cloudRecord: mapDreamRowToMiniRecord(existing)
  };
}

async function reconcileExistingRecord(client, userId, record, existing, row, nowDate) {
  if (existing.deleted_at) {
    return { type: "deleted", record: mapDreamRowToMiniRecord(existing) };
  }

  const localMs = toMs(record.updatedAt);
  const cloudMs = toMs(existing.updated_at);
  const lastSyncedMs = toMs(record.lastSyncedAt);

  if (hasSameDreamContent(row, existing)) {
    return { type: "synced", record: mapDreamRowToMiniRecord(existing) };
  }

  if (localMs === null || cloudMs === null || lastSyncedMs === null) {
    return createConflictResult(record, existing);
  }

  if (isBothChanged(record, existing)) {
    if (localMs > cloudMs) {
      const updated = await updateDreamRow(client, existing.id, userId, row);
      return { type: "synced", record: mapDreamRowToMiniRecord(updated) };
    }
    if (cloudMs > localMs) {
      return { type: "restored", record: mapDreamRowToMiniRecord(existing) };
    }
    return createConflictResult(record, existing);
  }

  if (cloudMs !== null && localMs !== null && cloudMs > localMs) {
    return { type: "restored", record: mapDreamRowToMiniRecord(existing) };
  }

  if (localMs === cloudMs) {
    return createConflictResult(record, existing);
  }

  const updated = await updateDreamRow(client, existing.id, userId, row);
  return { type: "synced", record: mapDreamRowToMiniRecord(updated) };
}

async function syncOneRecord(client, userId, record, nowDate) {
  const existing = await findDreamByLocalId(client, userId, record.localRecordId);
  const row = mapLocalRecordToDreamRow(record, userId, nowDate);

  if (record.deletedAt) {
    if (!existing) {
      return { type: "deleted", record: { localRecordId: record.localRecordId, deletedAt: row.deleted_at } };
    }
    const deleted = await updateDreamRow(client, existing.id, userId, {
      deleted_at: row.deleted_at || nowDate.toISOString(),
      updated_at: row.updated_at,
      synced_at: nowDate.toISOString(),
      sync_status: "synced"
    });
    return { type: "deleted", record: mapDreamRowToMiniRecord(deleted) };
  }

  if (!existing) {
    const inserted = await insertDreamRow(client, row);
    if (!inserted) {
      const concurrentExisting = await findDreamByLocalId(client, userId, record.localRecordId);
      if (concurrentExisting) {
        return reconcileExistingRecord(client, userId, record, concurrentExisting, row, nowDate);
      }
      throw createApiError("INTERNAL_ERROR", "梦境同步暂时没有完成，请稍后再试。", 500);
    }
    return { type: "synced", record: mapDreamRowToMiniRecord(inserted) };
  }

  return reconcileExistingRecord(client, userId, record, existing, row, nowDate);
}

function validateBatch(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, "user_id") || Object.prototype.hasOwnProperty.call(body, "userId")) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }
  if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > maxBatchRecords) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }
  return body.records.map(validateLocalRecord);
}

function validateCloudRecordId(value) {
  const id = normalizeText(value, 128);
  if (!id || id.length > 128) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }
  return id;
}

function createMiniProgramDreamSyncService({ getAdminClient, env = process.env, now = () => new Date(), logger = console } = {}) {
  function getNowDate() {
    const value = now();
    return value instanceof Date ? value : new Date(value);
  }

  async function requireIdentity(request) {
    const client = getAdminClient && getAdminClient();
    if (!client) {
      throw createApiError("WECHAT_AUTH_UNAVAILABLE", "微信身份服务暂时不可用，请稍后再试。", 503);
    }
    const session = await createWechatSessionStore({ client, env, now }).verifyRequest(request);
    const userId = await resolveAppUserId(client, session.wechatAccountId, getNowDate());
    return { client, userId, session };
  }

  async function syncDreams(request) {
    const records = validateBatch(request && request.body ? request.body : {});
    const { client, userId } = await requireIdentity(request);
    const nowDate = getNowDate();
    const response = {
      ok: true,
      records: [],
      restoredRecords: [],
      conflicts: [],
      deletedRecords: []
    };

    for (const record of records) {
      const result = await syncOneRecord(client, userId, record, nowDate);
      if (result.type === "synced") {
        response.records.push(result.record);
      } else if (result.type === "restored") {
        response.restoredRecords.push(result.record);
      } else if (result.type === "conflict") {
        response.conflicts.push({
          localRecordId: result.localRecordId,
          cloudRecord: result.cloudRecord
        });
      } else if (result.type === "deleted") {
        response.deletedRecords.push(result.record);
      }
    }

    return response;
  }

  async function listDreams(request) {
    const { client, userId } = await requireIdentity(request);
    const result = await client
      .from("dream_records")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(200);
    const rows = assertSuccess(result);
    const mapped = (rows || []).map(mapDreamRowToMiniRecord);
    return {
      ok: true,
      records: mapped.filter((record) => !record.deletedAt),
      deletedRecords: mapped.filter((record) => record.deletedAt)
    };
  }

  async function updateDream(request, cloudRecordId) {
    const recordId = validateCloudRecordId(cloudRecordId);
    const record = validateLocalRecord((request && request.body) || {});
    const { client, userId } = await requireIdentity(request);
    const existing = await findDreamByCloudId(client, userId, recordId);
    if (!existing) {
      throw createApiError("INVALID_REQUEST", "没有找到这条梦境记录。", 400);
    }
    if (existing.deleted_at) {
      return { ok: true, record: mapDreamRowToMiniRecord(existing) };
    }
    const row = mapLocalRecordToDreamRow(record, userId, getNowDate());
    const updated = await updateDreamRow(client, recordId, userId, row);
    return { ok: true, record: mapDreamRowToMiniRecord(updated) };
  }

  async function deleteDream(request, cloudRecordId) {
    const recordId = validateCloudRecordId(cloudRecordId);
    const { client, userId } = await requireIdentity(request);
    const deletedAt = getNowDate().toISOString();
    const updated = await updateDreamRow(client, recordId, userId, {
      deleted_at: deletedAt,
      updated_at: deletedAt,
      synced_at: deletedAt,
      sync_status: "synced"
    });
    return { ok: true, record: mapDreamRowToMiniRecord(updated) };
  }

  return {
    deleteDream,
    listDreams,
    syncDreams,
    updateDream
  };
}

module.exports = {
  createMiniProgramDreamSyncService,
  mapDreamRowToMiniRecord,
  mapLocalRecordToDreamRow,
  validateLocalRecord
};
