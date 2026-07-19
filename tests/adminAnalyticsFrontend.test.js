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
    productCards: createElement(),
    productEventDistribution: createElement(),
    productFunnel: createElement(),
    productPageDistribution: createElement(),
    productRetention: createElement(),
    productSampleLabel: createElement(),
    productPrincipalDistribution: createElement(),
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
  assert.equal(calls.length, 5);
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

test("renders aggregate product analytics with the consented-sample label and no hashes", async () => {
  const elements = createElements();
  const principalHash = "product-principal-hash-must-not-render";
  const sessionHash = "product-session-hash-must-not-render";
  const controller = AdminAnalytics.createAdminAnalyticsController({
    elements,
    fetchJson: async (url) => ({
      ok: true,
      json: async () => {
        if (url.includes("product-analytics/funnel")) {
          return {
            sampleLabel: "基于已同意产品分析的用户样本",
            stages: [
              { name: "app_opened", count: 12, principal_hash: principalHash, session_hash: sessionHash },
              { name: "dream_saved", count: 4 }
            ]
          };
        }
        if (url.includes("product-analytics/retention")) {
          return {
            sampleLabel: "基于已同意产品分析的用户样本",
            d1: { status: "ok", cohortSize: 8, retainedPrincipals: 3, rate: 0.375 },
            d7: { status: "insufficient_data" }
          };
        }
        if (url.includes("product-analytics/summary")) {
          return {
            sampleLabel: "基于已同意产品分析的用户样本",
            approximatePrincipals: 12,
            principalTypeDistribution: [{ label: "authenticated", count: 7 }],
            pageDistribution: [{ label: "quick", count: 9 }],
            eventDistribution: [{ label: "analysis_completed", count: 5 }],
            principal_hash: principalHash,
            session_hash: sessionHash
          };
        }
        return { totalRequests: 0, dailyTrend: [], recent: [] };
      }
    }),
    getAuthHeader: async () => ({ Authorization: "Bearer token" }),
    app: { showView() {} },
    document: createDocument()
  });

  await controller.enterAdminView();

  assert.ok(elements.productCards.children.length > 0);
  assert.ok(elements.productFunnel.children.length > 0);
  assert.ok(elements.productRetention.children.length > 0);
  assert.equal(elements.productSampleLabel.textContent, "基于已同意产品分析的用户样本");
  assert.match(JSON.stringify(elements), /分析完成/);
  assert.doesNotMatch(JSON.stringify(elements), /product-(principal|session)-hash-must-not-render/);
});
