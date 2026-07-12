# Dream Home Design

## Goal

Build a personal Dream Home for authenticated users without changing DeepSeek, Auth business rules, dream sync rules, or the database schema. Logged-out users continue to see the existing public home. Login and restored sessions automatically open Dream Home; logout immediately clears its in-memory data and returns to the public home.

The user-visible name is always **Dream Home**, never Dashboard.

## Scope

Dream Home includes:

- a time-aware greeting, current account email, page name, and the line “这里收藏着你曾经记住的梦。”
- a deterministic daily quote
- four dream statistics
- the current user's five most recent cloud records
- quick links to quick decode, guided analysis, and the existing dream journal
- non-interactive, extensible placeholders for AI insights and tags/categories

This change does not add search, favorites, important-dream editing, timeline, deletion, trash, title editing, content editing, charts, paid features, new tables, or new fields.

## Architecture

### `src/dreamHome.js`

Owns Dream Home state and behavior:

- subscribes to the existing `dream-anatomy-auth-session` event
- clears prior state synchronously whenever the session changes
- queries `dream_records` with an explicit `.eq("user_id", user.id)` filter
- calculates statistics and recent records from the current query result
- renders all user-derived values with `textContent`
- opens the existing app views and Dream Detail through a minimal public app interface
- discards stale responses when an account changes or logs out during a request
- exposes pure helpers through a UMD-style export for Node unit tests

The module performs read-only queries. It does not migrate, save, update, or delete dream records.

### `src/dreamQuotes.js`

Owns a fixed collection of ten verified public-domain quotations and a pure local-date selection function. It stores `text`, `author`, and `source` for each quote. The selector hashes the browser-local `YYYY-MM-DD` date, so refreshes on the same day return the same quote and a later date can select another quote.

### `src/app.js`

Keeps all existing analysis, journal, synchronization, and detail behavior. It only exposes the existing `showView()` and `openDreamDetail()` functions through `window.DreamAnatomyApp`, allowing Dream Home to reuse those flows instead of creating a second router or detail page.

### Existing modules

`src/auth.js` continues to own registration, login, verification, password recovery, persistent sessions, and logout. `src/dreamSync.js` remains unchanged and continues to own local/cloud synchronization. Dream Home uses the same Supabase client supplied by the Auth session event but does not depend on dreamSync internal state.

## Data Flow

1. Auth emits `{ user, client }` through `dream-anatomy-auth-session`.
2. Dream Home increments a request generation, clears prior data, and checks for a user.
3. With no user, Dream Home hides itself, shows the public home, and makes no Supabase request.
4. With a user, Dream Home displays its loading state, switches the current home experience to Dream Home, and queries only that user's records.
5. The module renders results only if the request generation and user ID still match the active session.
6. Query failure clears record-derived content and shows a retry action. It never falls back to another user's local or cloud cache.

RLS remains the server-side isolation boundary; the explicit user filter is an additional client-side constraint.

## Layout

The Dream Home is a full-width home view with constrained content and stable sections rather than a corporate dashboard shell.

1. Welcome band: greeting, `Dream Home`, account email, and introduction.
2. Daily quote band: quotation text followed by an em-style attribution line in visible typography.
3. Statistics grid: four compact cards.
4. Main content grid: recent dreams as the primary column, quick actions as the secondary column.
5. Expansion band: two non-interactive regions for “AI 洞察” and “标签 / 分类”. Both are marked “Coming Soon” and contain no simulated data or controls.

Desktop uses an asymmetric content grid so recent records remain primary. Mobile stacks welcome, quote, statistics, quick actions, recent dreams, and expansion regions. Cards use the existing restrained 8px radius, spacing, typography, and palette.

## Content Rules

### Greeting

- 05:00–11:59: “早上好”
- 12:00–17:59: “下午好”
- all other hours: “晚上好”

### Daily Quotes

The initial collection uses exact short passages from public-domain Chinese classics. Source links are retained in code as provenance; only text and author are displayed.

