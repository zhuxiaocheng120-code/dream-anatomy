const crypto = require("node:crypto");

const PRODUCT_ANALYTICS_VERSION = "2026-07-19";
const ENTRY_POINTS = new Set(["nav", "home", "journal", "auth", "privacy-data"]);
const ERROR_CODES = new Set([
  "AUTH_INVALID",
  "ANALYSIS_TIMEOUT",
  "DAILY_LIMIT_REACHED",
  "FEATURE_DISABLED",
  "GENERATION_INCOMPLETE",
  "INTERNAL_ERROR",
  "INVALID_REQUEST",
  "PRODUCT_ANALYTICS_DISABLED",
  "PRODUCT_ANALYTICS_WRITE_FAILED",
  "RATE_LIMITED",
  "REQUEST_FAILED",
  "REQUEST_IN_PROGRESS",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_UNAVAILABLE"
]);

const EVENT_PROPERTIES = {
  app_opened: {},
  view_opened: { view_name: new Set(["home", "quick", "quick-result", "journal", "dream-detail", "privacy-data", "auth"]) },
  dream_input_started: { entry_point: ENTRY_POINTS },
  dream_input_abandoned: { length_bucket: new Set(["1-50", "51-150", "151-500", "500+"]), view_name: new Set(["home", "quick", "quick-result", "journal", "dream-detail", "privacy-data", "auth"]) },
  analysis_requested: { analysis_type: new Set(["quick", "deep", "result_card"]) },
  analysis_completed: { analysis_type: new Set(["quick", "deep", "result_card"]), source: new Set(["ai_generated", "fallback", "generation_failed", "mock_legacy"]), has_result_card: "boolean" },
  analysis_failed: { analysis_type: new Set(["quick", "deep", "result_card"]), error_code: ERROR_CODES },
  result_viewed: { analysis_type: new Set(["quick", "deep", "result_card"]), source: new Set(["ai_generated", "fallback", "generation_failed", "mock_legacy"]) },
  dream_saved: { analysis_type: new Set(["quick", "deep", "result_card"]), sync_status: new Set(["synced", "pending_sync", "local_only"]) },
  journal_opened: { record_count_bucket: new Set(["0", "1", "2-5", "6-20", "21+"]) },
  dream_detail_opened: { analysis_type: new Set(["quick", "deep", "result_card"]) },
  signup_started: { entry_point: ENTRY_POINTS },
  signup_completed: { method: new Set(["email"]) },
  login_completed: { method: new Set(["email"]) },
  data_export_completed: { record_count_bucket: new Set(["0", "1", "2-5", "6-20", "21+"]) },
  dream_deleted: { analysis_type: new Set(["quick", "deep", "result_card"]) },
  all_dreams_cleared: { record_count_bucket: new Set(["0", "1", "2-5", "6-20", "21+"]) }
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function sanitizeProperties(eventName, properties) {
  const allowedProperties = EVENT_PROPERTIES[eventName];
  const sanitized = {};
  const rawProperties = properties && typeof properties === "object" && !Array.isArray(properties) ? properties : {};

  for (const [property, requirement] of Object.entries(allowedProperties)) {
    const value = rawProperties[property];
    if (requirement === "boolean" && typeof value === "boolean") {
      sanitized[property] = value;
    } else if (requirement instanceof Set && requirement.has(value)) {
      sanitized[property] = value;
    } else if (requirement instanceof RegExp && typeof value === "string" && requirement.test(value)) {
      sanitized[property] = value;
    }
  }

  return sanitized;
}

function sanitizeProductEvent(rawEvent) {
  if (!rawEvent || typeof rawEvent !== "object") return { ok: false, errorCode: "EVENT_INVALID" };
  if (!Object.prototype.hasOwnProperty.call(EVENT_PROPERTIES, rawEvent.eventName)) {
    return { ok: false, errorCode: "EVENT_INVALID" };
  }
  if (!isUuid(rawEvent.eventId)) {
    return { ok: false, errorCode: "EVENT_INVALID" };
  }
  const occurredAt = new Date(rawEvent.occurredAt);
  if (typeof rawEvent.occurredAt !== "string" || Number.isNaN(occurredAt.getTime())) {
    return { ok: false, errorCode: "EVENT_INVALID" };
  }

  return {
    ok: true,
    event: {
      eventId: rawEvent.eventId,
      eventName: rawEvent.eventName,
      occurredAt: occurredAt.toISOString(),
      properties: sanitizeProperties(rawEvent.eventName, rawEvent.properties)
    }
  };
}

function createHash(value, secret) {
  if (!value || !secret) return null;
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function createProductPrincipalHash(identity, installationId, secret) {
  if (!identity || identity.type === "authenticated") {
    return identity && isUuid(identity.userId) ? createHash(`user:${identity.userId}`, secret) : null;
  }
  return identity.type === "guest" && isUuid(installationId)
    ? createHash(`installation:${installationId}`, secret)
    : null;
}

function createProductSessionHash(sessionId, secret) {
  return isUuid(sessionId) ? createHash(`session:${sessionId}`, secret) : null;
}

function normalizeProductEventBatch(body, context = {}) {
  const rawEvents = body && Array.isArray(body.events) ? body.events : [];
  const events = [];
  const rejected = [];
  const identity = context.identity && context.identity.type === "authenticated"
    ? context.identity
    : { type: "guest" };
  const sessionId = body && body.sessionId;
  const installationId = body && body.installationId;

  rawEvents.forEach((rawEvent, index) => {
    if (index >= 20) {
      rejected.push({ errorCode: "BATCH_TOO_LARGE" });
      return;
    }

    const sanitized = sanitizeProductEvent(rawEvent);
    if (!sanitized.ok || Object.hasOwn(rawEvent, "sessionId") || Object.hasOwn(rawEvent, "installationId")) {
      rejected.push({ errorCode: sanitized.errorCode });
      return;
    }

    const principalHash = createProductPrincipalHash(identity, installationId, context.secret);
    const sessionHash = createProductSessionHash(sessionId, context.secret);
    if (!principalHash || !sessionHash) {
      rejected.push({ errorCode: "EVENT_INVALID" });
      return;
    }

    events.push({
      event_id: sanitized.event.eventId,
      occurred_at: sanitized.event.occurredAt,
      event_name: sanitized.event.eventName,
      principal_type: identity.type === "authenticated" ? "authenticated" : "guest",
      principal_hash: principalHash,
      session_hash: sessionHash,
      client_platform: "web",
      properties: sanitized.event.properties,
      app_version: context.appVersion === PRODUCT_ANALYTICS_VERSION ? context.appVersion : null
    });
  });

  return { events, rejected };
}

async function recordProductEventsSafely(client, events, logger = console) {
  if (!client || !Array.isArray(events) || events.length === 0) {
    return { ok: false, insertedCount: 0, duplicateCount: 0 };
  }

  try {
    const response = await client.from("product_events")
      .upsert(events, { onConflict: "event_id", ignoreDuplicates: true })
      .select("event_id");
    if (response && response.error) throw response.error;

    const insertedCount = response && Array.isArray(response.data) ? response.data.length : events.length;
    return { ok: true, insertedCount, duplicateCount: events.length - insertedCount };
  } catch (error) {
    if (logger && typeof logger.warn === "function") logger.warn("product_analytics_write_failed");
    return { ok: false, insertedCount: 0, duplicateCount: 0 };
  }
}

async function hasEnabledProductAnalyticsPreference(client, userId) {
  if (!client || !isUuid(userId)) return { ok: false, enabled: false };

  try {
    const response = await client.from("product_analytics_preferences")
      .select("enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (response && response.error) throw response.error;
    return { ok: true, enabled: Boolean(response && response.data && response.data.enabled) };
  } catch (error) {
    return { ok: false, enabled: false };
  }
}

async function deleteProductEventsForIdentity(client, identity, installationId, secret) {
  const principalHash = createProductPrincipalHash(identity, installationId, secret);
  if (!client || !principalHash) return { deleted: false, principalHash: null };

  try {
    const response = await client.from("product_events")
      .delete()
      .eq("principal_type", identity.type)
      .eq("principal_hash", principalHash);
    return { deleted: !(response && response.error), principalHash };
  } catch (error) {
    return { deleted: false, principalHash };
  }
}

module.exports = {
  PRODUCT_ANALYTICS_VERSION,
  sanitizeProductEvent,
  createProductPrincipalHash,
  createProductSessionHash,
  normalizeProductEventBatch,
  recordProductEventsSafely,
  hasEnabledProductAnalyticsPreference,
  deleteProductEventsForIdentity
};
