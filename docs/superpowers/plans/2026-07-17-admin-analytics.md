# Admin Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist privacy-preserving AI usage statistics to Supabase and add a read-only admin operations dashboard in the existing SPA.

**Architecture:** Add a server-only analytics path with service role Supabase access, HMAC principal hashing, usage event persistence, and admin-only aggregate endpoints. Add an SPA `admin` view that consumes only redacted admin API responses after server-side authorization.

**Tech Stack:** Node.js, Express, Supabase JavaScript SDK, browser plain JavaScript modules, Node built-in test runner, Supabase SQL migrations.

## Global Constraints

- Do not add `/admin.html`, React, Vue, a routing framework, payment, mini-program pages, write-capable admin tools, or Dream Result Card prompt changes.
- Do not reopen deep guidance; `guided_questions` and `guided_final` remain feature-disabled.
- Do not store raw IP, email, full Supabase user UUID, access token, refresh token, Authorization header, dream text, or full AI response in analytics.
- Store only HMAC-SHA256 `principal_hash` using `ANALYTICS_HASH_SECRET` with `user:` and `guest:` prefixes.
- Do not display full `principal_hash` in the browser or join `ai_usage_events` with `auth.users` or `dream_records`.
- `ai_usage_events` keeps historical data long-term for necessary operations analysis and service improvement; this PR does not add TTL, scheduled deletion, or automatic cleanup.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must not enter `src/`, `runtime-env.js`, logs, README examples with real values, or browser responses.
- Analytics write failures must not affect normal AI analysis responses.
- All admin UI text is Simplified Chinese except existing brand names.

---

## File Structure

- Create `supabase/migrations/20260717000000_create_ai_usage_events.sql`: analytics table, indexes, RLS, revokes.
- Create `server/adminSupabase.js`: server-only service role client factory and availability checks.
- Create `server/adminAuth.js`: bearer token validation and `ADMIN_USER_IDS` authorization.
- Create `server/aiAnalytics.js`: HMAC hash, cost calculation, event row building, safe insert.
- Create `server/adminAnalytics.js`: summary/recent aggregation and safe DTO formatting.
- Modify `server/aiErrors.js`: add `ANALYTICS_UNAVAILABLE` stable error.
- Modify `server.js`: route admin APIs, wire analytics recording into AI handler, expose test injection via `app.locals`.
- Create `src/adminAnalytics.js`: browser controller for admin permission probing, fetching, rendering, and clearing state.
- Modify `src/index.html`: admin nav entry and `data-view="admin"` panel.
- Modify `src/app.js`: allow `admin` view and expose needed app functions if necessary.
- Modify `src/style.css`: admin dashboard layout, responsive cards, trend bars, disabled/empty states.
- Modify `.env.example`: add admin analytics environment variables with blank or safe example values.
- Create `docs/ADMIN_ANALYTICS_SETUP.md`: deployment, migration, secrets, retention, manual verification.
- Modify `README.md` and `docs/PROJECT_STATUS.md`: concise feature/setup/status notes.
- Create tests:
  - `tests/aiAnalytics.test.js`
  - `tests/adminAuth.test.js`
  - `tests/adminAnalytics.test.js`
  - `tests/adminAnalyticsFrontend.test.js`
- Update tests:
  - `tests/server.test.js`
  - `tests/supabaseSecurity.test.js`

---

### Task 1: Supabase Analytics Migration And Secret Boundary Tests

**Files:**
- Create: `supabase/migrations/20260717000000_create_ai_usage_events.sql`
- Modify: `tests/supabaseSecurity.test.js`
- Modify: `.env.example`

**Interfaces:**
- Produces SQL table `public.ai_usage_events` with no anon/authenticated policies.
- Produces env var names used by later tasks: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS`, `ANALYTICS_HASH_SECRET`, `AI_INPUT_COST_PER_1M_TOKENS`, `AI_OUTPUT_COST_PER_1M_TOKENS`.

- [ ] **Step 1: Write failing migration/security tests**

Add assertions to `tests/supabaseSecurity.test.js`:

```js
test("ai_usage_events migration creates protected analytics table", () => {
  const migration = readProjectFile("supabase/migrations/20260717000000_create_ai_usage_events.sql");

  assert.match(migration, /create table if not exists public\.ai_usage_events/);
  assert.match(migration, /request_id uuid not null unique/);
  assert.match(migration, /principal_hash text not null/);
  assert.match(migration, /alter table public\.ai_usage_events enable row level security/);
  assert.match(migration, /alter table public\.ai_usage_events force row level security/);
  assert.match(migration, /revoke all on public\.ai_usage_events from anon/);
  assert.match(migration, /revoke all on public\.ai_usage_events from authenticated/);
  assert.doesNotMatch(migration, /create policy[\s\S]+ai_usage_events/i);
});

