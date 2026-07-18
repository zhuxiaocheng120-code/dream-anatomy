const assert = require("node:assert/strict");
const test = require("node:test");

const ProductAnalytics = require("../src/productAnalytics");

function createStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem(key) { return entries.has(key) ? entries.get(key) : null; },
    setItem(key, value) { entries.set(key, String(value)); },
    removeItem(key) { entries.delete(key); }
  };
}

function createUuidFactory() {
  let value = 0;
  return () => `00000000-0000-4000-8000-${String(++value).padStart(12, "0")}`;
}

function createHarness(options = {}) {
  const requests = [];
  const localStorage = createStorage(options.localStorage);
  const sessionStorage = createStorage(options.sessionStorage);
  const controller = ProductAnalytics.createProductAnalyticsController({
    fetch: async (url, request) => {
      requests.push({ url, request });
      return { ok: true };
    },
    localStorage,
    sessionStorage,
    createUuid: createUuidFactory(),
    getSession: options.getSession || (async () => null)
  });
  return { controller, localStorage, requests, sessionStorage };
}

test("defaults to off and does not send events", async () => {
  const { controller, requests } = createHarness();

  controller.trackEvent("analysis_completed", { analysis_type: "quick" });
  await controller.flushEvents();

  assert.equal(controller.getAnalyticsConsent(), false);
  assert.equal(requests.length, 0);
});

test("enabling guest consent creates a local installation id", async () => {
  const { controller, localStorage } = createHarness();

  await controller.setAnalyticsConsent(true);

  assert.equal(controller.getAnalyticsConsent(), true);
  assert.match(localStorage.getItem("dreamAnatomy.productAnalytics.installationId"), /^[0-9a-f-]{36}$/i);
  assert.equal(localStorage.getItem("dreamAnatomy.productAnalytics.guestPreference"), "true");
});

test("disabling consent clears queued events and local identifiers", async () => {
  const { controller, localStorage, sessionStorage } = createHarness();
  await controller.setAnalyticsConsent(true);
  controller.trackEvent("analysis_completed", { analysis_type: "quick" });

  await controller.setAnalyticsConsent(false);
  await controller.flushEvents();

  assert.equal(controller.getAnalyticsConsent(), false);
  assert.equal(controller.getQueueLength(), 0);
  assert.equal(localStorage.getItem("dreamAnatomy.productAnalytics.installationId"), null);
  assert.equal(sessionStorage.getItem("dreamAnatomy.productAnalytics.sessionId"), null);
});

test("loads authenticated preferences from the dedicated table", async () => {
  const calls = [];
  const { controller } = createHarness();
  const client = {
    from(table) {
      assert.equal(table, "product_analytics_preferences");
      return {
        select(columns) {
          calls.push({ type: "select", columns });
          return this;
        },
        eq(column, value) {
          calls.push({ type: "eq", column, value });
          return { maybeSingle: async () => ({ data: { enabled: true }, error: null }) };
        }
      };
    }
  };

  await controller.loadPreferenceForSession({ user: { id: "user-1" }, client, authEvent: "SIGNED_IN" });

  assert.deepEqual(calls, [
    { type: "select", columns: "enabled" },
    { type: "eq", column: "user_id", value: "user-1" }
  ]);
  assert.equal(controller.getAnalyticsConsent(), true);
});

test("account switches do not inherit analytics consent", async () => {
  const { controller } = createHarness();
  const client = {
    from() {
      return {
        select() { return this; },
        eq(_column, userId) {
          return { maybeSingle: async () => ({ data: { enabled: userId === "user-1" }, error: null }) };
        }
      };
    }
  };

  await controller.loadPreferenceForSession({ user: { id: "user-1" }, client, authEvent: "SIGNED_IN" });
  await controller.loadPreferenceForSession({ user: { id: "user-2" }, client, authEvent: "SIGNED_IN" });

  assert.equal(controller.getAnalyticsConsent(), false);
});

test("trackView de-duplicates identical view names", async () => {
  const { controller, requests } = createHarness();
  await controller.setAnalyticsConsent(true);
  controller.trackView("quick");
  controller.trackView("quick");
  await controller.flushEvents();

  const events = JSON.parse(requests[0].request.body).events;
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].properties, { view_name: "quick" });
});

test("trackEvent strips private properties before sending", async () => {
  const { controller, requests } = createHarness();
  await controller.setAnalyticsConsent(true);
  controller.trackEvent("analysis_completed", {
    analysis_type: "quick",
    dreamText: "private dream",
    email: "private@example.com",
    token: "private-token"
  });
  await controller.flushEvents();

  const payload = requests[0].request.body;
  assert.deepEqual(JSON.parse(payload).events[0].properties, { analysis_type: "quick" });
  assert.doesNotMatch(payload, /private dream|private@example\.com|private-token/);
});

test("flush adds a Bearer token only for an active session", async () => {
  const withSession = createHarness({ getSession: async () => ({ access_token: "safe-token" }) });
  await withSession.controller.setAnalyticsConsent(true);
  withSession.controller.trackEvent("app_opened");
  await withSession.controller.flushEvents();
  assert.equal(withSession.requests[0].request.headers.Authorization, "Bearer safe-token");

  const guest = createHarness();
  await guest.controller.setAnalyticsConsent(true);
  guest.controller.trackEvent("app_opened");
  await guest.controller.flushEvents();
  assert.equal(Object.hasOwn(guest.requests[0].request.headers, "Authorization"), false);
});

test("TOKEN_REFRESHED does not emit a login event", async () => {
  const { controller, requests } = createHarness();
  await controller.loadPreferenceForSession({
    user: { id: "user-1" },
    authEvent: "TOKEN_REFRESHED",
    client: { from: () => ({ select() { return this; }, eq() { return { maybeSingle: async () => ({ data: { enabled: true }, error: null }) }; } }) }
  });
  await controller.flushEvents();

  assert.equal(requests.length, 0);
});
