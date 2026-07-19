const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const ProductAnalytics = require("../src/productAnalytics");
const PrivacyData = require("../src/privacyData");

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

test("authenticated opt-out clears local analytics before a delayed preference write settles", async () => {
  const { controller, localStorage, sessionStorage } = createHarness();
  let rejectPreferenceWrite;
  const client = {
    from() {
      return {
        select() { return this; },
        eq() { return { maybeSingle: async () => ({ data: { enabled: true }, error: null }) }; },
        upsert() {
          return new Promise((_resolve, reject) => { rejectPreferenceWrite = reject; });
        }
      };
    }
  };

  await controller.loadPreferenceForSession({ user: { id: "user-1" }, client });
  controller.trackEvent("analysis_completed", { analysis_type: "quick" });
  const disable = controller.setAnalyticsConsent(false);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(controller.getAnalyticsConsent(), false);
  assert.equal(controller.getQueueLength(), 0);
  assert.equal(controller.trackEvent("app_opened"), false);
  assert.equal(localStorage.getItem("dreamAnatomy.productAnalytics.installationId"), null);
  assert.equal(sessionStorage.getItem("dreamAnatomy.productAnalytics.sessionId"), null);

  rejectPreferenceWrite(new Error("preference write failed"));
  await assert.rejects(disable, /preference write failed/);
  assert.equal(controller.getAnalyticsConsent(), false);
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

test("guest events and identity are cleared before authenticated preference loading", async () => {
  const { controller, localStorage, sessionStorage, requests } = createHarness();
  await controller.setAnalyticsConsent(true);
  controller.trackEvent("app_opened");
  const guestSessionId = sessionStorage.getItem("dreamAnatomy.productAnalytics.sessionId");
  const client = {
    from() {
      return {
        select() { return this; },
        eq() { return { maybeSingle: async () => ({ data: { enabled: true }, error: null }) }; }
      };
    }
  };

  await controller.loadPreferenceForSession({ user: { id: "user-1" }, client });
  await controller.flushEvents();

  assert.equal(controller.getQueueLength(), 0);
  assert.equal(requests.length, 0);
  assert.equal(localStorage.getItem("dreamAnatomy.productAnalytics.installationId"), null);
  assert.notEqual(sessionStorage.getItem("dreamAnatomy.productAnalytics.sessionId"), guestSessionId);
});

test("stale account preference responses cannot overwrite the current account", async () => {
  const pending = new Map();
  const { controller } = createHarness();
  const client = {
    from() {
      return {
        select() { return this; },
        eq(_column, userId) {
          return {
            maybeSingle() {
              return new Promise((resolve) => pending.set(userId, resolve));
            }
          };
        }
      };
    }
  };

  const accountALoad = controller.loadPreferenceForSession({ user: { id: "account-a" }, client });
  const accountBLoad = controller.loadPreferenceForSession({ user: { id: "account-b" }, client });

  pending.get("account-b")({ data: { enabled: false }, error: null });
  await accountBLoad;
  assert.equal(controller.getAnalyticsConsent(), false);

  pending.get("account-a")({ data: { enabled: true }, error: null });
  await accountALoad;

  assert.equal(controller.getAnalyticsConsent(), false);
});

test("a delayed authenticated preference write cannot re-enable a different account", async () => {
  let resolveAccountAWrite;
  const { controller } = createHarness();
  const client = {
    from() {
      return {
        select() { return this; },
        eq(_column, userId) {
          return { maybeSingle: async () => ({ data: { enabled: userId === "account-a" }, error: null }) };
        },
        upsert(row) {
          if (row.user_id === "account-a") {
            return new Promise((resolve) => { resolveAccountAWrite = resolve; });
          }
          return Promise.resolve({ error: null });
        }
      };
    }
  };

  await controller.loadPreferenceForSession({ user: { id: "account-a" }, client });
  const enableAccountA = controller.setAnalyticsConsent(true);
  await new Promise((resolve) => setImmediate(resolve));

  await controller.loadPreferenceForSession({ user: { id: "account-b" }, client });
  assert.equal(controller.getAnalyticsConsent(), false);

  resolveAccountAWrite({ error: null });
  await enableAccountA;

  assert.equal(controller.getAnalyticsConsent(), false);
});

test("a stale authenticated opt-in write cannot override a later opt-out for the same account", async () => {
  const pendingWrites = new Map();
  const persistedStates = [];
  let persistedEnabled = null;
  const { controller } = createHarness();
  const client = {
    from() {
      return {
        select() { return this; },
        eq() { return { maybeSingle: async () => ({ data: { enabled: false }, error: null }) }; },
        upsert(row) {
          persistedStates.push(row.enabled);
          return new Promise((resolve) => {
            pendingWrites.set(row.enabled ? "enable" : "disable", () => {
              persistedEnabled = row.enabled;
              resolve({ error: null });
            });
          });
        }
      };
    }
  };

  await controller.loadPreferenceForSession({ user: { id: "account-a" }, client });
  const enableAccount = controller.setAnalyticsConsent(true);
  await new Promise((resolve) => setImmediate(resolve));
  const disableAccount = controller.setAnalyticsConsent(false);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(controller.getAnalyticsConsent(), false);

  assert.deepEqual(persistedStates, [true]);
  pendingWrites.get("enable")();
  await enableAccount;
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(persistedStates, [true, false]);
  pendingWrites.get("disable")();
  await disableAccount;

  assert.equal(controller.getAnalyticsConsent(), false);
  assert.equal(controller.trackEvent("app_opened"), false);
  assert.equal(persistedEnabled, false);
});

test("a stale authenticated preference read cannot override a later opt-out for the same account", async () => {
  let resolvePreferenceRead;
  const { controller } = createHarness();
  const client = {
    from() {
      return {
        select() { return this; },
        eq() {
          return {
            maybeSingle() {
              return new Promise((resolve) => { resolvePreferenceRead = resolve; });
            }
          };
        },
        upsert: async () => ({ error: null })
      };
    }
  };

  const loadPreference = controller.loadPreferenceForSession({ user: { id: "account-a" }, client });
  await new Promise((resolve) => setImmediate(resolve));
  await controller.setAnalyticsConsent(false);

  assert.equal(controller.getAnalyticsConsent(), false);

  resolvePreferenceRead({ data: { enabled: true }, error: null });
  await loadPreference;

  assert.equal(controller.getAnalyticsConsent(), false);
  assert.equal(controller.trackEvent("app_opened"), false);
});

test("a guest flush never uses a later authenticated browser session", async () => {
  const { controller, requests, sessionStorage } = createHarness({
    getSession: async () => ({ data: { session: { access_token: "account-b-token", user: { id: "account-b" } } } })
  });
  const client = {
    from() {
      return {
        select() { return this; },
        eq() { return { maybeSingle: async () => ({ data: { enabled: true }, error: null }) }; }
      };
    }
  };

  await controller.setAnalyticsConsent(true);
  controller.trackEvent("app_opened");
  const guestSessionId = sessionStorage.getItem("dreamAnatomy.productAnalytics.sessionId");
  const sent = await controller.flushEvents();

  await controller.loadPreferenceForSession({ user: { id: "account-b" }, client });

  assert.equal(sent, true);
  assert.equal(requests.length, 1);
  assert.equal(Object.hasOwn(requests[0].request.headers, "Authorization"), false);
  assert.match(JSON.parse(requests[0].request.body).installationId, /^[0-9a-f-]{36}$/i);
  assert.equal(controller.getQueueLength(), 0);
  assert.notEqual(sessionStorage.getItem("dreamAnatomy.productAnalytics.sessionId"), guestSessionId);
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

test("flush sends consent and request-level identifiers without raw ids in events", async () => {
  const { controller, requests } = createHarness();
  await controller.setAnalyticsConsent(true);
  controller.trackEvent("app_opened");
  await controller.flushEvents();

  const payload = JSON.parse(requests[0].request.body);
  assert.equal(payload.analyticsConsent, true);
  assert.match(payload.sessionId, /^[0-9a-f-]{36}$/i);
  assert.match(payload.installationId, /^[0-9a-f-]{36}$/i);
  assert.equal(Object.hasOwn(payload.events[0], "sessionId"), false);
  assert.equal(Object.hasOwn(payload.events[0], "installationId"), false);
});

test("flush adds a Bearer token only for the active authenticated controller user", async () => {
  const withSession = createHarness({
    getSession: async () => ({ data: { session: { access_token: "safe-token", user: { id: "user-1" } } } })
  });
  await withSession.controller.loadPreferenceForSession({
    user: { id: "user-1" },
    client: { from: () => ({ select() { return this; }, eq() { return { maybeSingle: async () => ({ data: { enabled: true }, error: null }) }; } }) }
  });
  withSession.controller.trackEvent("app_opened");
  await withSession.controller.flushEvents();
  assert.equal(withSession.requests[0].request.headers.Authorization, "Bearer safe-token");

  const guest = createHarness({
    getSession: async () => ({ data: { session: { access_token: "guest-should-not-use", user: { id: "user-1" } } } })
  });
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

test("deleting analytics rejects a failed request without clearing the local identity", async () => {
  const requests = [];
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const controller = ProductAnalytics.createProductAnalyticsController({
    fetch: async (url, request) => {
      requests.push({ url, request });
      return { ok: false };
    },
    localStorage,
    sessionStorage,
    createUuid: createUuidFactory()
  });
  await controller.setAnalyticsConsent(true);

  await assert.rejects(() => controller.deleteProductAnalyticsData());

  assert.equal(requests[0].url, "/api/v1/product-analytics");
  assert.match(localStorage.getItem("dreamAnatomy.productAnalytics.installationId"), /^[0-9a-f-]{36}$/i);
  assert.match(sessionStorage.getItem("dreamAnatomy.productAnalytics.sessionId"), /^[0-9a-f-]{36}$/i);
});

test("deleting guest analytics disables consent and prevents later event sending", async () => {
  const { controller, localStorage, requests } = createHarness();
  await controller.setAnalyticsConsent(true);

  await controller.deleteProductAnalyticsData();
  const sentAfterDeletion = controller.trackEvent("app_opened");
  await controller.flushEvents();

  assert.equal(controller.getAnalyticsConsent(), false);
  assert.equal(localStorage.getItem("dreamAnatomy.productAnalytics.guestPreference"), "false");
  assert.equal(sentAfterDeletion, false);
  assert.equal(requests.length, 1);
});

test("deleting authenticated analytics persists disabled consent", async () => {
  const { controller } = createHarness();
  const upserts = [];
  const client = {
    from() {
      return {
        select() { return this; },
        eq() { return { maybeSingle: async () => ({ data: { enabled: true }, error: null }) }; },
        upsert: async (row, options) => {
          upserts.push({ row, options });
          return { error: null };
        }
      };
    }
  };

  await controller.loadPreferenceForSession({ user: { id: "user-1" }, client, authEvent: "SIGNED_IN" });
  await controller.deleteProductAnalyticsData();

  assert.equal(controller.getAnalyticsConsent(), false);
  assert.deepEqual(upserts, [{
    row: { user_id: "user-1", enabled: false },
    options: { onConflict: "user_id" }
  }]);
});

test("explicit auth submits track conversion events but session restoration does not", async () => {
  const code = fs.readFileSync("src/auth.js", "utf8");
  const events = [];
  const nodes = new Map();
  const email = { value: "person@example.com" };
  const password = { value: "safe-password" };
  const createNode = () => ({
    dataset: {},
    hidden: false,
    disabled: false,
    value: "",
    classList: { toggle() {} },
    addEventListener(type, listener) { this.listeners[type] = listener; },
    focus() {},
    listeners: {},
    querySelector(selector) {
      if (selector === "input[name='email']") return email;
      if (selector === "input[name='password']") return password;
      return createNode();
    },
    reset() {}
  });
  const getNode = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, createNode());
    return nodes.get(selector);
  };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "user-1", email: "person@example.com" } } } }),
      onAuthStateChange() {},
      signInWithPassword: async () => ({
        data: { session: { user: { id: "user-1", email: "person@example.com", email_confirmed_at: "yes" } }, user: { email_confirmed_at: "yes" } },
        error: null
      }),
      signOut: async () => ({ error: null }),
      signUp: async () => ({ data: {}, error: null })
    }
  };
  let ready = Promise.resolve();
  const context = {
    CustomEvent: function CustomEvent(type, init) { return { type, detail: init && init.detail }; },
    document: {
      addEventListener(type, listener) { if (type === "DOMContentLoaded") ready = Promise.resolve(listener()); },
      querySelector: getNode,
      querySelectorAll() { return []; }
    },
    window: {
      DREAM_ANATOMY_ENV: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon" },
      DreamProductAnalytics: {
        controller: {
          loadPreferenceForSession: async () => true,
          trackEvent(name, properties) { events.push({ name, properties }); }
        }
      },
      dispatchEvent() {},
      location: { origin: "https://example.test" },
      supabase: { createClient: () => client }
    }
  };
  context.window.window = context.window;
  vm.runInNewContext(code, context);
  await ready;
  await nodes.get("[data-auth-register-form]").listeners.submit({ preventDefault() {} });
  await nodes.get("[data-auth-login-form]").listeners.submit({ preventDefault() {} });

  assert.deepEqual(JSON.parse(JSON.stringify(events)), [
    { name: "signup_started", properties: { entry_point: "auth" } },
    { name: "signup_completed", properties: { method: "email" } },
    { name: "login_completed", properties: { method: "email" } }
  ]);
});