test("service role and analytics secrets stay out of browser runtime config", () => {
  const runtimeWriter = readProjectFile("scripts/writeRuntimeEnv.js");
  const envExample = readProjectFile(".env.example");

  assert.doesNotMatch(runtimeWriter, /SUPABASE_SERVICE_ROLE_KEY|ADMIN_USER_IDS|ANALYTICS_HASH_SECRET/);
  assert.match(envExample, /^SUPABASE_SERVICE_ROLE_KEY=$/m);
  assert.match(envExample, /^ADMIN_USER_IDS=$/m);
  assert.match(envExample, /^ANALYTICS_HASH_SECRET=$/m);
});
```

- [ ] **Step 2: Run focused test to verify failure**

Run: `npm test -- tests/supabaseSecurity.test.js`

Expected: FAIL because the migration and env vars do not exist yet.

- [ ] **Step 3: Add migration**

Create `supabase/migrations/20260717000000_create_ai_usage_events.sql`:

```sql
create extension if not exists pgcrypto;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  occurred_at timestamptz not null default now(),
  principal_type text not null,
  principal_hash text not null,
  analysis_type text not null,
  outcome text not null,
  error_code text,
  http_status integer,
  duration_ms integer,
  quality_retry_count integer not null default 0,
  prompt_version text,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric,
  created_at timestamptz not null default now(),
  constraint ai_usage_events_principal_type_check
    check (principal_type in ('guest', 'authenticated')),
  constraint ai_usage_events_outcome_check
    check (outcome in ('success', 'upstream_error', 'timeout', 'generation_incomplete')),
  constraint ai_usage_events_duration_check
    check (duration_ms is null or duration_ms >= 0),
  constraint ai_usage_events_quality_retry_check
    check (quality_retry_count >= 0),
  constraint ai_usage_events_prompt_tokens_check
    check (prompt_tokens is null or prompt_tokens >= 0),
  constraint ai_usage_events_completion_tokens_check
    check (completion_tokens is null or completion_tokens >= 0),
  constraint ai_usage_events_total_tokens_check
    check (total_tokens is null or total_tokens >= 0),
  constraint ai_usage_events_cost_check
    check (estimated_cost_usd is null or estimated_cost_usd >= 0)
);

create index if not exists ai_usage_events_occurred_at_idx
  on public.ai_usage_events (occurred_at desc);

create index if not exists ai_usage_events_analysis_type_idx
  on public.ai_usage_events (analysis_type);

create index if not exists ai_usage_events_outcome_idx
  on public.ai_usage_events (outcome);

create index if not exists ai_usage_events_principal_type_idx
  on public.ai_usage_events (principal_type);

alter table public.ai_usage_events enable row level security;
alter table public.ai_usage_events force row level security;

revoke all on public.ai_usage_events from anon;
revoke all on public.ai_usage_events from authenticated;
```

- [ ] **Step 4: Add env variables**

Append to `.env.example`:

```text
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_USER_IDS=
ANALYTICS_HASH_SECRET=
AI_INPUT_COST_PER_1M_TOKENS=
AI_OUTPUT_COST_PER_1M_TOKENS=
```

- [ ] **Step 5: Run focused test to verify pass**

Run: `npm test -- tests/supabaseSecurity.test.js`

Expected: PASS.

- [ ] **Step 6: Review**

Ask reviewer to check that SQL creates no browser-accessible policies and that service role env vars are not exposed through `scripts/writeRuntimeEnv.js`.

---

### Task 2: Server-Only Admin Supabase And Admin Auth

**Files:**
- Create: `server/adminSupabase.js`
- Create: `server/adminAuth.js`
- Create: `tests/adminAuth.test.js`
- Modify: `server/aiErrors.js`

**Interfaces:**
- Produces `createAdminSupabaseClient({ createClient, env })`.
- Produces `isAnalyticsConfigured(env)`.
- Produces `parseAdminUserIds(value)`.
- Produces `createAdminAuth({ aiAuthResolver, env })` with `requireAdminIdentity(request)`.
- Produces stable error code `ANALYTICS_UNAVAILABLE`.

- [ ] **Step 1: Write failing admin auth tests**

Create `tests/adminAuth.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { parseAdminUserIds, createAdminAuth } = require("../server/adminAuth");
const { createAdminSupabaseClient, isAnalyticsConfigured } = require("../server/adminSupabase");

test("parseAdminUserIds trims comma separated ids", () => {
  assert.deepEqual(parseAdminUserIds(" user-a, user-b ,, "), ["user-a", "user-b"]);
});

test("missing ADMIN_USER_IDS rejects all authenticated users", async () => {
  const adminAuth = createAdminAuth({
    env: { ADMIN_USER_IDS: "" },
    aiAuthResolver: {
      resolveIdentity: async () => ({ type: "authenticated", userId: "user-a", rateLimitKey: "user:user-a" })
    }
  });

  await assert.rejects(() => adminAuth.requireAdminIdentity({ headers: { authorization: "Bearer token" } }), {
    code: "AUTH_FORBIDDEN",
    status: 403
  });
});

test("admin user id is accepted only after bearer auth verification", async () => {
  const adminAuth = createAdminAuth({
    env: { ADMIN_USER_IDS: "user-a" },
    aiAuthResolver: {
      resolveIdentity: async () => ({ type: "authenticated", userId: "user-a", rateLimitKey: "user:user-a" })
    }
  });

  const identity = await adminAuth.requireAdminIdentity({ headers: { authorization: "Bearer token" } });
  assert.equal(identity.userId, "user-a");
});

test("guest admin request returns AUTH_INVALID", async () => {
  const adminAuth = createAdminAuth({
    env: { ADMIN_USER_IDS: "user-a" },
    aiAuthResolver: {
      resolveIdentity: async () => ({ type: "guest", userId: "", rateLimitKey: "guest:203.0.113.24" })
    }
  });

  await assert.rejects(() => adminAuth.requireAdminIdentity({ headers: {} }), {
    code: "AUTH_INVALID",
    status: 401
  });
});

test("service role client uses server-only auth settings", () => {
  const calls = [];
  const client = createAdminSupabaseClient({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test"
    },
    createClient(url, key, options) {
      calls.push({ url, key, options });
      return { from: () => ({}) };
    }
  });

  assert.ok(client);
  assert.deepEqual(calls[0].options.auth, {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  });
});

test("analytics config requires url and service role key", () => {
  assert.equal(isAnalyticsConfigured({ SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "y" }), true);
  assert.equal(isAnalyticsConfigured({ SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "" }), false);
});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm test -- tests/adminAuth.test.js`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement `server/adminSupabase.js`**

Implement:

```js
const { createClient: defaultCreateClient } = require("@supabase/supabase-js");

