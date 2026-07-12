# Dream Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an extensible, personal Dream Home that authenticated users enter automatically and that displays a verified daily quote, cloud-record statistics, five recent dreams, quick actions, and quiet future-feature regions.

**Architecture:** Add independent UMD-style `dreamQuotes.js` and `dreamHome.js` browser modules with CommonJS exports for Node tests. Dream Home listens to the existing Auth session event, reads only the active user's Supabase rows, calculates display data locally, and uses a minimal `DreamAnatomyApp` interface to reuse current views and Dream Detail.

**Tech Stack:** Plain HTML, CSS, JavaScript, Node.js built-in test runner, Supabase JavaScript client, Express static hosting.

## Global Constraints

- The user-visible page name is `Dream Home`, never `Dashboard`.
- Logged-out users retain the existing public home and local dream workflows.
- Login and restored sessions automatically open Dream Home; logout returns to public home and clears all Dream Home memory and DOM data.
- Do not modify DeepSeek API, prompts, Auth business rules, dream sync rules, or database schema.
- Do not add search, favorites, timeline, deletion, trash, title editing, content editing, charts, payment, membership, new tables, or new fields.
- AI insights and tags/categories are non-interactive `Coming Soon` regions only.
- All user-derived values are inserted with `textContent`; no dream text, token, session, key, or full error is logged.
- Preserve the quiet, mysterious, gentle, premium, Chinese-first, mobile-friendly visual style.

---

## File Map

- Create `src/dreamQuotes.js`: verified quote data, local-date key, deterministic quote selector.
- Create `src/dreamHome.js`: pure display/stat helpers, current-user cloud query, session-aware Dream Home controller, DOM rendering.
- Modify `src/index.html`: wrap public home, add Dream Home regions, load the two modules.
- Modify `src/app.js`: expose existing view and detail functions without moving their logic.
- Modify `src/style.css`: extensible Dream Home layout and responsive states.
- Create `tests/dreamQuotes.test.js`: quote provenance and date stability.
- Create `tests/dreamHome.test.js`: statistics, isolation, stale-response, clearing, and navigation behavior.
- Modify `README.md`: document Dream Home and module ownership.
- Modify `docs/PROJECT_STATUS.md`: record the delivered feature and remaining `Coming Soon` boundaries.
- Do not modify `server.js`, `src/auth.js`, `src/dreamSync.js`, Supabase migrations, `AGENTS.md`, `docs/MVP_SPEC.md`, or `docs/ACCEPTANCE.md`.

### Task 1: Verified Daily Quote Module

**Files:**
- Create: `src/dreamQuotes.js`
- Create: `tests/dreamQuotes.test.js`

**Interfaces:**
- Produces: `DreamQuotes.quotes: Array<{text: string, author: string, source: string}>`
- Produces: `DreamQuotes.toLocalDateKey(date: Date): string`
- Produces: `DreamQuotes.getQuoteForDate(date: Date): Quote`

- [ ] **Step 1: Write failing quote tests**

Create tests that require `../src/dreamQuotes` and assert:

```js
test("contains a verified public-domain quote set", () => {
  assert.ok(DreamQuotes.quotes.length >= 8);
  assert.ok(DreamQuotes.quotes.length <= 12);
  DreamQuotes.quotes.forEach((quote) => {
    assert.equal(typeof quote.text, "string");
    assert.ok(quote.text.length > 0);
    assert.equal(typeof quote.author, "string");
    assert.ok(quote.author.length > 0);
    assert.match(quote.source, /^https:\/\//);
  });
});

test("keeps the daily quote stable for the same local date", () => {
  const morning = new Date(2026, 6, 12, 8, 0);
  const evening = new Date(2026, 6, 12, 23, 30);
  assert.deepEqual(
    DreamQuotes.getQuoteForDate(morning),
    DreamQuotes.getQuoteForDate(evening)
  );
});

test("uses a browser-local date key", () => {
  assert.equal(
    DreamQuotes.toLocalDateKey(new Date(2026, 6, 12, 23, 30)),
    "2026-07-12"
  );
});
```

- [ ] **Step 2: Run the quote tests and verify red**

Run: `node --test tests/dreamQuotes.test.js`

Expected: FAIL because `src/dreamQuotes.js` does not exist.

- [ ] **Step 3: Implement the UMD quote module**

