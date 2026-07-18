const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  PRODUCT_ANALYTICS_VERSION,
  sanitizeProductEvent,
  createProductPrincipalHash,
  createProductSessionHash,
  normalizeProductEventBatch,
  recordProductEventsSafely,
  deleteProductEventsForIdentity
} = require("../server/productAnalytics");

const eventId = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000002";
const installationId = "00000000-0000-4000-8000-000000000003";

function createEvent(overrides = {}) {
  return {
    eventId,
    eventName: "analysis_completed",
    occurredAt: "2026-07-19T00:00:00.000Z",
    properties: {
      analysis_type: "quick",
      source: "ai_generated",
      has_result_card: true
    },
    ...overrides
  };
}

test("exports the current product analytics version", () => {
  assert.equal(PRODUCT_ANALYTICS_VERSION, "2026-07-19");
});

test("sanitizes allowlisted properties and strips private fields", () => {
  const event = sanitizeProductEvent({
    eventId,
    eventName: "analysis_completed",
    occurredAt: "2026-07-19T00:00:00.000Z",
    properties: {
      analysis_type: "quick",
      source: "ai_generated",
      has_result_card: true,
      dreamText: "private dream",
      email: "private@example.com",
      unknown: "drop me"
    }
  });

  assert.equal(event.ok, true);
  assert.deepEqual(event.event.properties, {
    analysis_type: "quick",
    source: "ai_generated",
    has_result_card: true
  });
  assert.doesNotMatch(JSON.stringify(event), /private dream|private@example\.com|drop me/);
  assert.equal(Object.hasOwn(event.event, "sessionId"), false);
  assert.equal(Object.hasOwn(event.event, "installationId"), false);
});

test("allows only known entry points and stable error codes", () => {
  const started = sanitizeProductEvent(createEvent({
    eventName: "dream_input_started",
    properties: {
      entry_point: "nav",
      email: "private@example.com"
    }
  }));
  const failed = sanitizeProductEvent(createEvent({
    eventName: "analysis_failed",
    properties: {
      analysis_type: "quick",
      error_code: "ANALYSIS_TIMEOUT"
    }
  }));

  assert.deepEqual(started.event.properties, { entry_point: "nav" });
  assert.deepEqual(failed.event.properties, {
    analysis_type: "quick",
    error_code: "ANALYSIS_TIMEOUT"
  });
});

test("strips emails, tokens, and free text from entry point and error code", () => {
  const started = sanitizeProductEvent(createEvent({
    eventName: "signup_started",
    properties: { entry_point: "private@example.com" }
  }));
  const failed = sanitizeProductEvent(createEvent({
    eventName: "analysis_failed",
    properties: {
      analysis_type: "quick",
      error_code: "Bearer eyJhbGciOiJIUzI1NiJ9.private-token"
    }
  }));
  const freeText = sanitizeProductEvent(createEvent({
    eventName: "analysis_failed",
    properties: {
      analysis_type: "quick",
      error_code: "the service returned an unexpected response"
    }
  }));

  assert.deepEqual(started.event.properties, {});
  assert.deepEqual(failed.event.properties, { analysis_type: "quick" });
  assert.deepEqual(freeText.event.properties, { analysis_type: "quick" });
  assert.doesNotMatch(JSON.stringify([started, failed, freeText]), /private@example\.com|private-token|unexpected response/);
});

test("rejects unknown event names", () => {
  const result = sanitizeProductEvent(createEvent({ eventName: "dream_text_submitted" }));

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "EVENT_INVALID");
});

test("hashes guest installations and authenticated users with distinct HMAC prefixes", () => {
  const secret = "analytics-secret";
  const guestHash = createProductPrincipalHash({ type: "guest" }, installationId, secret);
  const userHash = createProductPrincipalHash(
    { type: "authenticated", userId: "00000000-0000-4000-8000-000000000004" },
    installationId,
    secret
  );

  assert.equal(
    guestHash,
    crypto.createHmac("sha256", secret).update(`installation:${installationId}`).digest("hex")
  );
  assert.equal(
    userHash,
    crypto.createHmac("sha256", secret).update("user:00000000-0000-4000-8000-000000000004").digest("hex")
  );
  assert.notEqual(guestHash, userHash);
  assert.equal(createProductSessionHash(sessionId, secret), crypto.createHmac("sha256", secret).update(`session:${sessionId}`).digest("hex"));
  assert.equal(createProductPrincipalHash({ type: "guest" }, installationId, ""), null);
  assert.equal(createProductSessionHash(sessionId, ""), null);
});