test("login conversion waits for the authenticated preference before using the app-exposed analytics controller", async () => {
  const code = fs.readFileSync("src/auth.js", "utf8");
  const requests = [];
  let activeSession = null;
  const controller = ProductAnalytics.createProductAnalyticsController({
    createUuid: createUuidFactory(),
    fetch: async (url, options) => {
      requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
      return { ok: true };
    },
    localStorage: createStorage({ "dreamAnatomy.productAnalytics.guestPreference": "true" }),
    sessionStorage: createStorage(),
    getSession: async () => ({ data: { session: activeSession } })
  });
  const nodes = new Map();
  const email = { value: "person@example.com" };
  const password = { value: "safe-password" };
  const createNode = () => ({
    dataset: {}, hidden: false, disabled: false, value: "", classList: { toggle() {} }, listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    focus() {}, reset() {},
    querySelector(selector) {
      if (selector === "input[name='email']") return email;
      if (selector === "input[name='password']") return password;
      return createNode();
    }
  });
  const getNode = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, createNode());
    return nodes.get(selector);
  };
  const client = {
    from(tableName) {
      assert.equal(tableName, "product_analytics_preferences");
      return {
        select() { return this; },
        eq() { return { maybeSingle: async () => ({ data: { enabled: true }, error: null }) }; }
      };
    },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange() {},
      signInWithPassword: async () => {
        activeSession = { access_token: "member-token", user: { id: "user-1", email_confirmed_at: "yes" } };
        return { data: { session: activeSession, user: { email_confirmed_at: "yes" } }, error: null };
      },
      signUp: async () => ({ data: {}, error: null })
    }
  };
  let ready = Promise.resolve();
  const context = {
    CustomEvent: function CustomEvent(type, init) { return { type, detail: init && init.detail }; },
    document: {
      addEventListener(type, listener) { if (type === "DOMContentLoaded") ready = Promise.resolve(listener()); },
      querySelector: getNode,
      querySelectorAll() { return []; }
    },
    window: {
      DREAM_ANATOMY_ENV: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon" },
      DreamProductAnalytics: { ...ProductAnalytics, controller },
      dispatchEvent(event) {
        if (event.detail && event.detail.user) {
          controller.loadPreferenceForSession(event.detail);
        }
      },
      location: { origin: "https://example.test" },
      supabase: { createClient: () => client }
    }
  };
  context.window.window = context.window;
  vm.runInNewContext(code, context);
  await ready;
  await nodes.get("[data-auth-register-form]").listeners.submit({ preventDefault() {} });
  await nodes.get("[data-auth-login-form]").listeners.submit({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));

  const events = requests.flatMap((request) => request.body.events);
  assert.deepEqual(events.map((event) => event.eventName), ["signup_started", "signup_completed", "login_completed"]);
  assert.equal(requests.at(-1).headers.Authorization, "Bearer member-token");
  assert.doesNotMatch(JSON.stringify(events), /person@example\.com|safe-password/);
});

