const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertWechatAuthConfigured,
  createWechatIdentityClient,
  createWechatIdentityHash,
  validateWechatCode
} = require("../server/wechatIdentity");
const {
  createSessionToken,
  createWechatSessionHash,
  createWechatSessionStore
} = require("../server/wechatSession");
const { createWechatAuthService } = require("../server/wechatAuth");

const baseEnv = {
  WECHAT_MINIPROGRAM_APP_ID: "wx-test-app",
  WECHAT_MINIPROGRAM_APP_SECRET: "wechat-app-secret",
  WECHAT_IDENTITY_HASH_SECRET: "identity-secret",
  WECHAT_SESSION_HASH_SECRET: "session-secret"
};

function createFakeWechatClient(options = {}) {
  const state = {
    accounts: options.accounts ? options.accounts.map((item) => ({ ...item })) : [],
    sessions: options.sessions ? options.sessions.map((item) => ({ ...item })) : [],
    inserts: [],
    updates: []
  };

  function query(tableName) {
    const filters = [];
    const queryApi = {
      select() {
        return queryApi;
      },
      insert(value) {
        const row = { ...value, id: value.id || `${tableName}-${state[tableName].length + 1}` };
        state[tableName].push(row);
        state.inserts.push({ tableName, row });
        return {
          select() {
            return {
              single: async () => ({ data: row, error: null })
            };
          }
        };
      },
      update(values) {
        return {
          eq(column, value) {
            filters.push({ column, value });
            return this;
          },
          async then(resolve) {
            if (options.updateError) {
              return resolve({ data: null, error: options.updateError });
            }
            const rows = state[tableName].filter((row) => filters.every((filter) => row[filter.column] === filter.value));
            rows.forEach((row) => Object.assign(row, values));
            state.updates.push({ tableName, filters: [...filters], values });
            return resolve({ data: rows, error: null });
          }
        };
      },
      eq(column, value) {
        filters.push({ column, value });
        return queryApi;
      },
      is(column, value) {
        filters.push({ column, value });
        return queryApi;
      },
      maybeSingle: async () => {
        const rows = state[tableName].filter((row) => filters.every((filter) => row[filter.column] === filter.value));
        return { data: rows[0] || null, error: null };
      },
      single: async () => {
        const rows = state[tableName].filter((row) => filters.every((filter) => row[filter.column] === filter.value));
        return { data: rows[0] || null, error: rows[0] ? null : new Error("not found") };
      }
    };
    return queryApi;
  }

  return {
    state,
    from(tableName) {
      const key = tableName === "wechat_accounts" ? "accounts" : "sessions";
      if (!state[key]) throw new Error(`unexpected table ${tableName}`);
      const api = query(key);
      api.tableName = tableName;
      return api;
    }
  };
}

test("validates WeChat auth server configuration and login code shape", () => {
  assert.doesNotThrow(() => assertWechatAuthConfigured(baseEnv));
  assert.throws(
    () => assertWechatAuthConfigured({ ...baseEnv, WECHAT_MINIPROGRAM_APP_SECRET: "" }),
    (error) => error.code === "WECHAT_AUTH_UNAVAILABLE" && error.status === 503
  );

  assert.equal(validateWechatCode("  abc_123-XYZ  "), "abc_123-XYZ");
  for (const invalidCode of ["", "x".repeat(257), "bad code with spaces"]) {
    assert.throws(
      () => validateWechatCode(invalidCode),
      (error) => error.code === "INVALID_REQUEST" && error.status === 400
    );
  }
});

test("hashes WeChat openid and unionid with keyed HMAC prefixes", () => {
  const first = createWechatIdentityHash({
    appId: "wx-app",
    openid: "openid-1",
    unionid: "unionid-1",
    secret: "identity-secret"
  });
  const second = createWechatIdentityHash({
    appId: "wx-app",
    openid: "openid-1",
    unionid: "unionid-1",
    secret: "identity-secret"
  });
  const otherApp = createWechatIdentityHash({
    appId: "wx-other",
    openid: "openid-1",
    unionid: "unionid-1",
    secret: "identity-secret"
  });

  assert.equal(first.openidHash, second.openidHash);
  assert.equal(first.unionidHash, second.unionidHash);
  assert.notEqual(first.openidHash, otherApp.openidHash);
  assert.match(first.openidHash, /^[a-f0-9]{64}$/);
  assert.match(first.unionidHash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first.openidHash, /openid|unionid|wx-app/);
});