Implement a UMD wrapper that exports exactly ten design-approved records. Store source-text URLs from Chinese Text Project or Wikisource. Implement date-key creation with local `getFullYear()`, `getMonth() + 1`, and `getDate()`. Select an index by hashing every character of the date key with a deterministic integer accumulator and applying modulo `quotes.length`.

The module shape must be:

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamQuotes = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const quotes = [
    {
      text: "致虚极，守静笃。",
      author: "老子",
      source: "https://ctext.org/dao-de-jing/16/zh"
    },
    {
      text: "知人者智，自知者明。",
      author: "老子",
      source: "https://ctext.org/dao-de-jing/33/zh"
    },
    {
      text: "且有大觉，而后知此其大梦也。",
      author: "庄子",
      source: "https://ctext.org/zhuangzi/adjustment-of-controversies/zh"
    },
    {
      text: "人生天地之间，若白驹之过隙，忽然而已。",
      author: "庄子",
      source: "https://ctext.org/zhuangzi/knowledge-rambling-in-the-north/zh"
    },
    {
      text: "逝者如斯夫，不舍昼夜。",
      author: "孔子",
      source: "https://ctext.org/analects/zi-han/zh"
    },
    {
      text: "此中有真意，欲辨已忘言。",
      author: "陶渊明",
      source: "https://zh.wikisource.org/wiki/飲酒_(陶淵明)"
    },
    {
      text: "行到水穷处，坐看云起时。",
      author: "王维",
      source: "https://zh.wikisource.org/wiki/終南別業"
    },
    {
      text: "浮生若梦，为欢几何？",
      author: "李白",
      source: "https://zh.wikisource.org/wiki/春夜宴從弟桃花園序"
    },
    {
      text: "回首向来萧瑟处，归去，也无风雨也无晴。",
      author: "苏轼",
      source: "https://zh.wikisource.org/wiki/定風波_(莫聽穿林打葉聲)"
    },
    {
      text: "江畔何人初见月，江月何年初照人？",
      author: "张若虚",
      source: "https://zh.wikisource.org/wiki/春江花月夜_(張若虛)"
    }
  ];

  function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getQuoteForDate(date = new Date()) {
    const dateKey = toLocalDateKey(date);
    const hash = Array.from(dateKey).reduce(
      (value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0,
      0
    );
    return quotes[hash % quotes.length];
  }

  return { getQuoteForDate, quotes, toLocalDateKey };
});
```

- [ ] **Step 4: Run quote tests and syntax check**

Run: `node --test tests/dreamQuotes.test.js && node --check src/dreamQuotes.js`

Expected: all quote tests PASS and syntax check exits 0.

- [ ] **Step 5: Commit the quote module**

```bash
git add src/dreamQuotes.js tests/dreamQuotes.test.js
git commit -m "Add verified daily dream quotes"
```

### Task 2: Dream Home Pure Data Helpers

**Files:**
- Create: `src/dreamHome.js`
- Create: `tests/dreamHome.test.js`

**Interfaces:**
- Consumes: `DreamQuotes.getQuoteForDate(date)` from Task 1
- Produces: `DreamHome.getGreeting(date: Date): string`
- Produces: `DreamHome.getDisplayTitle(record: object, maxLength?: number): string`
- Produces: `DreamHome.calculateDreamStreak(records: object[], now: Date): number`
- Produces: `DreamHome.calculateDreamStats(records: object[], now: Date): {total: number, important: number, streak: number, aiOrganized: number}`
- Produces: `DreamHome.getRecentDreams(records: object[], limit?: number): object[]`
- Produces: `DreamHome.fetchDreamRecords(client: SupabaseClient, user: {id: string}): Promise<object[]>`

- [ ] **Step 1: Write failing helper tests**

Cover exact boundaries and data rules:

```js
test("returns time-aware greetings", () => {
  assert.equal(DreamHome.getGreeting(new Date(2026, 6, 12, 8)), "早上好");
  assert.equal(DreamHome.getGreeting(new Date(2026, 6, 12, 14)), "下午好");
  assert.equal(DreamHome.getGreeting(new Date(2026, 6, 12, 21)), "晚上好");
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
    { created_at: "2026-07-11T09:00:00" },
    { created_at: "2026-07-10T09:00:00" }
  ];
  assert.equal(
    DreamHome.calculateDreamStreak(records, new Date(2026, 6, 12, 20)),
    2
  );
});

