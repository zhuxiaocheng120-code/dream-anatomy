const crypto = require("node:crypto");

function getRequestIp(request) {
  return (request && (request.ip || (request.socket && request.socket.remoteAddress))) || "unknown";
}

function createPrincipalHash(identity, request, secret) {
  if (!secret) return null;

  const source = identity && identity.type === "authenticated"
    ? `user:${identity.userId || ""}`
    : `guest:${getRequestIp(request)}`;

  return crypto.createHmac("sha256", secret).update(source).digest("hex");
}

function toNonNegativeInteger(value) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function toNonNegativeNumber(value) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function sanitizeGenerationStage(value) {
  return ["initial", "repair", "limited"].includes(value) ? value : null;
}

function sanitizeErrorCode(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9_]{1,80}$/.test(normalized) ? normalized : null;
}

function sanitizeStageDurations(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const durations = {};
  ["initial", "repair", "limited"].forEach((stage) => {
    const duration = toNonNegativeInteger(value[stage]);
    if (duration !== null) {
      durations[stage] = duration;
    }
  });

  return Object.keys(durations).length ? durations : null;
}

function sanitizeValidationIssueCodes(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[a-z0-9_]{1,100}$/.test(item))))
    .slice(0, 12);
}

function calculateEstimatedCost(usage = {}, env = process.env) {
  const promptTokens = toNonNegativeInteger(usage.prompt_tokens);
  const completionTokens = toNonNegativeInteger(usage.completion_tokens);
  const inputCost = toNonNegativeNumber(env.AI_INPUT_COST_PER_1M_TOKENS);
  const outputCost = toNonNegativeNumber(env.AI_OUTPUT_COST_PER_1M_TOKENS);

  if (promptTokens === null || completionTokens === null || inputCost === null || outputCost === null) {
    return null;
  }

  return (promptTokens / 1_000_000) * inputCost + (completionTokens / 1_000_000) * outputCost;
}

function buildUsageEvent(context = {}) {
  const usage = context.upstreamUsage || {};

  return {
    request_id: context.requestId,
    occurred_at: context.occurredAt instanceof Date ? context.occurredAt.toISOString() : new Date().toISOString(),
    principal_type: context.identity && context.identity.type === "authenticated" ? "authenticated" : "guest",
    principal_hash: context.principalHash,
    analysis_type: context.analysisType,
    outcome: context.outcome,
    error_code: context.errorCode || null,
    http_status: toNonNegativeInteger(context.httpStatus),
    duration_ms: toNonNegativeInteger(context.durationMs),
    quality_retry_count: toNonNegativeInteger(context.qualityRetryCount) || 0,
    prompt_version: context.promptVersion || null,
    model: context.model || null,
    prompt_tokens: toNonNegativeInteger(usage.prompt_tokens),
    completion_tokens: toNonNegativeInteger(usage.completion_tokens),
    total_tokens: toNonNegativeInteger(usage.total_tokens),
    estimated_cost_usd: calculateEstimatedCost(usage, context.env),
    generation_stage: sanitizeGenerationStage(context.generationStage),
    stage_durations: sanitizeStageDurations(context.stageDurations),
    validation_issue_codes: sanitizeValidationIssueCodes(context.validationIssueCodes),
    final_error_code: sanitizeErrorCode(context.finalErrorCode)
  };
}

const persistedUsageEventColumns = [
  "request_id",
  "occurred_at",
  "principal_type",
  "principal_hash",
  "analysis_type",
  "outcome",
  "error_code",
  "http_status",
  "duration_ms",
  "quality_retry_count",
  "prompt_version",
  "model",
  "prompt_tokens",
  "completion_tokens",
  "total_tokens",
  "estimated_cost_usd"
];

function getPersistableUsageEvent(event = {}) {
  return persistedUsageEventColumns.reduce((persisted, column) => {
    persisted[column] = Object.prototype.hasOwnProperty.call(event, column) ? event[column] : null;
    return persisted;
  }, {});
}

async function recordUsageEventSafely(client, event, logger = console) {
  if (!client || !event || !event.principal_hash) {
    return { ok: false, skipped: true };
  }

  try {
    const response = await client.from("ai_usage_events").insert(getPersistableUsageEvent(event));

    if (response && response.error) {
      if (logger && typeof logger.warn === "function") {
        logger.warn("analytics_write_failed");
      }
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    if (logger && typeof logger.warn === "function") {
      logger.warn("analytics_write_failed");
    }
    return { ok: false };
  }
}

module.exports = {
  buildUsageEvent,
  calculateEstimatedCost,
  createPrincipalHash,
  getPersistableUsageEvent,
  recordUsageEventSafely
};
