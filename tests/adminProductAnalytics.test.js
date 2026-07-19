const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getProductAnalyticsFunnel,
  getProductAnalyticsRetention,
  getProductAnalyticsSummary,
  normalizeRange
} = require("../server/adminProductAnalytics");

function createQueryClient(rows = []) {
  return {
    from(tableName) {
      assert.equal(tableName, "product_events");
      let lowerBound = null;
      let upperBound = null;
      const builder = {
        select() { return builder; },
        lte(column, value) {
          assert.equal(column, "occurred_at");
          upperBound = value;
          return builder;
        },
        gte(column, value) {
          assert.equal(column, "occurred_at");
          lowerBound = value;
          return builder;
        },
        order() { return builder; },
        then(resolve, reject) {
          const filteredRows = rows.filter((row) => (
            (!lowerBound || row.occurred_at >= lowerBound)
            && (!upperBound || row.occurred_at <= upperBound)
          ));
          return Promise.resolve({ data: filteredRows, error: null }).then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

function createEvent(overrides = {}) {
  return {
    occurred_at: "2026-07-19T08:00:00.000Z",
    event_name: "app_opened",
    principal_type: "guest",
    principal_hash: "principal-private-hash",
    session_hash: "session-private-hash",
    properties: {},
    ...overrides
  };
}

test("normalizes product analytics ranges", () => {
  assert.deepEqual(normalizeRange("7d"), { key: "7d", days: 7 });
  assert.deepEqual(normalizeRange("30d"), { key: "30d", days: 30 });
  assert.deepEqual(normalizeRange("90d"), { key: "90d", days: 90 });
  assert.deepEqual(normalizeRange("unexpected"), { key: "7d", days: 7 });
});

test("summarizes opted-in product events without exposing hashes", async () => {
  const summary = await getProductAnalyticsSummary(createQueryClient([
    createEvent({ event_name: "view_opened", properties: { view_name: "quick" } }),
    createEvent({ event_name: "analysis_completed", principal_type: "authenticated", principal_hash: "authenticated-private-hash" })
  ]), { range: "30d", now: new Date("2026-07-19T12:00:00.000Z") });

  assert.equal(summary.range.key, "30d");
  assert.equal(summary.approximatePrincipals, 2);
  assert.deepEqual(summary.principalTypeDistribution, [
    { label: "authenticated", count: 1 },
    { label: "guest", count: 1 }
  ]);
  assert.deepEqual(summary.pageDistribution, [{ label: "quick", count: 1 }]);
  assert.deepEqual(summary.eventDistribution, [
    { label: "analysis_completed", count: 1 },
    { label: "view_opened", count: 1 }
  ]);
  assert.doesNotMatch(JSON.stringify(summary), /private-hash/);
});

test("excludes future-dated client events from selected ranges", async () => {
  const summary = await getProductAnalyticsSummary(createQueryClient([
    createEvent({ occurred_at: "2026-07-19T11:59:59.999Z" }),
    createEvent({
      occurred_at: "2026-07-20T00:00:00.000Z",
      principal_hash: "future-principal-private-hash"
    })
  ]), { now: new Date("2026-07-19T12:00:00.000Z") });

  assert.equal(summary.approximatePrincipals, 1);
  assert.deepEqual(summary.eventDistribution, [{ label: "app_opened", count: 1 }]);
  assert.doesNotMatch(JSON.stringify(summary), /future-principal-private-hash/);
});

test("counts product funnel stages within the same session", async () => {
  const stages = ["app_opened", "dream_input_started", "analysis_requested", "analysis_completed", "result_viewed", "dream_saved"];
  const events = stages.map((eventName) => createEvent({ event_name: eventName }));
  events.push(createEvent({ event_name: "dream_saved", session_hash: "second-session-private-hash" }));

  const funnel = await getProductAnalyticsFunnel(createQueryClient(events), {
    now: new Date("2026-07-19T12:00:00.000Z")
  });

  assert.deepEqual(funnel.stages, stages.map((name) => ({ name, count: 1 })));
  assert.doesNotMatch(JSON.stringify(funnel), /private-hash/);
});

test("calculates D1 and D7 retention using UTC dates", async () => {
  const events = [
    ...Array.from({ length: 5 }, (_, index) => createEvent({
      principal_hash: `principal-${index}`,
      occurred_at: "2026-07-10T23:30:00-02:00"
    })),
    createEvent({ principal_hash: "principal-0", occurred_at: "2026-07-12T00:10:00.000Z" }),
    createEvent({ principal_hash: "principal-1", occurred_at: "2026-07-18T01:00:00.000Z" })
  ];

  const retention = await getProductAnalyticsRetention(createQueryClient(events), {
    range: "30d",
    now: new Date("2026-07-19T12:00:00.000Z")
  });

  assert.deepEqual(retention.d1, { status: "ok", cohortSize: 5, retainedPrincipals: 1, rate: 0.2 });
  assert.deepEqual(retention.d7, { status: "ok", cohortSize: 5, retainedPrincipals: 1, rate: 0.2 });
  assert.doesNotMatch(JSON.stringify(retention), /principal-/);
});

test("retention uses each principal's first event instead of first event in the selected range", async () => {
  const events = [
    ...Array.from({ length: 5 }, (_, index) => createEvent({
      principal_hash: `historical-principal-${index}`,
      occurred_at: "2026-05-01T00:00:00.000Z"
    })),
    ...Array.from({ length: 5 }, (_, index) => createEvent({
      principal_hash: `historical-principal-${index}`,
      occurred_at: "2026-07-18T00:00:00.000Z"
    })),
    ...Array.from({ length: 5 }, (_, index) => createEvent({
      principal_hash: `historical-principal-${index}`,
      occurred_at: "2026-07-19T00:00:00.000Z"
    }))
  ];

  const retention = await getProductAnalyticsRetention(createQueryClient(events), {
    range: "7d",
    now: new Date("2026-07-19T12:00:00.000Z")
  });

  assert.deepEqual(retention.d1, { status: "ok", cohortSize: 5, retainedPrincipals: 0, rate: 0 });
  assert.deepEqual(retention.d7, { status: "ok", cohortSize: 5, retainedPrincipals: 0, rate: 0 });
});

test("withholds retention percentages below the minimum cohort size", async () => {
  const retention = await getProductAnalyticsRetention(createQueryClient([
    createEvent({ principal_hash: "one" }),
    createEvent({ principal_hash: "two" })
  ]), { now: new Date("2026-07-19T12:00:00.000Z") });

  assert.deepEqual(retention.d1, { status: "insufficient_data" });
  assert.deepEqual(retention.d7, { status: "insufficient_data" });
});