test("calculates all four statistics", () => {
  const records = [
    { created_at: "2026-07-12T09:00:00", analysis_type: "快速解析" },
    { created_at: "2026-07-11T09:00:00", analysis_type: "深度引导" },
    { created_at: "invalid", analysis_type: "其他" }
  ];
  assert.deepEqual(
    DreamHome.calculateDreamStats(records, new Date(2026, 6, 12, 20)),
    { total: 3, important: 0, streak: 2, aiOrganized: 2 }
  );
});
```

Also assert title fallback order (`title`, `dream_summary`, `raw_dream_text`, “未命名的梦”), whitespace collapse, truncation, recent sorting, and a limit of five.

- [ ] **Step 2: Run helper tests and verify red**

Run: `node --test tests/dreamHome.test.js`

Expected: FAIL because `src/dreamHome.js` does not exist.

- [ ] **Step 3: Implement pure helpers and current-user query**

Use browser-local calendar dates for streak calculation. Normalize either Supabase snake_case or app camelCase fields. Implement the query exactly as:

```js
async function fetchDreamRecords(client, user) {
  if (!client || !user || !user.id) {
    return [];
  }

  const response = await client
    .from("dream_records")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (response.error) {
    throw new Error("Dream Home records unavailable");
  }

  return Array.isArray(response.data) ? response.data : [];
}
```

Do not include upstream error content in the thrown message.

- [ ] **Step 4: Add query isolation tests**

Build a fake Supabase chain that records `.eq()` arguments and filters rows. Assert:

```js
assert.deepEqual(fake.state.eqCalls, [["user_id", "user-one"]]);
assert.deepEqual(
  (await DreamHome.fetchDreamRecords(fake.client, { id: "user-one" })).map((row) => row.user_id),
  ["user-one"]
);
assert.deepEqual(
  (await DreamHome.fetchDreamRecords(fake.client, { id: "user-two" })).map((row) => row.user_id),
  ["user-two"]
);
```

- [ ] **Step 5: Run helper and isolation tests**

Run: `node --test tests/dreamHome.test.js && node --check src/dreamHome.js`

Expected: all tests PASS and syntax check exits 0.

- [ ] **Step 6: Commit pure Dream Home data behavior**

```bash
git add src/dreamHome.js tests/dreamHome.test.js
git commit -m "Add Dream Home data calculations"
```

### Task 3: Session-Aware Dream Home Controller

**Files:**
- Modify: `src/dreamHome.js`
- Modify: `tests/dreamHome.test.js`

**Interfaces:**
- Consumes: `fetchDreamRecords(client, user)` and pure helpers from Task 2
- Consumes: `DreamQuotes.getQuoteForDate(date)` from Task 1
- Produces: `DreamHome.createDreamHomeController(options)` returning `{clear, handleSession, init, retry}`
- Consumes app interface: `{showView(viewName: string), openDreamDetail(recordId: string)}`

- [ ] **Step 1: Write failing controller tests**

Use lightweight fake DOM nodes with `hidden`, `textContent`, `dataset`, `append`, `replaceChildren`, and event listeners. Verify:

- a user session hides public home, shows Dream Home, shows loading copy, queries the active user, renders email/statistics/recent rows, and calls `app.showView("home")`
- null session clears rendered email, counts, and recent rows before showing public home
- no-session initialization makes zero Supabase calls
- a deferred response for user one cannot render after user two becomes active
- retry runs only for the current session
- quick/guided/diary actions call `showView()` with existing names
- recent record activation calls `showView("diary")` and then `openDreamDetail(recordId)`

The stale-response assertion must use two controllable promises and resolve user one after user two:

```js
const first = deferred();
const second = deferred();
const controller = DreamHome.createDreamHomeController({
  fetchRecords: (_client, user) => user.id === "one" ? first.promise : second.promise,
  elements,
  app,
  quotes: DreamQuotes,
  now: () => new Date(2026, 6, 12, 8)
});