test("normalizes at most 20 events and derives the authenticated principal from caller context", () => {
  const events = Array.from({ length: 21 }, (_, index) => createEvent({
    eventId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
    userId: "attacker-controlled-user-id"
  }));
  const result = normalizeProductEventBatch(
    { sessionId, events },
    {
      identity: { type: "authenticated", userId: "00000000-0000-4000-8000-000000000004" },
      secret: "analytics-secret",
      appVersion: "web-beta"
    }
  );

  assert.equal(result.events.length, 20);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.events[0].principal_type, "authenticated");
  assert.equal(
    result.events[0].principal_hash,
    crypto.createHmac("sha256", "analytics-secret").update("user:00000000-0000-4000-8000-000000000004").digest("hex")
  );
  assert.equal(result.events[0].app_version, "web-beta");
  assert.doesNotMatch(JSON.stringify(result), /attacker-controlled-user-id|00000000-0000-4000-8000-000000000002/);
});

test("normalizes guest events with installation and session hashes only", () => {
  const result = normalizeProductEventBatch(
    { sessionId, installationId, events: [createEvent()] },
    { identity: { type: "guest" }, secret: "analytics-secret" }
  );

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].principal_type, "guest");
  assert.match(result.events[0].principal_hash, /^[a-f0-9]{64}$/);
  assert.match(result.events[0].session_hash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result.events[0]), new RegExp(`${installationId}|${sessionId}`));
});

test("rejects event-level identifiers and persists only HMAC identifiers", () => {
  const result = normalizeProductEventBatch(
    { sessionId, installationId, events: [createEvent({ sessionId, installationId })] },
    { identity: { type: "guest" }, secret: "analytics-secret" }
  );

  assert.equal(result.events.length, 0);
  assert.equal(result.rejected.length, 1);
});

test("records duplicate product events without treating them as failures", async () => {
  const result = await recordProductEventsSafely(
    {
      from(table) {
        assert.equal(table, "product_events");
        return {
          upsert(events, options) {
            assert.equal(events.length, 2);
            assert.deepEqual(options, { onConflict: "event_id", ignoreDuplicates: true });
            return {
              select(columns) {
                assert.equal(columns, "event_id");
                return { data: [{ event_id: eventId }], error: null };
              }
            };
          }
        };
      }
    },
    [{ event_id: eventId }, { event_id: "00000000-0000-4000-8000-000000000005" }]
  );

  assert.deepEqual(result, { ok: true, insertedCount: 1, duplicateCount: 1 });
});

test("swallows product analytics write failures without logging event data", async () => {
  const messages = [];
  const result = await recordProductEventsSafely(
    { from: () => ({ upsert: async () => ({ error: new Error("db unavailable") }) }) },
    [{ event_id: eventId, properties: { dreamText: "private dream" } }],
    { warn(message) { messages.push(message); } }
  );

  assert.deepEqual(result, { ok: false, insertedCount: 0, duplicateCount: 0 });
  assert.deepEqual(messages, ["product_analytics_write_failed"]);
});

test("deletes product events by authenticated and guest principals", async () => {
  const deletedHashes = [];
  const client = {
    from(table) {
      assert.equal(table, "product_events");
      return {
        delete() { return this; },
        eq(column, value) {
          assert.equal(column, "principal_hash");
          deletedHashes.push(value);
          return Promise.resolve({ error: null });
        }
      };
    }
  };
  const secret = "analytics-secret";
  const authenticated = await deleteProductEventsForIdentity(
    client,
    { type: "authenticated", userId: "00000000-0000-4000-8000-000000000004" },
    installationId,
    secret
  );
  const guest = await deleteProductEventsForIdentity(client, { type: "guest" }, installationId, secret);

  assert.deepEqual(authenticated, {
    deleted: true,
    principalHash: crypto.createHmac("sha256", secret).update("user:00000000-0000-4000-8000-000000000004").digest("hex")
  });
  assert.deepEqual(guest, {
    deleted: true,
    principalHash: crypto.createHmac("sha256", secret).update(`installation:${installationId}`).digest("hex")
  });
  assert.deepEqual(deletedHashes, [authenticated.principalHash, guest.principalHash]);
});

test("does not delete guest events for a malformed authenticated identity", async () => {
  let deleteCalled = false;
  const result = await deleteProductEventsForIdentity(
    {
      from() {
        return {
          delete() {
            deleteCalled = true;
            return this;
          }
        };
      }
    },
    { type: "authenticated", userId: "not-a-uuid" },
    installationId,
    "analytics-secret"
  );

  assert.deepEqual(result, { deleted: false, principalHash: null });
  assert.equal(deleteCalled, false);
  assert.equal(
    createProductPrincipalHash({ type: "authenticated", userId: "not-a-uuid" }, installationId, "analytics-secret"),
    null
  );
});
