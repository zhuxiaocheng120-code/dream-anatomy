const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const authCode = fs.readFileSync("src/auth.js", "utf8");

function createNode() {
  return {
    dataset: {},
    disabled: false,
    hidden: false,
    listeners: {},
    textContent: "",
    value: "",
    addEventListener(event, callback) {
      this.listeners[event] = callback;
    },
    classList: {
      toggle() {}
    },
    focus() {},
    querySelector(selector) {
      if (selector === "button[type='submit']") {
        return createNode();
      }

      return createNode();
    },
    reset() {}
  };
}

function createAuthHarness({ env, supabase, privacyData }) {
  const nodes = new Map();
  const dispatchedEvents = [];
  let initPromise = Promise.resolve();

  function getNode(selector) {
    if (!nodes.has(selector)) {
      nodes.set(selector, createNode());
    }

    return nodes.get(selector);
  }

  const context = {
    CustomEvent: function CustomEvent(type, init) {
      return { type, detail: init ? init.detail : undefined };
    },
    document: {
      addEventListener(event, callback) {
        if (event === "DOMContentLoaded") {
          initPromise = Promise.resolve(callback());
        }
      },
      querySelector: getNode,
      querySelectorAll() {
        return [];
      }
    },
    window: {
      DREAM_ANATOMY_ENV: env,
      DreamPrivacyData: privacyData,
      dispatchEvent(event) {
        dispatchedEvents.push(event);
      },
      location: { origin: "https://dream-anatomy.onrender.com" },
      supabase
    }
  };

  context.window.window = context.window;
  context.window.document = context.document;
  vm.runInNewContext(authCode, context);

  return {
    auth: context.window.DreamAnatomyAuth,
    dispatchedEvents,
    nodes,
    ready: initPromise
  };
}

function deferred() {
  let reject;
  let resolve;
  const promise = new Promise((nextResolve, nextReject) => {
    reject = nextReject;
    resolve = nextResolve;
  });

  return { promise, reject, resolve };
}

async function submitRegisterForm(harness) {
  const registerForm = harness.nodes.get("[data-auth-register-form]");
  await registerForm.listeners.submit({ preventDefault() {} });
  return harness.nodes.get("[data-auth-status]").textContent;
}

test("reports safe diagnostics when runtime config exists but Supabase SDK is missing", () => {
  const harness = createAuthHarness({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-value"
    },
    supabase: undefined
  });

  const diagnostics = JSON.parse(JSON.stringify(harness.auth.getDiagnostics()));

  assert.deepEqual(diagnostics, {
    runtimeConfigExists: true,
    supabaseUrlSet: true,
    supabaseAnonKeySet: true,
    windowSupabaseExists: false
  });
  assert.equal(harness.auth.getClient(), null);
});

test("runtime configuration diagnostics do not expose analytics secrets or event internals", () => {
  const harness = createAuthHarness({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-value",
      SUPABASE_SERVICE_ROLE_KEY: "forbidden",
      ANALYTICS_HASH_SECRET: "forbidden",
      PRODUCT_ANALYTICS_SECRET: "forbidden",
      PRODUCT_EVENT_INTERNALS: "forbidden"
    },
    supabase: undefined
  });

  const diagnostics = JSON.stringify(harness.auth.getDiagnostics());
  assert.doesNotMatch(diagnostics, /service.role|analytics|product.*hash|product.*event|forbidden/i);
});

test("register submit does not show environment variable prompt when only the SDK is missing", async () => {
  const harness = createAuthHarness({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-value"
    },
    supabase: undefined
  });

  const statusText = await submitRegisterForm(harness);

  assert.match(statusText, /Supabase SDK/);
  assert.match(statusText, /window\.supabase 是否存在：否/);
  assert.doesNotMatch(statusText, /请先配置 Supabase 环境变量。/);
});

test("distinguishes missing runtime config from missing Supabase SDK", () => {
  const harness = createAuthHarness({
    env: {},
    supabase: {
      createClient() {
        return {};
      }
    }
  });

  const diagnostics = JSON.parse(JSON.stringify(harness.auth.getDiagnostics()));

  assert.deepEqual(diagnostics, {
    runtimeConfigExists: true,
    supabaseUrlSet: false,
    supabaseAnonKeySet: false,
    windowSupabaseExists: true
  });
  assert.equal(harness.auth.getClient(), null);
});