const firstRun = controller.handleSession({ user: { id: "one", email: "one@example.com" }, client: {} });
const secondRun = controller.handleSession({ user: { id: "two", email: "two@example.com" }, client: {} });
second.resolve([{ id: "two-record", user_id: "two", created_at: "2026-07-12T08:00:00" }]);
await secondRun;
first.resolve([{ id: "one-record", user_id: "one", created_at: "2026-07-12T07:00:00" }]);
await firstRun;
assert.equal(elements.email.textContent, "two@example.com");
```

- [ ] **Step 2: Run controller tests and verify red**

Run: `node --test tests/dreamHome.test.js`

Expected: FAIL because `createDreamHomeController` and session rendering are not implemented.

- [ ] **Step 3: Implement controller state and safe rendering**

Maintain only:

```js
let activeUser = null;
let activeClient = null;
let records = [];
let requestGeneration = 0;
```

At the start of every `handleSession`, increment `requestGeneration`, call `clearRecordData()`, and set `activeUser`/`activeClient`. Capture both generation and user ID before awaiting. Render only when both still match after the query.

Create recent-dream elements with `document.createElement`, assign all dynamic content through `textContent`, and attach click listeners without `innerHTML`.

- [ ] **Step 4: Implement browser initialization**

On `DOMContentLoaded`, collect Dream Home data attributes, create the controller, subscribe to `dream-anatomy-auth-session`, wire retry/action buttons, and retain the controller at `DreamHome.controller` for diagnostics without exposing session data.

The listener must pass only:

```js
controller.handleSession({
  user: event.detail && event.detail.user ? event.detail.user : null,
  client: event.detail ? event.detail.client : null
});
```

- [ ] **Step 5: Run controller tests and syntax check**

Run: `node --test tests/dreamHome.test.js && node --check src/dreamHome.js`

Expected: all tests PASS and syntax check exits 0.

- [ ] **Step 6: Commit session-safe controller behavior**

```bash
git add src/dreamHome.js tests/dreamHome.test.js
git commit -m "Add session-safe Dream Home controller"
```

### Task 4: Page Integration and Extensible Responsive Layout

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.js`
- Modify: `src/style.css`
- Modify: `tests/dreamHome.test.js`

**Interfaces:**
- Consumes: `DreamHome` and `DreamQuotes` browser globals
- Produces: `window.DreamAnatomyApp = {showView, openDreamDetail}`
- Adds DOM hooks under `[data-dream-home]` for controller rendering

- [ ] **Step 1: Write failing static integration assertions**

Add tests that read `src/index.html`, `src/app.js`, and `src/style.css` and assert:

```js
assert.match(html, /data-public-home/);
assert.match(html, /data-dream-home/);
assert.match(html, /data-dream-home-recent/);
assert.match(html, /AI 洞察/);
assert.match(html, /标签 \/ 分类/);
assert.ok(html.indexOf("dreamQuotes.js") < html.indexOf("dreamHome.js"));
assert.match(appCode, /window\.DreamAnatomyApp/);
assert.match(css, /\.dream-home-layout/);
```

- [ ] **Step 2: Run integration assertions and verify red**

Run: `node --test tests/dreamHome.test.js`

Expected: FAIL because Dream Home markup, scripts, public app interface, and styles are absent.

- [ ] **Step 3: Add semantic Dream Home markup**

Keep the current `data-view="home"` panel. Wrap existing hero and entries in `[data-public-home]`. Add a sibling `[data-dream-home]` that is hidden by default and contains:

- welcome header with data hooks for greeting and email
- `<blockquote>` quote with text and author hooks
- four stable statistic cards
- recent list, loading/empty/error states, and retry button
- three buttons using Dream Home action hooks for quick/guided/diary
- non-interactive AI insight and tag/category `Coming Soon` regions

Load scripts in this order:

```html
<script src="vendor/supabase.js"></script>
<script src="runtime-env.js"></script>
<script src="dreamSync.js"></script>
<script src="auth.js"></script>
<script src="dreamQuotes.js"></script>
<script src="dreamHome.js"></script>
<script src="app.js"></script>
```

- [ ] **Step 4: Expose the minimal app interface**

After `openDreamDetail` is defined and before final initialization, add:

```js
window.DreamAnatomyApp = {
  openDreamDetail,
  showView
};
```

Do not alter either function's existing internal behavior.

- [ ] **Step 5: Add extensible Dream Home styles**

Create stable full-width sections and grids:

- `.dream-home-layout`: vertical section rhythm
- `.dream-home-welcome`: responsive welcome layout
- `.dream-home-quote`: unframed quote band
- `.dream-home-stats`: `repeat(4, minmax(0, 1fr))`
- `.dream-home-main`: `minmax(0, 1.65fr) minmax(260px, 0.75fr)`
- `.dream-home-recent-list`: stable row gaps
- `.dream-home-expansion`: two-column future region