function isAnalyticsConfigured(env = process.env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function createAdminSupabaseClient({ createClient = defaultCreateClient, env = process.env } = {}) {
  if (!isAnalyticsConfigured(env)) {
    return null;
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

module.exports = {
  createAdminSupabaseClient,
  isAnalyticsConfigured
};
```

- [ ] **Step 4: Implement `server/adminAuth.js`**

Implement:

```js
const { createApiError } = require("./aiErrors");

function parseAdminUserIds(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createAdminAuth({ aiAuthResolver, env = process.env } = {}) {
  if (!aiAuthResolver || typeof aiAuthResolver.resolveIdentity !== "function") {
    throw new Error("Admin auth requires aiAuthResolver.");
  }

  async function requireAdminIdentity(request) {
    const identity = await aiAuthResolver.resolveIdentity(request);

    if (!identity || identity.type !== "authenticated" || !identity.userId) {
      throw createApiError("AUTH_INVALID", "请先登录后再访问运营后台。", 401);
    }

    const adminUserIds = parseAdminUserIds(env.ADMIN_USER_IDS);
    if (!adminUserIds.includes(identity.userId)) {
      throw createApiError("AUTH_FORBIDDEN", "你没有访问运营后台的权限。", 403);
    }

    return identity;
  }

  return { requireAdminIdentity };
}

module.exports = {
  createAdminAuth,
  parseAdminUserIds
};
```

- [ ] **Step 5: Add stable error messages**

Add `AUTH_FORBIDDEN` and `ANALYTICS_UNAVAILABLE` to `server/aiErrors.js`:

```js
AUTH_FORBIDDEN: "你没有访问这个页面的权限。",
ANALYTICS_UNAVAILABLE: "运营统计暂时不可用，请检查服务端配置。"
```

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/adminAuth.test.js`

Expected: PASS.

- [ ] **Step 7: Review**

Ask reviewer to verify no service role env variable is imported from `src/`, no admin UUIDs are sent to clients, and missing `ADMIN_USER_IDS` rejects everyone.

---

### Task 3: AI Analytics Event Builder And Safe Recorder

**Files:**
- Create: `server/aiAnalytics.js`
- Create: `tests/aiAnalytics.test.js`

**Interfaces:**
- Produces `createPrincipalHash(identity, request, secret)`.
- Produces `calculateEstimatedCost(usage, env)`.
- Produces `buildUsageEvent(context)`.
- Produces `recordUsageEventSafely(client, event, logger)`.

- [ ] **Step 1: Write failing AI analytics tests**

Create `tests/aiAnalytics.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildUsageEvent,
  calculateEstimatedCost,
  createPrincipalHash,
  recordUsageEventSafely
} = require("../server/aiAnalytics");

test("principal hash uses HMAC secret and type prefixes", () => {
  const request = { ip: "203.0.113.24" };
  const userHash = createPrincipalHash({ type: "authenticated", userId: "user-uuid" }, request, "secret");
  const guestHash = createPrincipalHash({ type: "guest", userId: "", rateLimitKey: "guest:203.0.113.24" }, request, "secret");

  assert.match(userHash, /^[a-f0-9]{64}$/);
  assert.match(guestHash, /^[a-f0-9]{64}$/);
  assert.notEqual(userHash, guestHash);
  assert.equal(createPrincipalHash({ type: "authenticated", userId: "user-uuid" }, request, "secret"), userHash);
});

test("missing analytics secret returns null hash", () => {
  assert.equal(createPrincipalHash({ type: "guest" }, { ip: "203.0.113.24" }, ""), null);
});

test("cost is null unless token usage and prices are configured", () => {
  assert.equal(calculateEstimatedCost({ prompt_tokens: 1000, completion_tokens: 2000 }, {}), null);
  assert.equal(calculateEstimatedCost({}, { AI_INPUT_COST_PER_1M_TOKENS: "1", AI_OUTPUT_COST_PER_1M_TOKENS: "2" }), null);
  assert.equal(
    calculateEstimatedCost(
      { prompt_tokens: 1000, completion_tokens: 2000 },
      { AI_INPUT_COST_PER_1M_TOKENS: "1", AI_OUTPUT_COST_PER_1M_TOKENS: "2" }
    ),
    0.005
  );
});

test("buildUsageEvent excludes private content and keeps null token values", () => {
  const event = buildUsageEvent({
    requestId: "00000000-0000-4000-8000-000000000001",
    occurredAt: new Date("2026-07-17T00:00:00.000Z"),
    identity: { type: "authenticated", userId: "private-user-id", rateLimitKey: "user:private-user-id" },
    principalHash: "a".repeat(64),
    analysisType: "quick",
    outcome: "success",
    durationMs: 1234,
    qualityRetryCount: 1,
    promptVersion: "quick-analysis-v2",
    model: "deepseek-chat",
    upstreamUsage: {},
    env: {},
    dreamText: "must not appear",
    aiResponse: "must not appear"
  });

  assert.equal(event.principal_type, "authenticated");
  assert.equal(event.principal_hash, "a".repeat(64));
  assert.equal(event.prompt_tokens, null);
  assert.equal(event.estimated_cost_usd, null);
  assert.doesNotMatch(JSON.stringify(event), /private-user-id|must not appear/);
});

test("recordUsageEventSafely swallows insert failures", async () => {
  const messages = [];
  const result = await recordUsageEventSafely(
    {
      from() {
        return {
          insert: async () => ({ error: new Error("db unavailable") })
        };
      }
    },
    { request_id: "request-id" },
    { warn(message) { messages.push(message); } }
  );

  assert.equal(result.ok, false);
  assert.match(messages[0], /analytics_write_failed/);
});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm test -- tests/aiAnalytics.test.js`

Expected: FAIL because `server/aiAnalytics.js` does not exist.

- [ ] **Step 3: Implement `server/aiAnalytics.js`**

Implement with Node `crypto`:

```js
const crypto = require("node:crypto");

function getRequestIp(request) {
  return (request && (request.ip || (request.socket && request.socket.remoteAddress))) || "unknown";
}

function createPrincipalHash(identity, request, secret) {
  if (!secret) return null;
  const source = identity && identity.type === "authenticated"
    ? `user:${identity.userId || ""}`
    : `guest:${getRequestIp(request)}`;
  return crypto.createHmac("sha256", secret).update(source).digest("hex");
}

function toNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function calculateEstimatedCost(usage = {}, env = process.env) {
  const promptTokens = toNonNegativeInteger(usage.prompt_tokens);
  const completionTokens = toNonNegativeInteger(usage.completion_tokens);
  const inputCost = Number(env.AI_INPUT_COST_PER_1M_TOKENS);
  const outputCost = Number(env.AI_OUTPUT_COST_PER_1M_TOKENS);

  if (promptTokens === null || completionTokens === null || !Number.isFinite(inputCost) || !Number.isFinite(outputCost)) {
    return null;
  }

  return (promptTokens / 1_000_000) * inputCost + (completionTokens / 1_000_000) * outputCost;
}

function buildUsageEvent(context) {
  const usage = context.upstreamUsage || {};
  return {
    request_id: context.requestId,
    occurred_at: context.occurredAt.toISOString(),
    principal_type: context.identity.type === "authenticated" ? "authenticated" : "guest",
    principal_hash: context.principalHash,
    analysis_type: context.analysisType,
    outcome: context.outcome,
    error_code: context.errorCode || null,
    http_status: toNonNegativeInteger(context.httpStatus),
    duration_ms: toNonNegativeInteger(context.durationMs),
    quality_retry_count: toNonNegativeInteger(context.qualityRetryCount) || 0,
    prompt_version: context.promptVersion || null,
    model: context.model || null,
    prompt_tokens: toNonNegativeInteger(usage.prompt_tokens),
    completion_tokens: toNonNegativeInteger(usage.completion_tokens),
    total_tokens: toNonNegativeInteger(usage.total_tokens),
    estimated_cost_usd: calculateEstimatedCost(usage, context.env)
  };
}

async function recordUsageEventSafely(client, event, logger = console) {
  if (!client || !event || !event.principal_hash) {
    return { ok: false, skipped: true };
  }

  try {
    const response = await client.from("ai_usage_events").insert(event);
    if (response && response.error) {
      if (logger && typeof logger.warn === "function") logger.warn("analytics_write_failed");
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    if (logger && typeof logger.warn === "function") logger.warn("analytics_write_failed");
    return { ok: false };
  }
}

module.exports = {
  buildUsageEvent,
  calculateEstimatedCost,
  createPrincipalHash,
  recordUsageEventSafely
};
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/aiAnalytics.test.js`

Expected: PASS.

- [ ] **Step 5: Review**

Ask reviewer to verify `buildUsageEvent()` cannot include dream text, raw IP, email, token, or full user UUID and that cost is null when missing.

---

### Task 4: Wire AI Usage Recording Into Dream Analysis Handler

**Files:**
- Modify: `server.js`
- Modify: `tests/server.test.js`

**Interfaces:**
- Consumes `buildUsageEvent`, `createPrincipalHash`, `recordUsageEventSafely`, `createAdminSupabaseClient`.
- Produces analytics event writes through injectable `app.locals.analyticsClient` and `app.locals.analyticsEnv` for tests.

- [ ] **Step 1: Write failing server integration tests**

Add tests to `tests/server.test.js`:

```js
test("successful quick analysis records one analytics event", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  const inserted = [];
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 1000, completion_tokens: 2000, total_tokens: 3000 },
        choices: [{ message: { content: JSON.stringify({ analysis: createQuickAnalysisPayload(), dreamResultCard: createResultCardPayload() }) } }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      assert.equal(response.status, 200);
      assert.equal(inserted.length, 1);
      assert.equal(inserted[0].analysis_type, "quick");
      assert.equal(inserted[0].outcome, "success");
      assert.equal(inserted[0].prompt_tokens, 1000);
      assert.doesNotMatch(JSON.stringify(inserted[0]), /学校走廊|test-key|Bearer/);
    }, {
      analyticsClient: { from: () => ({ insert: async (event) => { inserted.push(event); return { error: null }; } }) },
      analyticsEnv: {
        ANALYTICS_HASH_SECRET: "analytics-secret",
        AI_INPUT_COST_PER_1M_TOKENS: "1",
        AI_OUTPUT_COST_PER_1M_TOKENS: "2"
      }
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("analytics insert failure does not affect quick analysis", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ analysis: createQuickAnalysisPayload(), dreamResultCard: createResultCardPayload() }) } }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      assert.equal(response.status, 200);
    }, {
      analyticsClient: { from: () => ({ insert: async () => ({ error: new Error("db") }) }) },
      analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" }
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("disabled guided analysis does not record normal analytics event", { concurrency: false }, async () => {
  const inserted = [];
  await withServer(async (baseUrl) => {
    const response = await postDreamAnalysis(baseUrl, {
      dreamText: "学校走廊里的门",
      analysisType: "guided_questions"
    });
    assert.equal(response.status, 403);
    assert.equal(inserted.length, 0);
  }, {
    analyticsClient: { from: () => ({ insert: async (event) => { inserted.push(event); return { error: null }; } }) },
    analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" }
  });
});
```

Update the local `withServer()` helper to accept `analyticsClient` and `analyticsEnv`, then clean them up.

- [ ] **Step 2: Run focused server tests to verify failure**

Run: `npm test -- tests/server.test.js`

Expected: FAIL because analytics is not wired.

- [ ] **Step 3: Modify DeepSeek completion return value**

Change `requestDeepSeekCompletion()` to return both parsed content and upstream usage:

```js
return {
  parsed: typeof content === "string" ? parseJsonObject(content) : null,
  usage: data && data.usage ? data.usage : null
};
```

Update `requestDeepSeekAnalysis()` to track:

```js
const analyticsMeta = {
  upstreamUsage: null,
  qualityRetryCount: 0,
  promptVersion: quickPromptVersion,
  model: deepSeekModel
};
```

Return `{ ...normalized, __analyticsMeta: analyticsMeta }` internally, then strip `__analyticsMeta` before sending browser response.

- [ ] **Step 4: Add analytics helpers in `server.js`**

Add imports:

```js
const { createAdminSupabaseClient } = require("./server/adminSupabase");
const { buildUsageEvent, createPrincipalHash, recordUsageEventSafely } = require("./server/aiAnalytics");
```

Add helpers:

```js
function getAnalyticsClient() {
  if (Object.prototype.hasOwnProperty.call(app.locals, "analyticsClient")) {
    return app.locals.analyticsClient;
  }
  return createAdminSupabaseClient();
}

function getAnalyticsEnv() {
  return app.locals.analyticsEnv || process.env;
}
```

- [ ] **Step 5: Record event on success and failure**

In `handleDreamAnalysisRequest()`:

```js
const requestId = crypto.randomUUID();
const occurredAt = new Date();
const startedAt = Date.now();
```

After success:

```js
const analyticsMeta = analysis.__analyticsMeta || {};
delete analysis.__analyticsMeta;
const principalHash = createPrincipalHash(identity, request, getAnalyticsEnv().ANALYTICS_HASH_SECRET);
const event = buildUsageEvent({
  requestId,
  occurredAt,
  identity,
  principalHash,
  analysisType: request.body.analysisType,
  outcome: "success",
  durationMs: Date.now() - startedAt,
  qualityRetryCount: analyticsMeta.qualityRetryCount || 0,
  promptVersion: analyticsMeta.promptVersion || quickPromptVersion,
  model: analyticsMeta.model || deepSeekModel,
  upstreamUsage: analyticsMeta.upstreamUsage || null,
  env: getAnalyticsEnv()
});
recordUsageEventSafely(getAnalyticsClient(), event);
```

In the catch block, after finishing access control:

```js
const outcome = apiError.code === "UPSTREAM_TIMEOUT"
  ? "timeout"
  : apiError.code === "GENERATION_INCOMPLETE"
    ? "generation_incomplete"
    : "upstream_error";
```

Build and safely record the failed event when `identity` exists and the request passed feature-disabled checks.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/server.test.js`

Expected: PASS.

- [ ] **Step 7: Review**

Ask reviewer to check that analytics write cannot block lock release or user response, disabled deep guidance is not recorded, and user content cannot enter event rows.

---

### Task 5: Admin Summary And Recent Server API

**Files:**
- Create: `server/adminAnalytics.js`
- Create: `tests/adminAnalytics.test.js`
- Modify: `server.js`
- Modify: `tests/server.test.js`

**Interfaces:**
- Produces `normalizeRange(value)`.
- Produces `normalizeRecentLimit(value)`.
- Produces `summarizeUsageEvents(events, now)`.
- Produces `formatRecentEvents(events)`.
- Adds routes `/api/v1/admin/analytics/summary` and `/api/v1/admin/analytics/recent`.

- [ ] **Step 1: Write failing aggregation tests**

Create `tests/adminAnalytics.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  formatRecentEvents,
  normalizeRange,
  normalizeRecentLimit,
  summarizeUsageEvents
} = require("../server/adminAnalytics");

test("normalizes admin ranges and limits", () => {
  assert.equal(normalizeRange("7d").days, 7);
  assert.equal(normalizeRange("30d").days, 30);
  assert.equal(normalizeRange("90d").days, 90);
  assert.equal(normalizeRange("365d").days, 7);
  assert.equal(normalizeRecentLimit("200"), 100);
  assert.equal(normalizeRecentLimit("abc"), 20);
});

test("summarizes usage events without exposing hashes", () => {
  const summary = summarizeUsageEvents([
    {
      occurred_at: "2026-07-17T01:00:00.000Z",
      principal_type: "guest",
      principal_hash: "hash-a",
      analysis_type: "quick",
      outcome: "success",
      duration_ms: 100,
      quality_retry_count: 1,
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
      estimated_cost_usd: 0.001
    },
    {
      occurred_at: "2026-07-16T01:00:00.000Z",
      principal_type: "authenticated",
      principal_hash: "hash-b",
      analysis_type: "result_card",
      outcome: "timeout",
      error_code: "UPSTREAM_TIMEOUT",
      duration_ms: 300,
      quality_retry_count: 0,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      estimated_cost_usd: null
    }
  ], new Date("2026-07-17T12:00:00.000Z"));

  assert.equal(summary.totalRequests, 2);
  assert.equal(summary.todayRequests, 1);
  assert.equal(summary.approximatePrincipals, 2);
  assert.equal(summary.successRate, 0.5);
  assert.equal(summary.p95DurationMs, 300);
  assert.equal(summary.totalEstimatedCostUsd, 0.001);
  assert.doesNotMatch(JSON.stringify(summary), /hash-a|hash-b/);
});

test("recent events return redacted short request ids", () => {
  const recent = formatRecentEvents([{
    request_id: "00000000-0000-4000-8000-000000000001",
    occurred_at: "2026-07-17T01:00:00.000Z",
    principal_hash: "private-hash",
    principal_type: "guest",
    analysis_type: "quick",
    outcome: "success",
    duration_ms: 100,
    total_tokens: 30,
    estimated_cost_usd: 0.001
  }]);

  assert.equal(recent[0].requestId, "00000000");
  assert.equal(recent[0].principalType, "guest");
  assert.doesNotMatch(JSON.stringify(recent), /private-hash/);
});
```

- [ ] **Step 2: Run aggregation tests to verify failure**

Run: `npm test -- tests/adminAnalytics.test.js`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement `server/adminAnalytics.js`**

Implement pure functions plus query helpers:

```js
function normalizeRange(value) {
  const allowed = { "7d": 7, "30d": 30, "90d": 90 };
  return { key: allowed[value] ? value : "7d", days: allowed[value] || 7 };
}

function normalizeRecentLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 20;
  return Math.min(100, Math.floor(number));
}
```

`summarizeUsageEvents(events, now)` returns a DTO with no raw hashes and with `costConfigured` based on whether any `estimated_cost_usd` is non-null.

`formatRecentEvents(events)` maps snake_case rows to camelCase, uses `request_id.slice(0, 8)`, and excludes `principal_hash`.

- [ ] **Step 4: Add admin route tests**

Add to `tests/server.test.js`:

```js
test("admin summary requires authenticated admin", { concurrency: false }, async () => {
  await withServer(async (baseUrl) => {
    const guest = await fetch(`${baseUrl}/api/v1/admin/analytics/summary`);
    assert.equal(guest.status, 401);

    const user = await fetch(`${baseUrl}/api/v1/admin/analytics/summary`, {
      headers: { Authorization: "Bearer user-token" }
    });
    assert.equal(user.status, 403);
  }, {
    authResolver: {
      resolveIdentity: async (request) => {
        const header = request.headers.authorization || "";
        if (!header) return { type: "guest", userId: "", rateLimitKey: "guest:127.0.0.1" };
        return { type: "authenticated", userId: "normal-user", rateLimitKey: "user:normal-user" };
      }
    },
    adminEnv: { ADMIN_USER_IDS: "admin-user", SUPABASE_SERVICE_ROLE_KEY: "service", SUPABASE_URL: "https://example.supabase.co" }
  });
});
```

Add a success test with `admin-user` and fake analytics client returning rows.

- [ ] **Step 5: Wire routes in `server.js`**

Add imports:

```js
const { createAdminAuth } = require("./server/adminAuth");
const { getAnalyticsSummary, getRecentAnalyticsEvents } = require("./server/adminAnalytics");
```

Add helpers:

```js
function getAdminEnv() {
  return app.locals.adminEnv || process.env;
}

function getAdminAuth() {
  return createAdminAuth({ aiAuthResolver: getAiAuthResolver(), env: getAdminEnv() });
}
```

Add handlers:

```js
app.get("/api/v1/admin/analytics/summary", handleAdminSummaryRequest);
app.get("/api/v1/admin/analytics/recent", handleAdminRecentRequest);
```

Each handler sets no-store, calls `requireAdminIdentity`, checks analytics client availability, and returns safe DTOs.

- [ ] **Step 6: Run focused server/admin tests**

Run: `npm test -- tests/adminAnalytics.test.js tests/server.test.js`

Expected: PASS.

- [ ] **Step 7: Review**

Ask reviewer to check 401/403/503 behavior, no raw DB error leakage, no private fields in DTOs, and extensibility beyond 90 days.

---

### Task 6: SPA Admin View And Frontend Controller

**Files:**
- Create: `src/adminAnalytics.js`
- Create: `tests/adminAnalyticsFrontend.test.js`
- Modify: `src/index.html`
- Modify: `src/app.js`
- Modify: `src/style.css`

**Interfaces:**
- Produces `window.AdminAnalytics.createAdminAnalyticsController(options)`.
- Consumes `window.DreamAnatomyAuth.getClient()`.
- Consumes `window.DreamAnatomyApp.showView()`.

- [ ] **Step 1: Write failing frontend controller tests**

Create `tests/adminAnalyticsFrontend.test.js`:

```js
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
    classList: { add() {}, remove() {}, toggle() {} },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
    addEventListener(type, handler) { this[`on${type}`] = handler; },
    setAttribute(name, value) { this[name] = value; }
  };
}