test("explicit login preserves authenticated app startup tracking while the privacy preference load is pending", async () => {
  const code = fs.readFileSync("src/auth.js", "utf8");
  const requests = [];
  const preferenceLoads = [];
  let activeSession = null;
  const controller = ProductAnalytics.createProductAnalyticsController({
    createUuid: createUuidFactory(),
    fetch: async (url, options) => {
      requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
      return { ok: true };
    },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    getSession: async () => ({ data: { session: activeSession } })
  });
  const privacyDataController = PrivacyData.createPrivacyDataController({
    document: {},
    legalDocuments: {
      getLegalVersions: () => ({}),
      hasAcceptedVersions: () => true
    },
    onAnalyticsPreferenceLoaded() {
      if (controller.trackEvent("app_opened")) controller.flushEvents();
    },
    productAnalytics: controller,
    storage: createStorage()
  });
  const nodes = new Map();
  const email = { value: "person@example.com" };
  const password = { value: "safe-password" };
  const createNode = () => ({
    dataset: {}, hidden: false, disabled: false, value: "", classList: { toggle() {} }, listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    focus() {}, reset() {},
    querySelector(selector) {
      if (selector === "input[name='email']") return email;
      if (selector === "input[name='password']") return password;
      return createNode();
    }
  });
  const getNode = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, createNode());
    return nodes.get(selector);
  };
  const client = {
    from(tableName) {
      return {
        select() { return this; },
        eq() {
          return {
            maybeSingle() {
              if (tableName === "product_analytics_preferences") {
                return new Promise((resolve) => preferenceLoads.push(resolve));
              }
              return Promise.resolve({ data: null, error: null });
            }
          };
        }
      };
    },
    auth: {
      getSession: async () => ({ data: { session: activeSession } }),
      onAuthStateChange() {},
      signInWithPassword: async () => {
        activeSession = { access_token: "member-token", user: { id: "user-1", email_confirmed_at: "yes" } };
        return { data: { session: activeSession, user: { email_confirmed_at: "yes" } }, error: null };
      },
      signUp: async () => ({ data: {}, error: null })
    }
  };
  let ready = Promise.resolve();
  const context = {
    CustomEvent: function CustomEvent(type, init) { return { type, detail: init && init.detail }; },
    document: {
      addEventListener(type, listener) { if (type === "DOMContentLoaded") ready = Promise.resolve(listener()); },
      querySelector: getNode,
      querySelectorAll() { return []; }
    },
    window: {
      DREAM_ANATOMY_ENV: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon" },
      DreamProductAnalytics: { ...ProductAnalytics, controller },
      dispatchEvent(event) {
        privacyDataController.handleSession(event.detail);
      },
      location: { origin: "https://example.test" },
      supabase: { createClient: () => client }
    }
  };
  context.window.window = context.window;
  vm.runInNewContext(code, context);
  await ready;

  const login = nodes.get("[data-auth-login-form]").listeners.submit({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));
  preferenceLoads[0]({ data: { enabled: true }, error: null });
  await new Promise((resolve) => setImmediate(resolve));
  preferenceLoads.slice(1).forEach((resolve) => resolve({ data: { enabled: true }, error: null }));
  await login;
  await controller.flushEvents();

  const events = requests.flatMap((request) => request.body.events);
  assert.deepEqual(events.map((event) => event.eventName), ["app_opened", "login_completed"]);
  assert.equal(requests.at(-1).headers.Authorization, "Bearer member-token");
  assert.doesNotMatch(JSON.stringify(events), /person@example\.com|safe-password|member-token/);
});
