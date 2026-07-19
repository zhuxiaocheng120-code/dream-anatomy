const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const DreamHome = require("../src/dreamHome");

function createFakeElement() {
  const listeners = new Map();
  const element = {
    children: [],
    className: "",
    dataset: {},
    hidden: false,
    textContent: "",
    classList: {
      values: new Set(),
      add(value) {
        this.values.add(value);
      },
      remove(value) {
        this.values.delete(value);
      },
      contains(value) {
        return this.values.has(value);
      }
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    trigger(type, event) {
      const listener = listeners.get(type);
      if (listener) {
        return listener(event);
      }
    },
    querySelector(selector) {
      if (selector !== "[data-feature-status]") {
        return null;
      }

      return this.children.find((child) => child.dataset && Object.prototype.hasOwnProperty.call(child.dataset, "featureStatus")) || null;
    }
  };

  Object.defineProperty(element, "innerHTML", {
    set() {
      throw new Error("Dream Home rendering must not assign innerHTML");
    }
  });

  return element;
}

function createDreamHomeElements() {
  return {
    publicHome: createFakeElement(),
    dreamHome: createFakeElement(),
    greeting: createFakeElement(),
    email: createFakeElement(),
    quoteText: createFakeElement(),
    quoteAuthor: createFakeElement(),
    total: createFakeElement(),
    important: createFakeElement(),
    streak: createFakeElement(),
    aiOrganized: createFakeElement(),
    recent: createFakeElement(),
    status: createFakeElement(),
    retry: createFakeElement(),
    quickAction: createFakeElement(),
    guidedAction: createFakeElement(),
    diaryAction: createFakeElement()
  };
}

function createFakeDocument() {
  return {
    createElement() {
      return createFakeElement();
    }
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

function createFakeApp() {
  const calls = [];

  return {
    calls,
    openDreamDetail(recordId, fallbackRecord) {
      calls.push(["openDreamDetail", recordId, fallbackRecord]);
    },
    showView(viewName) {
      calls.push(["showView", viewName]);
    }
  };
}

function createAppBridgeHarness() {
  function createDomNode() {
    const node = {
      children: [],
      className: "",
      dataset: {},
      hidden: false,
      _textContent: "",
      addEventListener() {},
      append(...children) {
        this.children.push(...children);
      },
      setAttribute() {},
      classList: { toggle() {} }
    };

    Object.defineProperty(node, "textContent", {
      get() {
        return this._textContent;
      },
      set(value) {
        this._textContent = String(value);
        this.children = [];
      }
    });

    return node;
  }

  const journalListShell = createDomNode();
  const dreamDetail = createDomNode();
  const dreamDetailContent = createDomNode();
  const mappedRows = [];
  const documentRef = {
    createElement: createDomNode,
    querySelector(selector) {
      return new Map([
        ["[data-journal-list-shell]", journalListShell],
        ["[data-dream-detail]", dreamDetail],
        ["[data-dream-detail-content]", dreamDetailContent]
      ]).get(selector) || null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const windowRef = {
    DreamSync: {
      createDreamSyncController() {
        return {
          getVisibleRecords: () => [],
          retryPendingRecords: async () => ({ syncedCount: 0 }),
          setSession() {}
        };
      },
      mapSupabaseRowToLocalRecord(row) {
        mappedRows.push(row);
        return {
          id: row.local_record_id,
          createdAt: row.created_at,
          rawDreamText: row.raw_dream_text,
          dreamSummary: row.dream_summary,
          emotions: row.emotions,
          symbols: row.symbols,
          sleepQuality: row.sleep_quality,
          analysisType: row.analysis_type,
          reportContent: row.report_content
        };
      }
    },
    addEventListener() {},
    confirm: () => false,
    scrollTo() {}
  };
  const context = {
    document: documentRef,
    localStorage: {
      getItem: () => null,
      removeItem() {},
      setItem() {}
    },
    window: windowRef
  };
  windowRef.document = documentRef;
  windowRef.localStorage = context.localStorage;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8"), context);

  return { app: windowRef.DreamAnatomyApp, dreamDetailContent, mappedRows };
}

function collectText(node) {
  return [node.textContent, ...node.children.flatMap(collectText)].filter(Boolean);
}

const testQuotes = {
  getQuoteForDate() {
    return { text: "静听梦的回声。", author: "测试" };
  }
};

function createFakeSupabase(rows) {
  const state = { eqCalls: [], fromCalls: [], orderCalls: [] };

  return {
    client: {
      from(table) {
        state.fromCalls.push(table);
        let filteredRows = rows;

        const chain = {
          select(columns) {
            assert.equal(columns, "*");
            return chain;
          },
          eq(column, value) {
            state.eqCalls.push([column, value]);
            filteredRows = filteredRows.filter((row) => row[column] === value);
            return chain;
          },
          order(column, options) {
            state.orderCalls.push([column, options]);
            const sortedRows = [...filteredRows].sort(
              (left, right) => new Date(right[column]) - new Date(left[column])
            );
            return Promise.resolve({ data: sortedRows, error: null });
          }
        };

        return chain;
      }
    },
    state
  };
}

test("returns time-aware greetings at the specified boundaries", () => {
  assert.equal(DreamHome.getGreeting(new Date(2026, 6, 12, 5)), "早上好");
  assert.equal(DreamHome.getGreeting(new Date(2026, 6, 12, 11, 59)), "早上好");
  assert.equal(DreamHome.getGreeting(new Date(2026, 6, 12, 12)), "下午好");
  assert.equal(DreamHome.getGreeting(new Date(2026, 6, 12, 17, 59)), "下午好");
  assert.equal(DreamHome.getGreeting(new Date(2026, 6, 12, 18)), "晚上好");
  assert.equal(DreamHome.getGreeting(new Date(2026, 6, 12, 4, 59)), "晚上好");
});

test("uses title fields in display-title fallback order", () => {
  assert.equal(
    DreamHome.getDisplayTitle({
      title: " 已命名的梦 ",
      dream_summary: "云端摘要",
      raw_dream_text: "云端原文"
    }),
    "已命名的梦"
  );
  assert.equal(
    DreamHome.getDisplayTitle({ dreamSummary: " 本地   摘要 ", rawDreamText: "本地原文" }),
    "本地 摘要"
  );
  assert.equal(
    DreamHome.getDisplayTitle({ raw_dream_text: " 雨中   迷路 " }),
    "雨中 迷路"
  );
  assert.equal(DreamHome.getDisplayTitle({}), "未命名的梦");
});

test("collapses whitespace before truncating display titles", () => {
  assert.equal(
    DreamHome.getDisplayTitle({ rawDreamText: "一 二 三 四 五 六" }, 7),
    "一 二 三 四..."
  );
});

test("calculates a de-duplicated streak from today", () => {
  const records = [
    { created_at: "2026-07-12T01:00:00" },
    { created_at: "2026-07-12T09:00:00" },
    { created_at: "2026-07-11T09:00:00" },
    { created_at: "2026-07-10T09:00:00" },
    { created_at: "2026-07-08T09:00:00" }
  ];

  assert.equal(
    DreamHome.calculateDreamStreak(records, new Date(2026, 6, 12, 20)),
    3
  );
});

test("starts a streak from yesterday when today is empty", () => {
  const records = [
    { createdAt: "2026-07-11T09:00:00" },
    { createdAt: "2026-07-10T09:00:00" }
  ];

  assert.equal(
    DreamHome.calculateDreamStreak(records, new Date(2026, 6, 12, 20)),
    2
  );
});

test("ignores invalid record dates when calculating a local-date streak", () => {
  const records = [
    { created_at: "invalid" },
    { createdAt: "2026-07-12T23:00:00" },
    { created_at: "2026-07-10T09:00:00" }
  ];

  assert.equal(
    DreamHome.calculateDreamStreak(records, new Date(2026, 6, 12, 20)),
    1
  );
});

test("calculates all four statistics", () => {
  const records = [
    { created_at: "2026-07-12T09:00:00", analysis_type: "快速解析" },
    { createdAt: "2026-07-11T09:00:00", analysisType: "深度引导" },
    { created_at: "invalid", analysis_type: "其他" }
  ];

  assert.deepEqual(
    DreamHome.calculateDreamStats(records, new Date(2026, 6, 12, 20)),
    { total: 3, important: 0, streak: 2, aiOrganized: 2 }
  );
});

test("formats a one-night streak with the singular English label", () => {
  assert.equal(DreamHome.formatDreamStreak(1), "1 Night");
});

test("sorts recent records by either date field and limits them to five", () => {
  const records = [
    { id: "one", createdAt: "2026-07-08T09:00:00" },
    { id: "two", created_at: "2026-07-12T09:00:00" },
    { id: "three", createdAt: "2026-07-10T09:00:00" },
    { id: "four", created_at: "2026-07-11T09:00:00" },
    { id: "five", createdAt: "2026-07-09T09:00:00" },
    { id: "six", created_at: "2026-07-07T09:00:00" }
  ];

  assert.deepEqual(
    DreamHome.getRecentDreams(records).map((record) => record.id),
    ["two", "four", "three", "five", "one"]
  );
});

test("queries and returns only the requested user's records", async () => {
  const fake = createFakeSupabase([
    { id: "one", user_id: "user-one", created_at: "2026-07-11T09:00:00" },
    { id: "two", user_id: "user-two", created_at: "2026-07-12T09:00:00" },
    { id: "three", user_id: "user-one", created_at: "2026-07-12T09:00:00" }
  ]);

  const firstUserRecords = await DreamHome.fetchDreamRecords(fake.client, { id: "user-one" });

  assert.deepEqual(fake.state.eqCalls, [["user_id", "user-one"]]);
  assert.deepEqual(fake.state.orderCalls, [["created_at", { ascending: false }]]);
  assert.deepEqual(
    firstUserRecords.map((row) => row.id),
    ["three", "one"]
  );
  assert.deepEqual(
    firstUserRecords.map((row) => row.user_id),
    ["user-one", "user-one"]
  );
  assert.deepEqual(
    (await DreamHome.fetchDreamRecords(fake.client, { id: "user-two" })).map((row) => row.user_id),
    ["user-two"]
  );
});

test("skips queries without an active user and keeps upstream errors private", async () => {
  let queried = false;
  const client = {
    from() {
      queried = true;
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return Promise.resolve({ data: null, error: new Error("private upstream detail") });
        }
      };
    }
  };

  assert.deepEqual(await DreamHome.fetchDreamRecords(client, null), []);
  assert.equal(queried, false);
  await assert.rejects(
    DreamHome.fetchDreamRecords(client, { id: "user-one" }),
    /^Error: Dream Home records unavailable$/
  );
});

test("renders the active user's Dream Home after loading their records", async () => {
  const loading = deferred();
  const elements = createDreamHomeElements();
  const app = createFakeApp();
  const fetchCalls = [];
  const controller = DreamHome.createDreamHomeController({
    app,
    document: createFakeDocument(),
    elements,
    fetchRecords(client, user) {
      fetchCalls.push([client, user.id]);
      return loading.promise;
    },
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  const run = controller.handleSession({
    client: { name: "active-client" },
    user: { id: "user-one", email: "<img src=x onerror=alert('email')>" }
  });

  assert.equal(elements.publicHome.hidden, true);
  assert.equal(elements.dreamHome.hidden, false);
  assert.equal(elements.status.textContent, "正在整理你的梦境档案……");
  assert.deepEqual(fetchCalls.map((call) => call[1]), ["user-one"]);
  assert.deepEqual(app.calls, [["showView", "home"]]);

  loading.resolve([
    {
      id: "today",
      created_at: "2026-07-12T08:00:00",
      dream_summary: "<script>alert('title')</script>",
      analysis_type: "快速解析"
    },
    {
      id: "yesterday",
      created_at: "2026-07-11T08:00:00",
      dream_summary: "旧房子的门",
      analysis_type: "深度引导"
    }
  ]);
  await run;

  assert.equal(elements.email.textContent, "<img src=x onerror=alert('email')>");
  assert.equal(elements.greeting.textContent, "早上好");
  assert.equal(elements.quoteText.textContent, "静听梦的回声。");
  assert.equal(elements.quoteAuthor.textContent, "测试");
  assert.equal(elements.total.textContent, "2");
  assert.equal(elements.important.textContent, "0");
  assert.equal(elements.streak.textContent, "2 Nights");
  assert.equal(elements.aiOrganized.textContent, "2");
  assert.equal(elements.recent.children.length, 2);
  assert.equal(elements.recent.children[0].textContent, "<script>alert('title')</script>");
});

test("clears record-derived Dream Home content before returning to the public home", async () => {
  const elements = createDreamHomeElements();
  const controller = DreamHome.createDreamHomeController({
    app: createFakeApp(),
    document: createFakeDocument(),
    elements,
    fetchRecords: async () => [{
      id: "record-one",
      created_at: "2026-07-12T08:00:00",
      dream_summary: "会被清除的梦"
    }],
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.handleSession({
    client: {},
    user: { id: "user-one", email: "one@example.com" }
  });
  await controller.handleSession({ client: null, user: null });

  assert.equal(elements.email.textContent, "");
  assert.equal(elements.total.textContent, "");
  assert.equal(elements.important.textContent, "");
  assert.equal(elements.streak.textContent, "");
  assert.equal(elements.aiOrganized.textContent, "");
  assert.equal(elements.recent.children.length, 0);
  assert.equal(elements.publicHome.hidden, false);
  assert.equal(elements.dreamHome.hidden, true);
});

test("keeps the current view during restored and refreshed auth sessions", async () => {
  const elements = createDreamHomeElements();
  const app = createFakeApp();
  const fetchedUsers = [];
  const controller = DreamHome.createDreamHomeController({
    app,
    document: createFakeDocument(),
    elements,
    fetchRecords: async (_client, user) => {
      fetchedUsers.push(user.id);
      return [];
    },
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.handleSession({
    authEvent: "INITIAL_SESSION",
    client: {},
    user: { id: "user-one", email: "one@example.com" }
  });
  await controller.handleSession({
    authEvent: "TOKEN_REFRESHED",
    client: {},
    user: { id: "user-one", email: "one@example.com" }
  });
  await controller.handleSession({
    authEvent: "SESSION_RESTORED",
    client: {},
    user: { id: "user-one", email: "one@example.com" }
  });

  assert.deepEqual(fetchedUsers, ["user-one", "user-one", "user-one"]);
  assert.deepEqual(app.calls, []);
  assert.equal(elements.publicHome.hidden, true);
  assert.equal(elements.dreamHome.hidden, false);
});

test("does not navigate home for an empty initial session", async () => {
  const elements = createDreamHomeElements();
  const app = createFakeApp();
  const controller = DreamHome.createDreamHomeController({
    app,
    document: createFakeDocument(),
    elements,
    fetchRecords: async () => {
      throw new Error("Empty initial sessions should not query records");
    },
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.handleSession({
    authEvent: "INITIAL_SESSION",
    client: {},
    user: null
  });

  assert.deepEqual(app.calls, []);
  assert.equal(elements.publicHome.hidden, false);
  assert.equal(elements.dreamHome.hidden, true);
});

test("enters Dream Home only after a real first sign-in", async () => {
  const elements = createDreamHomeElements();
  const app = createFakeApp();
  const controller = DreamHome.createDreamHomeController({
    app,
    document: createFakeDocument(),
    elements,
    fetchRecords: async () => [],
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.handleSession({
    authEvent: "SIGNED_IN",
    client: {},
    user: { id: "user-one", email: "one@example.com" }
  });
  await controller.handleSession({
    authEvent: "SIGNED_IN",
    client: {},
    user: { id: "user-one", email: "one@example.com" }
  });

  assert.deepEqual(app.calls, [["showView", "home"]]);
});

test("initializes a public home without querying Supabase", async () => {
  let queryCount = 0;
  const elements = createDreamHomeElements();
  const controller = DreamHome.createDreamHomeController({
    app: createFakeApp(),
    document: createFakeDocument(),
    elements,
    fetchRecords: async () => {
      queryCount += 1;
      return [];
    },
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.init();

  assert.equal(queryCount, 0);
  assert.equal(elements.publicHome.hidden, false);
  assert.equal(elements.dreamHome.hidden, true);
});

test("initializes Dream Home from an already restored authenticated session", async () => {
  const elements = createDreamHomeElements();
  const app = createFakeApp();
  const fetchedUsers = [];
  const controller = DreamHome.createDreamHomeController({
    app,
    document: createFakeDocument(),
    elements,
    fetchRecords: async (_client, user) => {
      fetchedUsers.push(user.id);
      return [{
        id: "record-one",
        user_id: user.id,
        created_at: "2026-07-12T08:00:00Z",
        dream_summary: "已经恢复的梦"
      }];
    },
    getCurrentSession: async () => ({
      client: {},
      user: { id: "restored-user", email: "restored@example.com" }
    }),
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.init();

  assert.deepEqual(fetchedUsers, ["restored-user"]);
  assert.equal(elements.publicHome.hidden, true);
  assert.equal(elements.dreamHome.hidden, false);
  assert.equal(elements.email.textContent, "restored@example.com");
  assert.equal(elements.recent.children[0].textContent, "已经恢复的梦");
  assert.deepEqual(app.calls, []);
});

test("discards a stale response after another user becomes active", async () => {
  const first = deferred();
  const second = deferred();
  const elements = createDreamHomeElements();
  const controller = DreamHome.createDreamHomeController({
    app: createFakeApp(),
    document: createFakeDocument(),
    elements,
    fetchRecords: (_client, user) => user.id === "one" ? first.promise : second.promise,
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  const firstRun = controller.handleSession({
    user: { id: "one", email: "one@example.com" },
    client: {}
  });
  const secondRun = controller.handleSession({
    user: { id: "two", email: "two@example.com" },
    client: {}
  });
  second.resolve([{ id: "two-record", user_id: "two", created_at: "2026-07-12T08:00:00" }]);
  await secondRun;
  first.resolve([{ id: "one-record", user_id: "one", created_at: "2026-07-12T07:00:00" }]);
  await firstRun;

  assert.equal(elements.email.textContent, "two@example.com");
  assert.equal(elements.recent.children.length, 1);
});

test("discards a stale rejection after another user succeeds", async () => {
  const first = deferred();
  const second = deferred();
  const elements = createDreamHomeElements();
  const controller = DreamHome.createDreamHomeController({
    app: createFakeApp(),
    document: createFakeDocument(),
    elements,
    fetchRecords: (_client, user) => user.id === "one" ? first.promise : second.promise,
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  const firstRun = controller.handleSession({
    user: { id: "one", email: "one@example.com" },
    client: {}
  });
  const secondRun = controller.handleSession({
    user: { id: "two", email: "two@example.com" },
    client: {}
  });
  second.resolve([{
    id: "two-record",
    user_id: "two",
    created_at: "2026-07-12T08:00:00",
    dream_summary: "第二位用户的梦"
  }]);
  await secondRun;
  first.reject(new Error("private stale failure"));
  await firstRun;

  assert.equal(elements.email.textContent, "two@example.com");
  assert.equal(elements.status.textContent, "");
  assert.equal(elements.retry.hidden, true);
  assert.equal(elements.recent.children.length, 1);
  assert.equal(elements.recent.children[0].textContent, "第二位用户的梦");
});

test("discards a stale success after logout while a request is pending", async () => {
  const loading = deferred();
  const elements = createDreamHomeElements();
  const controller = DreamHome.createDreamHomeController({
    app: createFakeApp(),
    document: createFakeDocument(),
    elements,
    fetchRecords: () => loading.promise,
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  const pendingRun = controller.handleSession({
    user: { id: "one", email: "one@example.com" },
    client: {}
  });
  await controller.handleSession({ user: null, client: null });
  loading.resolve([{
    id: "stale-record",
    created_at: "2026-07-12T08:00:00",
    dream_summary: "不应重新出现"
  }]);
  await pendingRun;

  assert.equal(elements.publicHome.hidden, false);
  assert.equal(elements.dreamHome.hidden, true);
  assert.equal(elements.email.textContent, "");
  assert.equal(elements.status.textContent, "");
  assert.equal(elements.recent.children.length, 0);
});

test("discards a stale error after logout while a request is pending", async () => {
  const loading = deferred();
  const elements = createDreamHomeElements();
  const controller = DreamHome.createDreamHomeController({
    app: createFakeApp(),
    document: createFakeDocument(),
    elements,
    fetchRecords: () => loading.promise,
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  const pendingRun = controller.handleSession({
    user: { id: "one", email: "one@example.com" },
    client: {}
  });
  await controller.handleSession({ user: null, client: null });
  loading.reject(new Error("private stale logout failure"));
  await pendingRun;

  assert.equal(elements.publicHome.hidden, false);
  assert.equal(elements.dreamHome.hidden, true);
  assert.equal(elements.email.textContent, "");
  assert.equal(elements.status.textContent, "");
  assert.equal(elements.retry.hidden, true);
  assert.equal(elements.recent.children.length, 0);
});

test("shows a safe active-session failure and successfully retries that session", async () => {
  const elements = createDreamHomeElements();
  const fetchedUsers = [];
  let attempts = 0;
  const controller = DreamHome.createDreamHomeController({
    app: createFakeApp(),
    document: createFakeDocument(),
    elements,
    fetchRecords: async (_client, user) => {
      attempts += 1;
      fetchedUsers.push(user.id);

      if (attempts === 1) {
        throw new Error("private database failure");
      }

      return [{
        id: "recovered-record",
        created_at: "2026-07-12T08:00:00",
        dream_summary: "重试后回来的梦"
      }];
    },
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.handleSession({
    client: { name: "same-client" },
    user: { id: "active-user", email: "active@example.com" }
  });

  assert.equal(elements.status.textContent, "暂时无法整理云端梦境，请稍后重试。");
  assert.doesNotMatch(elements.status.textContent, /private|database/i);
  assert.equal(elements.retry.hidden, false);
  assert.equal(elements.recent.children.length, 0);

  await controller.retry();

  assert.equal(attempts, 2);
  assert.deepEqual(fetchedUsers, ["active-user", "active-user"]);
  assert.equal(elements.email.textContent, "active@example.com");
  assert.equal(elements.status.textContent, "");
  assert.equal(elements.retry.hidden, true);
  assert.equal(elements.recent.children[0].textContent, "重试后回来的梦");
});

test("retries only while a current session is active", async () => {
  const fetchedUsers = [];
  const controller = DreamHome.createDreamHomeController({
    app: createFakeApp(),
    document: createFakeDocument(),
    elements: createDreamHomeElements(),
    fetchRecords: async (_client, user) => {
      fetchedUsers.push(user.id);
      return [];
    },
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.handleSession({ client: {}, user: { id: "one", email: "one@example.com" } });
  await controller.retry();
  await controller.handleSession({ client: null, user: null });
  await controller.retry();

  assert.deepEqual(fetchedUsers, ["one", "one"]);
});

test("uses existing app views for Dream Home quick actions", () => {
  const elements = createDreamHomeElements();
  const app = createFakeApp();
  DreamHome.createDreamHomeController({
    app,
    document: createFakeDocument(),
    elements,
    featureFlags: { DEEP_GUIDANCE_ENABLED: true },
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  elements.quickAction.trigger("click");
  elements.guidedAction.trigger("click");
  elements.diaryAction.trigger("click");

  assert.deepEqual(app.calls, [
    ["showView", "quick"],
    ["showView", "guided"],
    ["showView", "diary"]
  ]);
});

test("keeps Dream Home deep guidance action visible but disabled by feature flag", () => {
  const elements = createDreamHomeElements();
  const app = createFakeApp();
  DreamHome.createDreamHomeController({
    app,
    document: createFakeDocument(),
    elements,
    featureFlags: { DEEP_GUIDANCE_ENABLED: false },
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  elements.quickAction.trigger("click");
  elements.guidedAction.trigger("click");
  elements.diaryAction.trigger("click");

  assert.equal(elements.guidedAction.disabled, true);
  assert.match(collectText(elements.guidedAction).join("\n"), /正在开发中/);
  assert.deepEqual(app.calls, [
    ["showView", "quick"],
    ["showView", "diary"]
  ]);
});

test("keeps Dream Home deep guidance action enabled when feature flag is enabled", () => {
  const elements = createDreamHomeElements();
  const app = createFakeApp();
  DreamHome.createDreamHomeController({
    app,
    document: createFakeDocument(),
    elements,
    featureFlags: { DEEP_GUIDANCE_ENABLED: true },
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  elements.guidedAction.trigger("click");

  assert.equal(elements.guidedAction.disabled, false);
  assert.doesNotMatch(collectText(elements.guidedAction).join("\n"), /正在开发中/);
  assert.deepEqual(app.calls, [["showView", "guided"]]);
});

test("opens a recent Dream Home record through the existing diary detail flow", async () => {
  const elements = createDreamHomeElements();
  const app = createFakeApp();
  const controller = DreamHome.createDreamHomeController({
    app,
    document: createFakeDocument(),
    elements,
    fetchRecords: async () => [{
      id: "record-one",
      created_at: "2026-07-12T08:00:00",
      dream_summary: "通向花园的门"
    }],
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.handleSession({ client: {}, user: { id: "one", email: "one@example.com" } });
  app.calls.length = 0;
  elements.recent.children[0].trigger("click");

  assert.deepEqual(app.calls, [
    ["showView", "diary"],
    ["openDreamDetail", "record-one", {
      id: "record-one",
      created_at: "2026-07-12T08:00:00",
      dream_summary: "通向花园的门"
    }]
  ]);
});

test("opens recent cloud records with their local diary identifiers", async () => {
  const elements = createDreamHomeElements();
  const app = createFakeApp();
  const controller = DreamHome.createDreamHomeController({
    app,
    document: createFakeDocument(),
    elements,
    fetchRecords: async () => [
      {
        id: "cloud-one",
        local_record_id: "local-one",
        created_at: "2026-07-12T08:00:00"
      },
      {
        id: "cloud-two",
        localRecordId: "local-two",
        created_at: "2026-07-11T08:00:00"
      }
    ],
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.handleSession({ client: {}, user: { id: "one", email: "one@example.com" } });
  app.calls.length = 0;
  elements.recent.children[0].trigger("click");
  elements.recent.children[1].trigger("click");

  assert.deepEqual(app.calls, [
    ["showView", "diary"],
    ["openDreamDetail", "local-one", {
      id: "cloud-one",
      local_record_id: "local-one",
      created_at: "2026-07-12T08:00:00"
    }],
    ["showView", "diary"],
    ["openDreamDetail", "local-two", {
      id: "cloud-two",
      localRecordId: "local-two",
      created_at: "2026-07-11T08:00:00"
    }]
  ]);
});

test("renders a cloud-only raw row through the actual app detail bridge", async () => {
  const rawRow = {
    id: "cloud-record-id",
    local_record_id: "local-record-id",
    created_at: "2026-07-12T08:00:00",
    raw_dream_text: "只在云端可见的长廊",
    dream_summary: "云端长廊",
    emotions: "好奇",
    symbols: "长廊",
    sleep_quality: "一般",
    analysis_type: "快速解析",
    report_content: { summary: "云端长廊" }
  };
  const bridge = createAppBridgeHarness();
  const elements = createDreamHomeElements();
  const controller = DreamHome.createDreamHomeController({
    app: bridge.app,
    document: createFakeDocument(),
    elements,
    fetchRecords: async () => [rawRow],
    now: () => new Date(2026, 6, 12, 8),
    quotes: testQuotes
  });

  await controller.handleSession({ client: {}, user: { id: "one", email: "one@example.com" } });
  elements.recent.children[0].trigger("click");

  assert.deepEqual(bridge.mappedRows, [rawRow]);
  assert.match(collectText(bridge.dreamDetailContent).join(" "), /只在云端可见的长廊/);
  assert.doesNotMatch(collectText(bridge.dreamDetailContent).join(" "), /没有找到这条梦境记录/);
});

test("initializes the browser controller on DOMContentLoaded and maps auth event detail", async () => {
  const elements = createDreamHomeElements();
  const selectors = [
    ["[data-public-home]", elements.publicHome],
    ["[data-dream-home]", elements.dreamHome],
    ["[data-dream-home-greeting]", elements.greeting],
    ["[data-dream-home-email]", elements.email],
    ["[data-dream-home-quote-text]", elements.quoteText],
    ["[data-dream-home-quote-author]", elements.quoteAuthor],
    ["[data-dream-home-stat='total']", elements.total],
    ["[data-dream-home-stat='important']", elements.important],
    ["[data-dream-home-stat='streak']", elements.streak],
    ["[data-dream-home-stat='ai-organized']", elements.aiOrganized],
    ["[data-dream-home-recent]", elements.recent],
    ["[data-dream-home-status]", elements.status],
    ["[data-dream-home-retry]", elements.retry],
    ["[data-dream-home-action='quick']", elements.quickAction],
    ["[data-dream-home-action='guided']", elements.guidedAction],
    ["[data-dream-home-action='diary']", elements.diaryAction]
  ];
  const selectorMap = new Map(selectors);
  const documentListeners = new Map();
  const queriedSelectors = [];
  const fakeDocument = {
    readyState: "loading",
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    },
    createElement() {
      return createFakeElement();
    },
    querySelector(selector) {
      queriedSelectors.push(selector);
      return selectorMap.get(selector) || null;
    }
  };
  const windowListeners = new Map();
  const app = createFakeApp();
  const fake = createFakeSupabase([{
    id: "browser-record",
    user_id: "browser-user",
    created_at: "2026-07-12T08:00:00",
    dream_summary: "浏览器初始化的梦"
  }]);
  const fakeWindow = {
    DreamAnatomyApp: app,
    DreamQuotes: testQuotes,
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    document: fakeDocument
  };
  fakeWindow.window = fakeWindow;
  fakeWindow.globalThis = fakeWindow;

  const source = fs.readFileSync(path.join(__dirname, "../src/dreamHome.js"), "utf8");
  vm.runInNewContext(source, { globalThis: fakeWindow, window: fakeWindow });

  assert.equal(typeof documentListeners.get("DOMContentLoaded"), "function");
  assert.equal(fakeWindow.DreamHome.controller, undefined);

  documentListeners.get("DOMContentLoaded")();

  assert.deepEqual(queriedSelectors, selectors.map(([selector]) => selector));
  assert.deepEqual(Object.keys(fakeWindow.DreamHome.controller).sort(), [
    "clear",
    "handleSession",
    "init",
    "retry"
  ]);
  assert.equal(typeof windowListeners.get("dream-anatomy-auth-session"), "function");
  assert.equal(elements.publicHome.hidden, false);
  assert.equal(elements.dreamHome.hidden, true);

  const eventUser = { id: "browser-user", email: "browser@example.com" };
  windowListeners.get("dream-anatomy-auth-session")({
    detail: {
      client: fake.client,
      get ignored() {
        throw new Error("unrelated event detail must not be mapped");
      },
      user: eventUser
    }
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(fake.state.eqCalls, [["user_id", "browser-user"]]);
  assert.equal(elements.email.textContent, "browser@example.com");
  assert.equal(elements.recent.children[0].textContent, "浏览器初始化的梦");

  windowListeners.get("dream-anatomy-auth-session")({ detail: null });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(elements.email.textContent, "");
  assert.equal(elements.publicHome.hidden, false);
  assert.equal(elements.dreamHome.hidden, true);
});

test("browser Dream Home reads the current auth session when the first auth event was missed", async () => {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const elements = createDreamHomeElements();
  const selectors = [
    ["[data-public-home]", elements.publicHome],
    ["[data-dream-home]", elements.dreamHome],
    ["[data-dream-home-greeting]", elements.greeting],
    ["[data-dream-home-email]", elements.email],
    ["[data-dream-home-quote-text]", elements.quoteText],
    ["[data-dream-home-quote-author]", elements.quoteAuthor],
    ["[data-dream-home-stat='total']", elements.total],
    ["[data-dream-home-stat='important']", elements.important],
    ["[data-dream-home-stat='streak']", elements.streak],
    ["[data-dream-home-stat='ai-organized']", elements.aiOrganized],
    ["[data-dream-home-recent]", elements.recent],
    ["[data-dream-home-status]", elements.status],
    ["[data-dream-home-retry]", elements.retry],
    ["[data-dream-home-action='quick']", elements.quickAction],
    ["[data-dream-home-action='guided']", elements.guidedAction],
    ["[data-dream-home-action='diary']", elements.diaryAction]
  ];
  const fakeDocument = {
    readyState: "loading",
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    },
    createElement: createFakeElement,
    querySelector(selector) {
      const match = selectors.find(([item]) => item === selector);
      return match ? match[1] : null;
    }
  };
  const app = createFakeApp();
  const fake = createFakeSupabase([{
    id: "restored-record",
    user_id: "restored-browser-user",
    created_at: "2026-07-12T08:00:00",
    dream_summary: "恢复后立即显示的梦"
  }]);
  fake.client.auth = {
    getSession: async () => ({
      data: {
        session: {
          user: { id: "restored-browser-user", email: "restored@example.com" }
        }
      }
    })
  };
  const fakeWindow = {
    DreamAnatomyApp: app,
    DreamAnatomyAuth: {
      getClient: () => fake.client
    },
    DreamQuotes: testQuotes,
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    document: fakeDocument
  };
  fakeWindow.window = fakeWindow;
  fakeWindow.globalThis = fakeWindow;

  const source = fs.readFileSync(path.join(__dirname, "../src/dreamHome.js"), "utf8");
  vm.runInNewContext(source, { globalThis: fakeWindow, window: fakeWindow });
  documentListeners.get("DOMContentLoaded")();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(typeof windowListeners.get("dream-anatomy-auth-session"), "function");
  assert.deepEqual(fake.state.eqCalls, [["user_id", "restored-browser-user"]]);
  assert.equal(elements.publicHome.hidden, true);
  assert.equal(elements.dreamHome.hidden, false);
  assert.equal(elements.email.textContent, "restored@example.com");
  assert.equal(elements.recent.children[0].textContent, "恢复后立即显示的梦");
  assert.deepEqual(app.calls, []);
});

test("integrates Dream Home markup, browser scripts, app bridge, and responsive layout", () => {
  const html = fs.readFileSync(path.join(__dirname, "../src/index.html"), "utf8");
  const appCode = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../src/style.css"), "utf8");

  assert.match(html, /data-public-home/);
  assert.match(html, /data-dream-home/);
  assert.match(html, /data-dream-home-recent/);
  assert.match(html, /class="dream-home-layout" data-dream-home hidden/);
  assert.match(html, /这里收藏着你曾经记住的梦。/);
  assert.match(html, /目前还没有标记为重要的梦。/);
  assert.match(html, /连续记录的夜晚/);
  assert.match(html, /<blockquote[^>]*>[\s\S]*data-dream-home-quote-text[\s\S]*<cite data-dream-home-quote-author>/);
  [
    "data-dream-home-greeting",
    "data-dream-home-email",
    "data-dream-home-status",
    "data-dream-home-retry"
  ].forEach((hook) => assert.match(html, new RegExp(hook)));
  assert.deepEqual(
    [...html.matchAll(/data-dream-home-stat="([^"]+)"/g)].map((match) => match[1]),
    ["total", "important", "streak", "ai-organized"]
  );
  assert.deepEqual(
    [...html.matchAll(/data-dream-home-action="([^"]+)"/g)].map((match) => match[1]),
    ["quick", "guided", "diary"]
  );
  assert.match(html, /data-feature-flag="deep-guidance"[\s\S]*正在开发中/);
  assert.ok(
    html.indexOf('class="dream-home-actions"') < html.indexOf('class="dream-home-recent"'),
    "quick actions must precede recent dreams in semantic mobile order"
  );
  const expansion = html.match(/<section class="dream-home-expansion"[\s\S]*?<\/section>/)[0];
  assert.equal((expansion.match(/<article>/g) || []).length, 2);
  assert.equal((expansion.match(/>Coming Soon</g) || []).length, 2);
  assert.match(expansion, /<h2>AI 洞察<\/h2>/);
  assert.match(expansion, /<h2>标签 \/ 分类<\/h2>/);
  assert.doesNotMatch(expansion, /<(?:a|button|input|select|textarea)\b|data-dream-home-action=/);
  const scripts = [
    "vendor/supabase.js",
    "runtime-env.js",
    "featureFlags.js",
    "dreamSync.js",
    "auth.js",
    "dreamQuotes.js",
    "dreamHome.js",
    "dreamJournal.js",
    "app.js"
  ];
  scripts.reduce((previousIndex, script) => {
    const currentIndex = html.indexOf(`src="${script}"`);
    assert.ok(currentIndex > previousIndex, `${script} must load in dependency order`);
    return currentIndex;
  }, -1);
  assert.match(
    appCode,
    /window\.DreamAnatomyApp\s*=\s*\{[\s\S]*openDreamDetail,[\s\S]*renderDreamJournal,[\s\S]*showView[\s\S]*\};/
  );
  assert.match(css, /\.feature-status-badge/);
  assert.match(css, /\.is-feature-disabled/);
  assert.match(css, /\.dream-home-layout\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
  assert.match(
    css,
    /\.dream-home-stats\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/
  );
  assert.match(
    css,
    /\.dream-home-main\s*\{[^}]*grid-template-areas:\s*"recent actions";[^}]*grid-template-columns:\s*minmax\(0, 1\.65fr\) minmax\(260px, 0\.75fr\);/
  );
  assert.match(css, /\.dream-home-recent\s*\{[^}]*grid-area:\s*recent;/);
  assert.match(css, /\.dream-home-actions\s*\{[^}]*grid-area:\s*actions;/);
  assert.match(
    css,
    /\.dream-home-expansion\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(css, /\.dream-home-email\s*\{[^}]*overflow-wrap:\s*anywhere;/);

  const tabletCss = css.match(/@media \(max-width: 820px\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(
    tabletCss,
    /\.dream-home-stats\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(
    tabletCss,
    /\.dream-home-main,\s*\.dream-home-expansion\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/
  );

  const mobileCss = css.match(/@media \(max-width: 560px\)\s*\{([\s\S]*)\n\}/)[1];
  assert.match(
    mobileCss,
    /\.dream-home-stats,\s*\.dream-home-main,\s*\.dream-home-expansion,\s*\.dream-home-action-list\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/
  );
  assert.match(
    mobileCss,
    /\.dream-home-email\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*text-align:\s*left;/
  );
});