test("admin entry is hidden until server confirms admin", async () => {
  const elements = {
    entry: createElement(),
    status: createElement(),
    cards: createElement(),
    recent: createElement(),
    rangeButtons: []
  };
  const calls = [];
  const controller = AdminAnalytics.createAdminAnalyticsController({
    elements,
    fetchJson: async () => {
      calls.push("probe");
      return { ok: true, json: async () => ({ totalRequests: 0, dailyTrend: [] }) };
    },
    getAuthHeader: async () => ({ Authorization: "Bearer token" }),
    app: { showView() {} },
    document: { createElement: () => createElement() }
  });

  await controller.handleSession({ user: { id: "admin" } });
  assert.equal(elements.entry.hidden, false);
  assert.equal(calls.length, 1);
});

test("logout clears data and leaves admin view", async () => {
  const views = [];
  const elements = {
    entry: createElement(),
    status: createElement(),
    cards: createElement(),
    recent: createElement(),
    rangeButtons: []
  };
  const controller = AdminAnalytics.createAdminAnalyticsController({
    elements,
    fetchJson: async () => ({ ok: true, json: async () => ({ totalRequests: 1, dailyTrend: [] }) }),
    getAuthHeader: async () => ({ Authorization: "Bearer token" }),
    app: {
      getCurrentView: () => "admin",
      showView(view) { views.push(view); }
    },
    document: { createElement: () => createElement() }
  });

  await controller.handleSession({ user: { id: "admin" } });
  await controller.handleSession({ user: null });
  assert.equal(elements.entry.hidden, true);
  assert.equal(elements.cards.children.length, 0);
  assert.deepEqual(views, ["home"]);
});