test("register submit still shows the environment variable prompt when config is missing", async () => {
  const harness = createAuthHarness({
    env: {},
    supabase: {
      createClient() {
        return {};
      }
    }
  });

  const statusText = await submitRegisterForm(harness);

  assert.match(statusText, /请先配置 Supabase 环境变量。/);
  assert.match(statusText, /SUPABASE_URL 是否已设置：否/);
  assert.match(statusText, /SUPABASE_ANON_KEY 是否已设置：否/);
});

test("register submit requires explicit legal consent before Supabase signUp", async () => {
  let signUpCalls = 0;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange() {},
      signUp: async () => {
        signUpCalls += 1;
        return { data: {}, error: null };
      }
    }
  };
  const harness = createAuthHarness({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-value"
    },
    privacyData: {
      validateRegistrationConsent: () => false
    },
    supabase: { createClient: () => client }
  });

  await harness.ready;
  const statusText = await submitRegisterForm(harness);

  assert.equal(signUpCalls, 0);
  assert.match(statusText, /请先阅读并勾选同意用户协议、隐私政策和 AI 使用说明。/);
});

test("logout publishes an immediate null session before signOut settles", async () => {
  const pendingSignOut = deferred();
  const activeSession = { user: { id: "active-user", email: "active@example.com" } };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: activeSession } }),
      onAuthStateChange() {},
      signOut: () => pendingSignOut.promise
    }
  };
  const harness = createAuthHarness({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-value"
    },
    supabase: { createClient: () => client }
  });
  await harness.ready;
  harness.dispatchedEvents.length = 0;

  const logoutRun = harness.nodes.get("[data-auth-logout]").listeners.click();

  assert.equal(harness.nodes.get("[data-auth-session]").hidden, true);
  assert.equal(harness.nodes.get("[data-auth-email]").textContent, "");
  assert.equal(harness.dispatchedEvents.length, 1);
  assert.equal(harness.dispatchedEvents[0].detail.user, null);

  pendingSignOut.resolve({ error: null });
  await logoutRun;
});

test("publishes safe auth event types with session notifications", async () => {
  const activeSession = { user: { id: "active-user", email: "active@example.com" } };
  let authStateListener = null;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: activeSession } }),
      onAuthStateChange(callback) {
        authStateListener = callback;
      },
      signOut: async () => ({ error: null })
    }
  };
  const harness = createAuthHarness({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-value"
    },
    supabase: { createClient: () => client }
  });

  await harness.ready;

  assert.equal(harness.dispatchedEvents.at(-1).detail.authEvent, "INITIAL_SESSION");
  assert.equal(typeof authStateListener, "function");

  harness.dispatchedEvents.length = 0;
  authStateListener("TOKEN_REFRESHED", activeSession);

  assert.equal(harness.dispatchedEvents.length, 1);
  assert.equal(harness.dispatchedEvents[0].detail.user.id, "active-user");
  assert.equal(harness.dispatchedEvents[0].detail.authEvent, "TOKEN_REFRESHED");
});

test("failed logout restores only the authoritative session from getSession", async () => {
  const activeSession = { user: { id: "active-user", email: "active@example.com" } };
  let getSessionCalls = 0;
  const client = {
    auth: {
      async getSession() {
        getSessionCalls += 1;
        return { data: { session: activeSession } };
      },
      onAuthStateChange() {},
      signOut: async () => {
        throw new Error("private token-shaped signOut failure");
      }
    }
  };
  const harness = createAuthHarness({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-value"
    },
    supabase: { createClient: () => client }
  });
  await harness.ready;
  harness.dispatchedEvents.length = 0;

  const logoutRun = harness.nodes.get("[data-auth-logout]").listeners.click();
  logoutRun.catch(() => {});

  assert.equal(harness.dispatchedEvents.length, 1);
  assert.equal(harness.dispatchedEvents[0].detail.user, null);
  await assert.doesNotReject(logoutRun);
  assert.equal(getSessionCalls, 2);
  assert.equal(harness.nodes.get("[data-auth-session]").hidden, false);
  assert.equal(harness.nodes.get("[data-auth-email]").textContent, "active@example.com");
  assert.equal(harness.dispatchedEvents.at(-1).detail.user.email, "active@example.com");
});
