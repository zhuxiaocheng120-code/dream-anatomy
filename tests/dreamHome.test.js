const assert = require("node:assert/strict");
const test = require("node:test");

const DreamHome = require("../src/dreamHome");

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