test("manual admin view access shows no permission on 403", async () => {
  const elements = {
    entry: createElement(),
    status: createElement(),
    cards: createElement(),
    recent: createElement(),
    rangeButtons: []
  };
  const controller = AdminAnalytics.createAdminAnalyticsController({
    elements,
    fetchJson: async () => ({ ok: false, status: 403, json: async () => ({ error: { code: "AUTH_FORBIDDEN", message: "无权限" } }) }),
    getAuthHeader: async () => ({ Authorization: "Bearer token" }),
    app: { showView() {} },
    document: { createElement: () => createElement() }
  });

  await controller.enterAdminView();
  assert.match(elements.status.textContent, /无权限/);
});
```

- [ ] **Step 2: Run focused frontend tests to verify failure**

Run: `npm test -- tests/adminAnalyticsFrontend.test.js`

Expected: FAIL because `src/adminAnalytics.js` does not exist.

- [ ] **Step 3: Implement `src/adminAnalytics.js`**

Implement controller functions:

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(root);
  } else {
    root.AdminAnalytics = factory(root);
  }
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  function createAdminAnalyticsController(options = {}) {
    const elements = options.elements || {};
    const app = options.app || {};
    const fetchJson = options.fetchJson || ((url, init) => fetch(url, init));
    const getAuthHeader = options.getAuthHeader || async function () {
      const client = root.DreamAnatomyAuth && root.DreamAnatomyAuth.getClient();
      if (!client) return {};
      const { data } = await client.auth.getSession();
      const token = data && data.session ? data.session.access_token : "";
      return token ? { Authorization: `Bearer ${token}` } : {};
    };
    let activeUserId = "";
    let isAdmin = false;
    let range = "7d";

    function clear() {
      isAdmin = false;
      if (elements.entry) elements.entry.hidden = true;
      if (elements.status) elements.status.textContent = "";
      if (elements.cards && elements.cards.replaceChildren) elements.cards.replaceChildren();
      if (elements.recent && elements.recent.replaceChildren) elements.recent.replaceChildren();
    }

    async function requestAdminJson(url) {
      const authHeader = await getAuthHeader();
      return fetchJson(url, { headers: authHeader });
    }

    async function loadDashboard() {
      if (elements.status) elements.status.textContent = "正在读取运营数据……";
      const response = await requestAdminJson(`/api/v1/admin/analytics/summary?range=${range}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (elements.status) elements.status.textContent = payload.error && payload.error.message ? payload.error.message : "暂时无法读取运营数据。";
        isAdmin = false;
        return false;
      }
      isAdmin = true;
      if (elements.entry) elements.entry.hidden = false;
      if (elements.status) elements.status.textContent = payload.totalRequests ? "" : "暂无运营统计数据。";
      return true;
    }

    async function enterAdminView() {
      return loadDashboard();
    }

    async function handleSession(session = {}) {
      const userId = session.user && session.user.id ? session.user.id : "";
      if (!userId || (activeUserId && activeUserId !== userId)) {
        clear();
        if (app.getCurrentView && app.getCurrentView() === "admin" && app.showView) {
          app.showView("home");
        }
      }
      activeUserId = userId;
      if (!userId) return false;
      return loadDashboard();
    }

    return { clear, enterAdminView, handleSession };
  }

  return { createAdminAnalyticsController };
});
```

Then expand render functions for cards, trend bars, distributions, and recent rows using `textContent`.

- [ ] **Step 4: Add HTML view and script**

In `src/index.html`:

```html
<button class="text-button" type="button" data-view-target="admin" data-admin-entry hidden>运营后台</button>
```

Add panel:

```html
<section class="view-panel work-panel admin-panel" data-view="admin" aria-labelledby="admin-title" hidden>
  <div class="panel-copy">
    <p class="eyebrow">Operations</p>
    <h2 id="admin-title">运营后台</h2>
    <p class="summary">查看 AI 使用趋势、成功率、耗时、Token 和预估成本。这里不会显示梦境正文或用户身份。</p>
    <p class="status" data-admin-status aria-live="polite"></p>
  </div>
  <div class="admin-range-tabs" data-admin-range-tabs>
    <button class="text-button is-current" type="button" data-admin-range="7d">最近 7 天</button>
    <button class="text-button" type="button" data-admin-range="30d">最近 30 天</button>
    <button class="text-button" type="button" data-admin-range="90d">最近 90 天</button>
  </div>
  <div class="admin-card-grid" data-admin-cards></div>
  <div class="admin-chart" data-admin-trend></div>
  <div class="admin-distribution-grid">
    <section data-admin-principal-distribution></section>
    <section data-admin-analysis-distribution></section>
    <section data-admin-error-distribution></section>
  </div>
  <section>
    <h3>最近请求</h3>
    <div data-admin-recent></div>
  </section>
