const SAMPLE_LABEL = "基于已同意产品分析的用户样本";
const FUNNEL_STAGES = [
  "app_opened",
  "dream_input_started",
  "analysis_requested",
  "analysis_completed",
  "result_viewed",
  "dream_saved"
];

function normalizeRange(value) {
  const ranges = { "7d": 7, "30d": 30, "90d": 90 };
  const key = Object.prototype.hasOwnProperty.call(ranges, value) ? value : "7d";
  return { key, days: ranges[key] };
}

function toUtcDateKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function getRangeStart(range, now) {
  return new Date(now.getTime() - range.days * 24 * 60 * 60 * 1000).toISOString();
}

function increment(map, key) {
  if (key) map.set(key, (map.get(key) || 0) + 1);
}

function distribution(map) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function eventProperties(event) {
  return event && event.properties && typeof event.properties === "object" && !Array.isArray(event.properties)
    ? event.properties
    : {};
}

function summarizeProductEvents(events = []) {
  const principals = new Set();
  const principalTypes = new Map();
  const pages = new Map();
  const eventNames = new Map();

  for (const event of events) {
    if (event.principal_hash) principals.add(event.principal_hash);
    increment(principalTypes, event.principal_type);
    increment(eventNames, event.event_name);
    if (event.event_name === "view_opened") increment(pages, eventProperties(event).view_name);
  }

  return {
    approximatePrincipals: principals.size,
    principalTypeDistribution: distribution(principalTypes),
    pageDistribution: distribution(pages),
    eventDistribution: distribution(eventNames)
  };
}

async function loadProductEvents(client, options = {}, loadOptions = {}) {
  const range = normalizeRange(options.range);
  const now = options.now || new Date();
  let query = client
    .from("product_events")
    .select("*")
    .lte("occurred_at", now.toISOString());

  if (!loadOptions.includeHistorical) {
    query = query.gte("occurred_at", getRangeStart(range, now));
  }

  const response = await query.order("occurred_at", { ascending: true });

  if (response.error) throw response.error;
  return { range, events: Array.isArray(response.data) ? response.data : [] };
}

async function getProductAnalyticsSummary(client, options = {}) {
  const { range, events } = await loadProductEvents(client, options);
  return { sampleLabel: SAMPLE_LABEL, range, ...summarizeProductEvents(events) };
}

function summarizeFunnel(events = []) {
  const sessions = new Map();
  for (const event of events) {
    if (!event.session_hash) continue;
    const sessionEvents = sessions.get(event.session_hash) || [];
    sessionEvents.push(event);
    sessions.set(event.session_hash, sessionEvents);
  }

  const counts = Array(FUNNEL_STAGES.length).fill(0);
  for (const sessionEvents of sessions.values()) {
    let stageIndex = 0;
    for (const event of sessionEvents) {
      if (event.event_name === FUNNEL_STAGES[stageIndex]) stageIndex += 1;
      if (stageIndex === FUNNEL_STAGES.length) break;
    }
    for (let index = 0; index < stageIndex; index += 1) counts[index] += 1;
  }

  return FUNNEL_STAGES.map((name, index) => ({ name, count: counts[index] }));
}

async function getProductAnalyticsFunnel(client, options = {}) {
  const { range, events } = await loadProductEvents(client, options);
  return { sampleLabel: SAMPLE_LABEL, range, stages: summarizeFunnel(events) };
}

function addUtcDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function retentionMetric(principalDates, offsetDays) {
  if (principalDates.size < 5) return { status: "insufficient_data" };
  let retainedPrincipals = 0;
  for (const dates of principalDates.values()) {
    const firstDate = Array.from(dates).sort()[0];
    if (dates.has(addUtcDays(firstDate, offsetDays))) retainedPrincipals += 1;
  }
  const cohortSize = principalDates.size;
  return { status: "ok", cohortSize, retainedPrincipals, rate: retainedPrincipals / cohortSize };
}

function summarizeRetention(events = []) {
  const principalDates = new Map();
  for (const event of events) {
    const dateKey = toUtcDateKey(event.occurred_at);
    if (!event.principal_hash || !dateKey) continue;
    const dates = principalDates.get(event.principal_hash) || new Set();
    dates.add(dateKey);
    principalDates.set(event.principal_hash, dates);
  }
  return { d1: retentionMetric(principalDates, 1), d7: retentionMetric(principalDates, 7) };
}

async function getProductAnalyticsRetention(client, options = {}) {
  const { range, events } = await loadProductEvents(client, options, { includeHistorical: true });
  return { sampleLabel: SAMPLE_LABEL, range, ...summarizeRetention(events) };
}

module.exports = {
  FUNNEL_STAGES,
  SAMPLE_LABEL,
  getProductAnalyticsFunnel,
  getProductAnalyticsRetention,
  getProductAnalyticsSummary,
  normalizeRange,
  summarizeFunnel,
  summarizeProductEvents,
  summarizeRetention,
  toUtcDateKey
};
