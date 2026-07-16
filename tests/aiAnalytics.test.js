const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  buildUsageEvent,
  calculateEstimatedCost,
  createPrincipalHash,
  recordUsageEventSafely
} = require("../server/aiAnalytics");

test("principal hash uses HMAC secret and type prefixes", () => {
  const request = { ip: "203.0.113.24" };
  const userHash = createPrincipalHash(
    { type: "authenticated", userId: "user-uuid", rateLimitKey: "user:user-uuid" },
    request,
    "secret"
  );
  const guestHash = createPrincipalHash(
    { type: "guest", userId: "", rateLimitKey: "guest:203.0.113.24" },
    request,
    "secret"
  );

  assert.match(userHash, /^[a-f0-9]{64}$/);
  assert.match(guestHash, /^[a-f0-9]{64}$/);
  assert.equal(userHash, crypto.createHmac("sha256", "secret").update("user:user-uuid").digest("hex"));
  assert.notEqual(userHash, crypto.createHash("sha256").update("user:user-uuid").digest("hex"));
  assert.notEqual(userHash, guestHash);
  assert.equal(
    createPrincipalHash(
      { type: "authenticated", userId: "user-uuid", rateLimitKey: "user:user-uuid" },
      request,
      "secret"
    ),
    userHash
  );
});

test("missing analytics secret returns null hash", () => {
  assert.equal(createPrincipalHash({ type: "guest" }, { ip: "203.0.113.24" }, ""), null);
});

test("cost is null unless token usage and prices are configured", () => {
  assert.equal(calculateEstimatedCost({ prompt_tokens: 1000, completion_tokens: 2000 }, {}), null);
  assert.equal(
    calculateEstimatedCost({}, {
      AI_INPUT_COST_PER_1M_TOKENS: "1",
      AI_OUTPUT_COST_PER_1M_TOKENS: "2"
    }),
    null
  );
  assert.equal(
    calculateEstimatedCost(
      { prompt_tokens: 1000, completion_tokens: 2000 },
      {
        AI_INPUT_COST_PER_1M_TOKENS: "1",
        AI_OUTPUT_COST_PER_1M_TOKENS: "2"
      }
    ),
    0.005
  );
});

test("cost is null for null or empty-string usage values", () => {
  assert.equal(
    calculateEstimatedCost(
      { prompt_tokens: null, completion_tokens: "" },
      {
        AI_INPUT_COST_PER_1M_TOKENS: "1",
        AI_OUTPUT_COST_PER_1M_TOKENS: "2"
      }
    ),
    null
  );
});

test("buildUsageEvent excludes private content and keeps null token values", () => {
  const event = buildUsageEvent({
    requestId: "00000000-0000-4000-8000-000000000001",
    occurredAt: new Date("2026-07-17T00:00:00.000Z"),
    identity: {
      type: "authenticated",
      userId: "private-user-id",
      rateLimitKey: "user:private-user-id"
    },
    principalHash: "a".repeat(64),
    analysisType: "quick",
    outcome: "success",
    durationMs: 1234,
    qualityRetryCount: 1,
    promptVersion: "quick-analysis-v2",
    model: "deepseek-chat",
    upstreamUsage: {},
    env: {},
    dreamText: "must not appear",
    aiResponse: "must not appear"
  });

  assert.equal(event.principal_type, "authenticated");
  assert.equal(event.principal_hash, "a".repeat(64));
  assert.equal(event.prompt_tokens, null);
  assert.equal(event.completion_tokens, null);
  assert.equal(event.total_tokens, null);
  assert.equal(event.estimated_cost_usd, null);
  assert.doesNotMatch(JSON.stringify(event), /private-user-id|must not appear/);
});

test("buildUsageEvent clamps invalid numeric fields to safe values", () => {
  const event = buildUsageEvent({
    requestId: "00000000-0000-4000-8000-000000000002",
    occurredAt: new Date("2026-07-17T00:00:00.000Z"),
    identity: { type: "guest", userId: "", rateLimitKey: "guest:203.0.113.24" },
    principalHash: "b".repeat(64),
    analysisType: "quick",
    outcome: "timeout",
    durationMs: -1,
    qualityRetryCount: -2,
    upstreamUsage: {
      prompt_tokens: null,
      completion_tokens: "",
      total_tokens: 4
    },
    env: {}
  });

  assert.equal(event.duration_ms, null);
  assert.equal(event.quality_retry_count, 0);
  assert.equal(event.prompt_tokens, null);
  assert.equal(event.completion_tokens, null);
  assert.equal(event.total_tokens, 4);
});

test("recordUsageEventSafely swallows insert failures", async () => {
  const messages = [];
  const result = await recordUsageEventSafely(
    {
      from() {
        return {
          insert: async () => ({ error: new Error("db unavailable") })
        };
      }
    },
    { request_id: "request-id", principal_hash: "a".repeat(64) },
    {
      warn(message) {
        messages.push(message);
      }
    }
  );

  assert.equal(result.ok, false);
  assert.match(messages[0], /analytics_write_failed/);
});
