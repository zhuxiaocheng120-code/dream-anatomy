const assert = require("node:assert/strict");
const test = require("node:test");

const AdminAnalytics = require("../src/adminAnalytics");

function createElement() {
  return {
    hidden: false,
    textContent: "",
    disabled: false,
    children: [],
    dataset: {},
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    replaceChildren(...children) {
      this.children = children;
    },
    append(...children) {
      this.children.push(...children);
    },
    addEventListener(type, handler) {
      this[`on${type}`] = handler;
    },
    setAttribute(name, value) {
      this[name] = value;
    }
  };
}

function createDocument() {
  return {
    createElement(tagName) {
      return {
        ...createElement(),
        tagName,
        type: "",
        appendChild(child) {
          this.children.push(child);
        }
      };
    }
  };
}

function createElements() {
  return {
    analysisDistribution: createElement(),
    cards: createElement(),
    costNote: createElement(),
    entry: createElement(),
    errorDistribution: createElement(),
    principalDistribution: createElement(),
    rangeButtons: [],
    recent: createElement(),
    status: createElement(),
    trend: createElement()
  };
}

test("admin entry is hidden until server confirms admin", async () => {
  const elements = createElements();
  const calls = [];
  const controller = AdminAnalytics.createAdminAnalyticsController({
    elements,
    fetchJson: async () => {
      calls.push("probe");
      return {
        ok: true,
        json: async () => ({
          totalRequests: 0,
          dailyTrend: [],
          recent: []
        })
      };
    },
    getAuthHeader: async () => ({ Authorization: "Bearer token" }),
    app: { showView() {} },
    document: createDocument()
  });

  assert.equal(elements.entry.hidden, true);
  await controller.handleSession({ user: { id: "admin" } });

  assert.equal(elements.entry.hidden, false);
  assert.equal(calls.length, 2);
});

test("logout clears data and leaves admin view", async () => {
  const views = [];
  const elements = createElements();
  const controller = AdminAnalytics.createAdminAnalyticsController({
    elements,
    fetchJson: async () => ({
      ok: true,
      json: async () => ({
        totalRequests: 1,
        dailyTrend: [],
        recent: []
      })
    }),
    getAuthHeader: async () => ({ Authorization: "Bearer token" }),
    app: {
      getCurrentView: () => "admin",
      showView(view) {
        views.push(view);
      }
    },
    document: createDocument()
  });

  await controller.handleSession({ user: { id: "admin" } });
  await controller.handleSession({ user: null });

  assert.equal(elements.entry.hidden, true);
  assert.equal(elements.cards.children.length, 0);
  assert.deepEqual(views, ["home"]);
});

test("manual admin view access shows no permission on 403", async () => {
  const elements = createElements();
  const controller = AdminAnalytics.createAdminAnalyticsController({
    elements,
    fetchJson: async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: "AUTH_FORBIDDEN", message: "无权限" } })
    }),
    getAuthHeader: async () => ({ Authorization: "Bearer token" }),
    app: { showView() {} },
    document: createDocument()
  });

  await controller.enterAdminView();

  assert.match(elements.status.textContent, /无权限/);
  assert.equal(elements.entry.hidden, true);
});

test("renders summary and recent events without principal hash", async () => {
  const elements = createElements();
  const controller = AdminAnalytics.createAdminAnalyticsController({
    elements,
    fetchJson: async (url) => ({
      ok: true,
      json: async () => url.includes("recent")
        ? {
            events: [{
              requestId: "abc12345",
              principalType: "guest",
              analysisType: "quick",
              outcome: "success",
              durationMs: 120,
              totalTokens: 30,
              estimatedCostUsd: 0.001,
              principal_hash: "must-not-render"
            }]
          }
        : {
            todayRequests: 1,
            totalRequests: 2,
            approximatePrincipals: 2,
            successRate: 0.5,
            averageDurationMs: 120,
            totalTokens: 30,
            totalEstimatedCostUsd: 0.001,
            costConfigured: true,
            dailyTrend: [{ date: "2026-07-17", count: 2 }],
            analysisTypeDistribution: [{ label: "quick", count: 2 }],
            errorCodeDistribution: []
          }
    }),
    getAuthHeader: async () => ({ Authorization: "Bearer token" }),
    app: { showView() {} },
    document: createDocument()
  });

  await controller.enterAdminView();

  assert.ok(elements.cards.children.length > 0);
  assert.ok(elements.recent.children.length > 0);
  assert.doesNotMatch(JSON.stringify(elements), /must-not-render/);
  assert.doesNotMatch(JSON.stringify(elements), /"quick"/);
  assert.match(JSON.stringify(elements), /快速解析/);
  assert.match(JSON.stringify(elements), /120 毫秒/);
});
