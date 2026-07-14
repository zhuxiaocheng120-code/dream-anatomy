const assert = require("node:assert/strict");
const test = require("node:test");

const { createAiAccessControl } = require("../server/aiAccessControl");

function createIdentity(type, id) {
  return type === "authenticated"
    ? { type, userId: id, rateLimitKey: `user:${id}` }
    : { type: "guest", userId: "", rateLimitKey: `guest:${id}` };
}

function createControl(overrides = {}) {
  return createAiAccessControl({
    guestDailyLimit: 3,
    userDailyLimit: 10,
    guestRequestsPerMinute: 2,
    userRequestsPerMinute: 3,
    maxConcurrentPerPrincipal: 1,
    now: () => 1_700_000_000_000,
    ...overrides
  });
}

test("guest daily quota allows first three requests and rejects the fourth", () => {
  const control = createControl({ guestRequestsPerMinute: 10 });
  const guest = createIdentity("guest", "203.0.113.24");

  for (let index = 0; index < 3; index += 1) {
    const reservation = control.start(guest, "quick", 1_700_000_000_000 + index);
    assert.equal(reservation.usage.limit, 3);
    control.finish(reservation, { refundDaily: false });
  }

  assert.throws(
    () => control.start(guest, "quick", 1_700_000_000_004),
    (error) => {
      assert.equal(error.code, "DAILY_LIMIT_REACHED");
      assert.equal(error.status, 429);
      assert.equal(error.usage.limit, 3);
      assert.equal(error.usage.remaining, 0);
      return true;
    }
  );
});

test("authenticated daily quota is isolated per user", () => {
  const control = createControl({ userRequestsPerMinute: 20 });
  const firstUser = createIdentity("authenticated", "user-a");
  const secondUser = createIdentity("authenticated", "user-b");

  for (let index = 0; index < 10; index += 1) {
    const reservation = control.start(firstUser, "quick", 1_700_000_000_000 + index);
    control.finish(reservation, { refundDaily: false });
  }

  assert.throws(() => control.start(firstUser, "quick", 1_700_000_000_050), { code: "DAILY_LIMIT_REACHED" });
  const secondReservation = control.start(secondUser, "quick", 1_700_000_000_050);
  assert.equal(secondReservation.usage.limit, 10);
  assert.equal(secondReservation.usage.remaining, 9);
});

test("short window rate limits include Retry-After and recover after the window", () => {
  const control = createControl({ guestDailyLimit: 10, guestRequestsPerMinute: 2 });
  const guest = createIdentity("guest", "203.0.113.24");
  const first = control.start(guest, "quick", 1_700_000_000_000);
  control.finish(first, {});
  const second = control.start(guest, "quick", 1_700_000_010_000);
  control.finish(second, {});

  assert.throws(
    () => control.start(guest, "quick", 1_700_000_020_000),
    (error) => {
      assert.equal(error.code, "RATE_LIMITED");
      assert.equal(error.status, 429);
      assert.equal(error.retryAfter, 40);
      return true;
    }
  );

  const recovered = control.start(guest, "quick", 1_700_000_061_000);
  assert.equal(recovered.usage.remaining, 7);
});

test("concurrency lock rejects duplicate principal and releases after finish", () => {
  const control = createControl();
  const user = createIdentity("authenticated", "user-a");
  const otherUser = createIdentity("authenticated", "user-b");
  const active = control.start(user, "quick", 1_700_000_000_000);

  assert.throws(
    () => control.start(user, "quick", 1_700_000_000_100),
    (error) => {
      assert.equal(error.code, "REQUEST_IN_PROGRESS");
      assert.equal(error.status, 429);
      return true;
    }
  );

  const other = control.start(otherUser, "quick", 1_700_000_000_100);
  assert.equal(other.usage.remaining, 9);
  control.finish(other, {});
  control.finish(active, {});
  const afterRelease = control.start(user, "quick", 1_700_000_000_200);
  assert.equal(afterRelease.usage.remaining, 8);
});

test("upstream failure refunds daily quota but keeps short-window attempt", () => {
  const control = createControl({ guestDailyLimit: 1, guestRequestsPerMinute: 2 });
  const guest = createIdentity("guest", "203.0.113.24");
  const failed = control.start(guest, "quick", 1_700_000_000_000);
  control.finish(failed, { refundDaily: true });

  const retried = control.start(guest, "quick", 1_700_000_001_000);
  assert.equal(retried.usage.limit, 1);
  assert.equal(retried.usage.remaining, 0);
  control.finish(retried, {});

  assert.throws(() => control.start(guest, "quick", 1_700_000_002_000), { code: "RATE_LIMITED" });
});
