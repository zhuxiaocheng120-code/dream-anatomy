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

function createAuthHarness({ env, supabase }) {
  const nodes = new Map();

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
          callback();
        }
      },
      querySelector: getNode,
      querySelectorAll() {
        return [];
      }
    },
    window: {
      DREAM_ANATOMY_ENV: env,
      dispatchEvent() {},
      location: { origin: "https://dream-anatomy.onrender.com" },
      supabase
    }
  };

  context.window.window = context.window;
  context.window.document = context.document;
  vm.runInNewContext(authCode, context);

  return {
    auth: context.window.DreamAnatomyAuth,
    nodes
  };
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