Use existing variables, 8px maximum radius, no decorative orbs, no new gradient, and no viewport-width font scaling. At 820px collapse main/expansion to one column and stats to two columns; at 560px make all sections one column and ensure long emails wrap or truncate without overlap.

- [ ] **Step 6: Run integration tests and all JavaScript syntax checks**

Run:

```bash
node --test tests/dreamHome.test.js
node --check src/app.js
node --check src/dreamHome.js
node --check src/dreamQuotes.js
```

Expected: all tests PASS and every syntax command exits 0.

- [ ] **Step 7: Commit page integration**

```bash
git add src/index.html src/app.js src/style.css tests/dreamHome.test.js
git commit -m "Integrate the Dream Home interface"
```

### Task 5: Documentation, Review, and Full Acceptance

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Documents final behavior and remaining boundaries; produces no runtime API.

- [ ] **Step 1: Update project documentation**

Document:

- authenticated users automatically enter Dream Home
- Dream Home loads current-user Supabase records for quote-independent statistics and recent dreams
- quote selection is local and date-stable
- important dreams remain `0` because no favorite field exists
- AI insights and tags/categories are visual `Coming Soon` regions only
- `dreamHome.js` and `dreamQuotes.js` ownership
- search, favorites, timeline, trash, editing, and analytics remain unimplemented

- [ ] **Step 2: Run focused tests**

Run:

```bash
node --test tests/dreamQuotes.test.js tests/dreamHome.test.js
```

Expected: all Dream Home and quote tests PASS.

- [ ] **Step 3: Run the complete regression suite**

Run: `npm test`

Expected: Auth diagnostics, dream sync, Dream Home, and quote tests all PASS with zero failures.

- [ ] **Step 4: Run syntax and static-server smoke checks**

Run:

```bash
node --check server.js
node --check src/app.js
node --check src/auth.js
node --check src/dreamSync.js
node --check src/dreamHome.js
node --check src/dreamQuotes.js
npm start
```

Expected: every syntax check exits 0; server prints `Dream Anatomy server listening on http://localhost:3000`; GET `/`, `/dreamHome.js`, and `/dreamQuotes.js` return 200 and non-empty JavaScript assets.

- [ ] **Step 5: Perform browser acceptance at desktop and mobile widths**

With configured Supabase credentials, verify:

1. logged out: public home is visible and Dream Home is hidden
2. login: Dream Home appears automatically with email, quote, four stats, recent records, and quick actions
3. refresh: restored session returns to Dream Home and the quote is unchanged on the same date
4. recent record: opens the existing Dream Detail
5. quick actions: open quick, guided, and diary views
6. logout: Dream Home data disappears immediately and public home returns
7. account switch: no first-account record appears for the second account
8. mobile: no overlap, clipped text, horizontal overflow, or unreadably dense cards

- [ ] **Step 6: Run scope and safety scans**

Run:

```bash
git diff --check main...HEAD
git diff --name-only main...HEAD
git diff -- server.js src/auth.js src/dreamSync.js supabase/migrations AGENTS.md docs/MVP_SPEC.md docs/ACCEPTANCE.md
rg -n "Dashboard|算命|吉凶预测|未来预测|心理诊断|心理治疗" src README.md docs/PROJECT_STATUS.md
```

Expected: no whitespace errors; protected runtime/schema files have no diff; user-visible `Dashboard` is absent; no new prohibited positioning language is introduced.

- [ ] **Step 7: Request independent code review and resolve findings**

Dispatch a specification reviewer to compare the branch against the design and acceptance list, then a code-quality reviewer to inspect isolation, stale async work, XSS safety, date calculations, accessibility, and mobile layout. Fix any confirmed finding with a failing test first and rerun the full suite.

- [ ] **Step 8: Commit documentation and final adjustments**

```bash
git add README.md docs/PROJECT_STATUS.md
git commit -m "Build Dream Home experience"
```

- [ ] **Step 9: Final verification before publishing**

Run `npm test`, all syntax checks, server smoke checks, `git diff --check main...HEAD`, and `git status --short --branch` again. Record exact pass counts and any live-service checks that could not be performed.

- [ ] **Step 10: Publish the requested branch and PR**

Ensure the branch is `codex/dream-home` and contains the Task 5 commit whose message is exactly `Build Dream Home experience`; do not rewrite or squash existing history without approval. Push the branch and create a ready PR titled `Build Dream Home` with scope, test evidence, external manual-test limits, and explicit statements that DeepSeek, Auth rules, dream sync, and schema were unchanged.
