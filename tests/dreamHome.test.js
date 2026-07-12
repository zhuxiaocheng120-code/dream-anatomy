const assert = require("node:assert/strict");
const test = require("node:test");

const DreamHome = require("../src/dreamHome");

function createFakeElement() {
  const listeners = new Map();

  return {
    children: [],
    dataset: {},
    hidden: false,
    textContent: "",
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    trigger(type) {
      const listener = listeners.get(type);
      if (listener) {
        listener();
      }
    }
  };
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
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function createFakeApp() {
  const calls = [];

  return {
    calls,
    openDreamDetail(recordId) {
      calls.push(["openDreamDetail", recordId]);
    },
    showView(viewName) {
      calls.push(["showView", viewName]);
    }
  };
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
    user: { id: "user-one", email: "one@example.com" }
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
      dream_summary: "雨中的车站",
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

  assert.equal(elements.email.textContent, "one@example.com");
  assert.equal(elements.greeting.textContent, "早上好");
  assert.equal(elements.quoteText.textContent, "静听梦的回声。");
  assert.equal(elements.quoteAuthor.textContent, "测试");
  assert.equal(elements.total.textContent, "2");
  assert.equal(elements.important.textContent, "0");
  assert.equal(elements.streak.textContent, "2");
  assert.equal(elements.aiOrganized.textContent, "2");
  assert.equal(elements.recent.children.length, 2);
  assert.equal(elements.recent.children[0].textContent, "雨中的车站");
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
    ["openDreamDetail", "record-one"]
  ]);
});