</section>
```

Add `<script src="adminAnalytics.js"></script>` before `app.js`.

- [ ] **Step 5: Wire app view integration**

In `src/app.js`, create controller if available and expose:

```js
function getCurrentView() {
  const active = document.querySelector("[data-view].is-active");
  return active ? active.dataset.view : "";
}
```

When `showView("admin")` is called, call `adminAnalyticsController.enterAdminView()`.

Expose `getCurrentView` in `window.DreamAnatomyApp`.

- [ ] **Step 6: Add CSS**

Add `.admin-panel`, `.admin-card-grid`, `.admin-chart`, `.admin-trend-bar`, `.admin-distribution-grid`, and `.admin-recent-list` styles with existing colors, 8px radius or less, and mobile-friendly grids.

- [ ] **Step 7: Run frontend tests**

Run: `npm test -- tests/adminAnalyticsFrontend.test.js tests/dreamJournal.test.js tests/dreamHome.test.js`

Expected: PASS.

- [ ] **Step 8: Review**

Ask reviewer to check no `innerHTML`, admin data clears on session changes, manual admin view access calls server, and mobile layout avoids table overflow.

---

### Task 7: Documentation And Project Status

**Files:**
- Create: `docs/ADMIN_ANALYTICS_SETUP.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `tests/supabaseSecurity.test.js`

