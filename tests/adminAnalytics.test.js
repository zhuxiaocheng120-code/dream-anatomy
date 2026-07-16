const assert = require("node:assert/strict");
const test = require("node:test");

const {
  formatRecentEvents,
  normalizeRange,
  normalizeRecentLimit,
  summarizeUsageEvents
} = require("../server/adminAnalytics");

test("normalizes admin ranges and limits", () => {
  assert.deepEqual(normalizeRange("7d"), { key: "7d", days: 7 });
  assert.deepEqual(normalizeRange("30d"), { key: "30d", days: 30 });
  assert.deepEqual(normalizeRange("90d"), { key: "90d", days: 90 });
  assert.deepEqual(normalizeRange("365d"), { key: "7d", days: 7 });
  assert.equal(normalizeRecentLimit("200"), 100);
  assert.equal(normalizeRecentLimit("abc"), 20);
});

test("summarizes usage events without exposing hashes", () => {
  const summary = summarizeUsageEvents([
    {
      occurred_at: "2026-07-17T01:00:00.000Z",
      principal_type: "guest",
      principal_hash: "hash-a",
      analysis_type: "quick",
      outcome: "success",
      duration_ms: 100,
      quality_retry_count: 1,
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
      estimated_cost_usd: 0.001
    },
    {
      occurred_at: "2026-07-16T01:00:00.000Z",
      principal_type: "authenticated",
      principal_hash: "hash-b",
      analysis_type: "result_card",
      outcome: "timeout",
      error_code: "UPSTREAM_TIMEOUT",
      duration_ms: 300,
      quality_retry_count: 0,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      estimated_cost_usd: null
    }
  ], new Date("2026-07-17T12:00:00.000Z"));

  assert.equal(summary.totalRequests, 2);
  assert.equal(summary.todayRequests, 1);
  assert.equal(summary.approximatePrincipals, 2);
  assert.equal(summary.guestRequests, 1);
  assert.equal(summary.authenticatedRequests, 1);
  assert.equal(summary.successRate, 0.5);
  assert.equal(summary.failureCount, 1);
  assert.equal(summary.averageDurationMs, 200);
  assert.equal(summary.p95DurationMs, 300);
  assert.equal(summary.qualityRetryCount, 1);
  assert.equal(summary.promptTokens, 10);
  assert.equal(summary.completionTokens, 20);
  assert.equal(summary.totalTokens, 30);
  assert.equal(summary.totalEstimatedCostUsd, 0.001);
  assert.equal(summary.costConfigured, true);
  assert.deepEqual(summary.analysisTypeDistribution, [
    { label: "quick", count: 1 },
    { label: "result_card", count: 1 }
  ]);
  assert.deepEqual(summary.errorCodeDistribution, [
    { label: "UPSTREAM_TIMEOUT", count: 1 }
  ]);
  assert.doesNotMatch(JSON.stringify(summary), /hash-a|hash-b/);
});

test("summarizes empty usage events as safe zero state", () => {
  const summary = summarizeUsageEvents([], new Date("2026-07-17T12:00:00.000Z"));

  assert.equal(summary.totalRequests, 0);
  assert.equal(summary.approximatePrincipals, 0);
  assert.equal(summary.successRate, null);
  assert.equal(summary.averageDurationMs, null);
  assert.equal(summary.p95DurationMs, null);
  assert.equal(summary.totalEstimatedCostUsd, null);
  assert.equal(summary.costConfigured, false);
  assert.deepEqual(summary.dailyTrend, []);
});

test("recent events return redacted short request ids", () => {
  const recent = formatRecentEvents([{
    request_id: "00000000-0000-4000-8000-000000000001",
    occurred_at: "2026-07-17T01:00:00.000Z",
    principal_hash: "private-hash",
    principal_type: "guest",
    analysis_type: "quick",
    outcome: "success",
    duration_ms: 100,
    total_tokens: 30,
    estimated_cost_usd: 0.001
  }]);

  assert.equal(recent[0].requestId, "00000000");
  assert.equal(recent[0].principalType, "guest");
  assert.equal(recent[0].analysisType, "quick");
  assert.equal(recent[0].outcome, "success");
  assert.equal(recent[0].durationMs, 100);
  assert.equal(recent[0].totalTokens, 30);
  assert.equal(recent[0].estimatedCostUsd, 0.001);
  assert.doesNotMatch(JSON.stringify(recent), /private-hash/);
});