1. “致虚极，守静笃。” — 老子，《道德经》第十六章
2. “知人者智，自知者明。” — 老子，《道德经》第三十三章
3. “且有大觉，而后知此其大梦也。” — 庄子，《齐物论》
4. “人生天地之间，若白驹之过隙，忽然而已。” — 庄子，《知北游》
5. “逝者如斯夫，不舍昼夜。” — 孔子，《论语·子罕》
6. “此中有真意，欲辨已忘言。” — 陶渊明，《饮酒·其五》
7. “行到水穷处，坐看云起时。” — 王维，《终南别业》
8. “浮生若梦，为欢几何？” — 李白，《春夜宴从弟桃花园序》
9. “回首向来萧瑟处，归去，也无风雨也无晴。” — 苏轼，《定风波》
10. “江畔何人初见月，江月何年初照人？” — 张若虚，《春江花月夜》

The passages were checked against Chinese Text Project or Wikisource source-text pages. No anonymous internet sayings or modern translations are included.

### Display Titles

Recent-dream titles are generated for display only:

1. use a non-empty existing `title` value if a future row supplies one
2. otherwise use `dreamSummary`
3. otherwise use `rawDreamText`
4. collapse whitespace, trim, and truncate to a compact display length
5. fall back to “未命名的梦”

Generated titles are never written to Supabase or localStorage.

## Statistics

- **梦境总数:** number of records returned for the current authenticated user
- **重要梦境:** `0`, with supporting text explaining that no dreams have been marked yet; no nonexistent field is queried
- **Dream Streak:** unique browser-local record dates counted backward from today, or from yesterday when today has no record; duplicate records on one date count once; the first missing date ends the streak; displayed as `N Night` or `N Nights`
- **AI 整理次数:** records whose analysis type is “快速解析” or “深度引导”

Invalid dates do not contribute to the streak. Records still contribute to total count unless Supabase excludes them.

Recent records are sorted by `created_at` descending and limited to five after loading the current user's complete record set, preserving correct total and streak calculations.

## Interactions

- Login and restored sessions automatically show Dream Home.
- Clicking the brand or any “home” action shows Dream Home while authenticated and the public home while logged out.
- Quick actions reuse the existing `quick`, `guided`, and `diary` views.
- Clicking a recent record opens the existing diary view and calls the existing Dream Detail renderer with the record's local display ID.
- Logout immediately clears all Dream Home user data and returns to the public home.
- A failed cloud query displays “暂时无法整理云端梦境，请稍后重试。” and a retry button.

## Empty, Loading, and Failure States

- Loading: “正在整理你的梦境档案……”
- Empty: a quiet explanation that the first saved dream will appear here
- Failure: no previous records remain visible; a safe message and retry button are shown
- No session: Dream Home is hidden and no cloud data is retained in module state or DOM

Errors, sessions, tokens, keys, and dream text are not logged.

## Testing

### Unit tests

`tests/dreamQuotes.test.js` verifies:

- 8–12 complete quote records
- exact same-date selection
- deterministic date-key behavior
- source metadata is present

`tests/dreamHome.test.js` verifies:

- time-aware greetings
- display-title fallback and truncation
- all four statistics
- streak de-duplication, today/yesterday start, interruption, and invalid dates
- five-record recency limit
- Supabase query explicitly filters by the active user ID
- two users receive isolated result sets
- logout and account switching clear state
- stale requests cannot overwrite a new session
- quick actions and existing detail navigation are invoked
- missing session performs no query

### Regression and runtime checks

- `npm test`
- `node --check src/dreamHome.js`
- `node --check src/dreamQuotes.js`
- `node --check src/app.js`
- `node --check src/auth.js`
- `node --check src/dreamSync.js`
- start the Express app and verify `/`, `/dreamHome.js`, and `/dreamQuotes.js` are served
- inspect desktop and mobile layouts in a real browser when browser tooling is available

Actual Supabase email flows, two-account RLS behavior, and Render deployment require configured external services. Automated fake-client tests provide deterministic evidence for client-side filtering and isolation; the PR will include explicit manual verification steps for the live environment without claiming unperformed external tests.

## Files

Expected additions:

- `src/dreamHome.js`
- `src/dreamQuotes.js`
- `tests/dreamHome.test.js`
- `tests/dreamQuotes.test.js`
- this design document and a later implementation plan

Expected focused updates:

- `src/index.html`
- `src/style.css`
- `src/app.js`
- `README.md`
- `docs/PROJECT_STATUS.md`

No changes are planned for `server.js`, `src/auth.js`, `src/dreamSync.js`, Supabase migrations, DeepSeek prompts, `AGENTS.md`, `docs/MVP_SPEC.md`, or `docs/ACCEPTANCE.md`.