**Interfaces:**
- Produces deployment instructions and manual validation checklist.

- [ ] **Step 1: Write documentation tests**

Add to `tests/supabaseSecurity.test.js`:

```js
test("admin analytics setup document explains secrets and long-term retention", () => {
  const docs = readProjectFile("docs/ADMIN_ANALYTICS_SETUP.md");

  assert.match(docs, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(docs, /ADMIN_USER_IDS/);
  assert.match(docs, /ANALYTICS_HASH_SECRET/);
  assert.match(docs, /AI 使用统计将在实现产品运营分析和服务改进目的所必要的期限内长期保存/);
  assert.match(docs, /当前版本不执行自动清理/);
  assert.match(docs, /不要随意轮换 ANALYTICS_HASH_SECRET/);
  assert.doesNotMatch(docs, /180 天|永久保存|永不删除/);
});
```

- [ ] **Step 2: Run docs test to verify failure**

Run: `npm test -- tests/supabaseSecurity.test.js`

Expected: FAIL because docs do not exist.

- [ ] **Step 3: Create setup docs**

Create `docs/ADMIN_ANALYTICS_SETUP.md` with sections:

- Overview
- Required Render env vars
- Optional cost env vars
- Supabase SQL migration steps
- How to find admin UUIDs
- How to protect service role key
- Retention and privacy boundary
- Hash secret rotation warning
- Manual verification checklist