test("exchanges code through WeChat without returning session_key to callers", async () => {
  const calls = [];
  const client = createWechatIdentityClient({
    env: baseEnv,
    fetchImpl: async (url) => {
      calls.push(String(url));
      return {
        ok: true,
        json: async () => ({ openid: "openid-1", unionid: "unionid-1", session_key: "secret-session-key" })
      };
    }
  });

  const result = await client.exchangeCode("code-1");

  assert.equal(result.openid, "openid-1");
  assert.equal(result.unionid, "unionid-1");
  assert.equal(Object.hasOwn(result, "sessionKey"), false);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /jscode2session/);
  assert.match(calls[0], /appid=wx-test-app/);
  assert.match(calls[0], /js_code=code-1/);
});

test("session tokens are opaque and only HMAC hashes are stored", async () => {
  const token = createSessionToken();
  assert.match(token, /^[A-Za-z0-9_-]{43,}$/);

  const hash = createWechatSessionHash(token, "session-secret");
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(hash, new RegExp(token.slice(0, 10)));

  const client = createFakeWechatClient();
  const store = createWechatSessionStore({ client, env: baseEnv, now: () => new Date("2026-07-20T00:00:00.000Z") });
  const session = await store.createSession("account-1");

  assert.equal(session.sessionToken.length >= 43, true);
  assert.equal(session.expiresAt, "2026-07-27T00:00:00.000Z");
  assert.equal(client.state.sessions.length, 1);
  assert.equal(client.state.sessions[0].account_id, "account-1");
  assert.equal(client.state.sessions[0].token_hash, createWechatSessionHash(session.sessionToken, baseEnv.WECHAT_SESSION_HASH_SECRET));
  assert.notEqual(client.state.sessions[0].token_hash, session.sessionToken);
});

test("session verification rejects expired, revoked, and disabled account sessions", async () => {
  const activeToken = "active-token";
  const expiredToken = "expired-token";
  const revokedToken = "revoked-token";
  const disabledToken = "disabled-token";
  const client = createFakeWechatClient({
    accounts: [
      { id: "account-1", disabled_at: null },
      { id: "account-disabled", disabled_at: "2026-07-19T00:00:00.000Z" }
    ],
    sessions: [
      { account_id: "account-1", token_hash: createWechatSessionHash(activeToken, baseEnv.WECHAT_SESSION_HASH_SECRET), expires_at: "2026-07-21T00:00:00.000Z", revoked_at: null },
      { account_id: "account-1", token_hash: createWechatSessionHash(expiredToken, baseEnv.WECHAT_SESSION_HASH_SECRET), expires_at: "2026-07-19T00:00:00.000Z", revoked_at: null },
      { account_id: "account-1", token_hash: createWechatSessionHash(revokedToken, baseEnv.WECHAT_SESSION_HASH_SECRET), expires_at: "2026-07-21T00:00:00.000Z", revoked_at: "2026-07-20T00:00:00.000Z" },
      { account_id: "account-disabled", token_hash: createWechatSessionHash(disabledToken, baseEnv.WECHAT_SESSION_HASH_SECRET), expires_at: "2026-07-21T00:00:00.000Z", revoked_at: null }
    ]
  });
  const store = createWechatSessionStore({ client, env: baseEnv, now: () => new Date("2026-07-20T00:00:00.000Z") });

  const verified = await store.verifySession(activeToken);
  assert.equal(verified.account.mode, "wechat");
  assert.equal(verified.account.authenticated, true);
  assert.equal(verified.account.cloudSyncAvailable, false);
  assert.equal(verified.wechatAccountId, "account-1");
  assert.equal(client.state.updates.some((item) => item.tableName === "sessions" && item.values.last_seen_at), true);

  for (const tokenValue of [expiredToken, revokedToken, disabledToken, "missing-token"]) {
    await assert.rejects(
      () => store.verifySession(tokenValue),
      (error) => error.code === "AUTH_INVALID" && error.status === 401
    );
  }
});

test("logout revokes only the current session and is idempotent", async () => {
  const token = "logout-token";
  const otherToken = "other-token";
  const client = createFakeWechatClient({
    accounts: [{ id: "account-1", disabled_at: null }],
    sessions: [
      { account_id: "account-1", token_hash: createWechatSessionHash(token, baseEnv.WECHAT_SESSION_HASH_SECRET), expires_at: "2026-07-21T00:00:00.000Z", revoked_at: null },
      { account_id: "account-1", token_hash: createWechatSessionHash(otherToken, baseEnv.WECHAT_SESSION_HASH_SECRET), expires_at: "2026-07-21T00:00:00.000Z", revoked_at: null }
    ]
  });
  const store = createWechatSessionStore({ client, env: baseEnv, now: () => new Date("2026-07-20T00:00:00.000Z") });

  assert.deepEqual(await store.revokeSession(token), { ok: true });
  assert.deepEqual(await store.revokeSession(token), { ok: true });
  assert.notEqual(client.state.sessions[0].revoked_at, null);
  assert.equal(client.state.sessions[1].revoked_at, null);
});

