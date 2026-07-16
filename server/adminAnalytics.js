function normalizeRange(value) {
  const ranges = {
    "7d": 7,
    "30d": 30,
    "90d": 90
  };
  const key = Object.prototype.hasOwnProperty.call(ranges, value) ? value : "7d";

  return {
    key,
    days: ranges[key]
  };
}

function normalizeRecentLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 20;
  }

  return Math.min(100, Math.floor(number));
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function incrementCount(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function mapToDistribution(map) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

function sumNullable(values) {
  const validValues = values.filter((value) => value !== null);
  if (!validValues.length) {
    return null;
  }

  return validValues.reduce((total, value) => total + value, 0);
}

function summarizeUsageEvents(events = [], now = new Date()) {
  const safeEvents = Array.isArray(events) ? events : [];
  const todayKey = toDateKey(now);
  const principalHashes = new Set();
  const durations = [];
  const dailyCounts = new Map();
  const analysisTypes = new Map();
  const errorCodes = new Map();
  let todayRequests = 0;
  let guestRequests = 0;
  let authenticatedRequests = 0;
  let successCount = 0;
  let qualityRetryCount = 0;

  safeEvents.forEach((event) => {
    const dateKey = toDateKey(event.occurred_at);
    if (dateKey) incrementCount(dailyCounts, dateKey);
    if (dateKey === todayKey) todayRequests += 1;
    if (event.principal_hash) principalHashes.add(event.principal_hash);
    if (event.principal_type === "guest") guestRequests += 1;
    if (event.principal_type === "authenticated") authenticatedRequests += 1;
    if (event.outcome === "success") successCount += 1;
    if (event.error_code) incrementCount(errorCodes, event.error_code);
    incrementCount(analysisTypes, event.analysis_type);

    const duration = toNumberOrNull(event.duration_ms);
    if (duration !== null) durations.push(duration);

    const retries = toNumberOrNull(event.quality_retry_count);
    qualityRetryCount += retries === null ? 0 : retries;
  });

  const promptTokens = sumNullable(safeEvents.map((event) => toNumberOrNull(event.prompt_tokens)));
  const completionTokens = sumNullable(safeEvents.map((event) => toNumberOrNull(event.completion_tokens)));
  const totalTokens = sumNullable(safeEvents.map((event) => toNumberOrNull(event.total_tokens)));
  const totalEstimatedCostUsd = sumNullable(safeEvents.map((event) => toNumberOrNull(event.estimated_cost_usd)));
  const totalRequests = safeEvents.length;

  return {
    todayRequests,
    totalRequests,
    approximatePrincipals: principalHashes.size,
    guestRequests,
    authenticatedRequests,
    successRate: totalRequests ? successCount / totalRequests : null,
    failureCount: totalRequests - successCount,
    averageDurationMs: durations.length
      ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length)
      : null,
    p95DurationMs: percentile(durations, 0.95),
    qualityRetryCount,
    promptTokens,
    completionTokens,
    totalTokens,
    totalEstimatedCostUsd,
    costConfigured: totalEstimatedCostUsd !== null,
    dailyTrend: Array.from(dailyCounts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, count]) => ({ date, count })),
    analysisTypeDistribution: mapToDistribution(analysisTypes),
    errorCodeDistribution: mapToDistribution(errorCodes)
  };
}

function formatRecentEvents(events = []) {
  return (Array.isArray(events) ? events : []).map((event) => ({
    requestId: String(event.request_id || "").slice(0, 8),
    occurredAt: event.occurred_at || "",
    principalType: event.principal_type || "",
    analysisType: event.analysis_type || "",
    outcome: event.outcome || "",
    errorCode: event.error_code || null,
    durationMs: toNumberOrNull(event.duration_ms),
    promptTokens: toNumberOrNull(event.prompt_tokens),
    completionTokens: toNumberOrNull(event.completion_tokens),
    totalTokens: toNumberOrNull(event.total_tokens),
    estimatedCostUsd: toNumberOrNull(event.estimated_cost_usd)
  }));
}

async function getAnalyticsSummary(client, options = {}) {
  const range = normalizeRange(options.range);
  const now = options.now || new Date();
  const since = new Date(now.getTime() - range.days * 24 * 60 * 60 * 1000).toISOString();
  const response = await client
    .from("ai_usage_events")
    .select("*")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: true });

  if (response.error) {
    throw response.error;
  }

  return {
    range,
    ...summarizeUsageEvents(response.data || [], now)
  };
}

async function getRecentAnalyticsEvents(client, options = {}) {
  const limit = normalizeRecentLimit(options.limit);
  const response = await client
    .from("ai_usage_events")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (response.error) {
    throw response.error;
  }

  return {
    limit,
    events: formatRecentEvents(response.data || [])
  };
}

module.exports = {
  formatRecentEvents,
  getAnalyticsSummary,
  getRecentAnalyticsEvents,
  normalizeRange,
  normalizeRecentLimit,
  summarizeUsageEvents
};