Include exact retention text:

```text
AI 使用统计将在实现产品运营分析和服务改进目的所必要的期限内长期保存。
当前版本不执行自动清理；未来如调整保留期限，将在隐私政策和部署文档中同步更新。
```

- [ ] **Step 4: Update README and PROJECT_STATUS**

Add concise notes:

- admin analytics requires service role env vars server-side
- browser runtime still exposes only Supabase URL and anon key
- admin dashboard is read-only and privacy-preserving
- migration must be applied manually in Supabase SQL Editor

- [ ] **Step 5: Run docs tests**

Run: `npm test -- tests/supabaseSecurity.test.js`

Expected: PASS.

- [ ] **Step 6: Review**

Ask reviewer to verify docs do not include real keys, do not imply permanent retention, and clearly list manual deployment steps.

---

### Task 8: Full Verification, Final Review, Commit, Push, PR

**Files:**
- All changed files from previous tasks.

**Interfaces:**
- Produces branch `codex/admin-analytics`.
- Produces commit `Add persistent AI analytics dashboard`.
- Produces PR `Add AI Usage Analytics and Admin Dashboard`.

- [ ] **Step 1: Run complete automated tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run syntax checks**

Run:

```bash
node --check server.js
node --check server/adminAuth.js
node --check server/adminSupabase.js
node --check server/aiAnalytics.js
node --check server/adminAnalytics.js
node --check src/adminAnalytics.js
node --check src/app.js
```

Expected: all syntax checks pass.

- [ ] **Step 3: Run whitespace diff check**

Run: `git diff --check`

Expected: no output.

- [ ] **Step 4: Run final reviewer**

Use Superpowers requesting-code-review. Reviewer must check:

- service role never enters frontend
- admin auth is server-enforced
- analytics events contain no private content
- normal AI parsing still works when analytics is unavailable
- admin API 401/403/503 are stable
- no Critical or Important findings

- [ ] **Step 5: Fix Critical or Important findings only**

If reviewer finds Critical or Important issues, fix them and rerun:

```bash
npm test
node --check server.js
node --check src/app.js
git diff --check
```

- [ ] **Step 6: Commit final implementation**

Run:

```bash
git add .
git commit -m "Add persistent AI analytics dashboard"
```

- [ ] **Step 7: Push and create PR**

Run:

```bash
git push -u origin codex/admin-analytics
gh pr create --title "Add AI Usage Analytics and Admin Dashboard" --body "<final PR body>"
```

PR body must include:

- architecture summary
- migration file name
- new environment variables
- privacy boundary
- test results
- final reviewer conclusion
- Render configuration steps
- Supabase SQL Editor steps

- [ ] **Step 8: Final response**

Report:

- architecture summary
- migration file name
- new env vars
- data privacy boundary
- full test results
- final reviewer conclusion
- PR link
- Render and Supabase manual configuration steps
- note that no mini-program/payment/deep guidance reopening was done

---

## Plan Self-Review

- Spec coverage: migration, service role, HMAC privacy, AI event recording, admin API, SPA UI, docs, testing, and no-cleanup retention are covered.
- Placeholder scan: no unfinished placeholder instructions are used.
- Type consistency: module names and exported function names are consistent across tasks.
- Scope check: implementation remains a single PR with server analytics, admin API, UI, docs, and tests; no unrelated product feature is included.