test("logout reports a stable failure when session revocation is rejected by storage", async () => {
  const client = createFakeWechatClient({ updateError: new Error("database unavailable") });
  const store = createWechatSessionStore({ client, env: baseEnv, now: () => new Date("2026-07-20T00:00:00.000Z") });

  await assert.rejects(
    () => store.revokeSession("logout-token"),
    (error) => error.code === "INTERNAL_ERROR" && error.status === 500
  );
});

test("wechat auth login finds or creates accounts without exposing raw identity", async () => {
  const client = createFakeWechatClient();
  const service = createWechatAuthService({
    env: baseEnv,
    getAdminClient: () => client,
    fetchImpl: async (url) => ({
      ok: true,
      json: async () => ({
        openid: String(url).includes("code-second") ? "openid-2" : "openid-1",
        unionid: "unionid-1",
        session_key: "secret-session-key"
      })
    }),
    now: () => new Date("2026-07-20T00:00:00.000Z")
  });

  const first = await service.login({ body: { code: "code-first", openid: "forged", accountId: "forged" }, ip: "127.0.0.1" });
  const second = await service.login({ body: { code: "code-first" }, ip: "127.0.0.1" });
  const third = await service.login({ body: { code: "code-second" }, ip: "127.0.0.2" });

  assert.equal(first.account.mode, "wechat");
  assert.equal(first.account.authenticated, true);
  assert.equal(first.account.cloudSyncAvailable, false);
  assert.equal(Object.hasOwn(first, "openid"), false);
  assert.equal(Object.hasOwn(first, "unionid"), false);
  assert.equal(Object.hasOwn(first, "session_key"), false);
  assert.equal(Object.hasOwn(first.account, "id"), false);
  assert.equal(client.state.accounts.length, 2);
  assert.equal(client.state.sessions.length, 3);
  assert.equal(second.account.mode, "wechat");
  assert.equal(third.account.mode, "wechat");
  assert.doesNotMatch(JSON.stringify(client.state), /openid-1|openid-2|unionid-1|secret-session-key|code-first|code-second/);
});

test("wechat auth login rejects missing config and limits repeated login attempts", async () => {
  const configuredClient = createFakeWechatClient();
  const limitedService = createWechatAuthService({
    env: { ...baseEnv, WECHAT_LOGIN_REQUESTS_PER_MINUTE: "1" },
    getAdminClient: () => configuredClient,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ openid: "openid-1" })
    }),
    now: () => new Date("2026-07-20T00:00:00.000Z")
  });

  await limitedService.login({ body: { code: "first-code" }, ip: "same-ip" });
  await assert.rejects(
    () => limitedService.login({ body: { code: "second-code" }, ip: "same-ip" }),
    (error) => error.code === "RATE_LIMITED" && error.status === 429 && error.retryAfter >= 1
  );

  const unavailable = createWechatAuthService({
    env: { ...baseEnv, WECHAT_MINIPROGRAM_APP_SECRET: "" },
    getAdminClient: () => createFakeWechatClient(),
    fetchImpl: async () => ({ ok: true, json: async () => ({ openid: "openid-1" }) })
  });
  await assert.rejects(
    () => unavailable.login({ body: { code: "code-1" }, ip: "127.0.0.1" }),
    (error) => error.code === "WECHAT_AUTH_UNAVAILABLE" && error.status === 503
  );
});

test("wechat auth getSession and logout use only bearer session token", async () => {
  const client = createFakeWechatClient({ accounts: [{ id: "account-1", disabled_at: null }] });
  const service = createWechatAuthService({
    env: baseEnv,
    getAdminClient: () => client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ openid: "openid-1" }) }),
    now: () => new Date("2026-07-20T00:00:00.000Z")
  });
  const login = await service.login({ body: { code: "code-1" }, ip: "127.0.0.1" });

  const session = await service.getSession({
    headers: { authorization: `Bearer ${login.sessionToken}` },
    body: { accountId: "forged-account" }
  });
  assert.equal(session.account.mode, "wechat");
  assert.equal(session.account.cloudSyncAvailable, false);
  assert.equal(Object.hasOwn(session.account, "id"), false);

  assert.deepEqual(await service.logout({
    headers: { authorization: `Bearer ${login.sessionToken}` },
    body: { accountId: "forged-account" }
  }), { ok: true });
  await assert.rejects(
    () => service.getSession({ headers: { authorization: `Bearer ${login.sessionToken}` } }),
    (error) => error.code === "AUTH_INVALID" && error.status === 401
  );
});
