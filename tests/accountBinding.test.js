const assert = require("node:assert/strict");
const test = require("node:test");

const { createAccountBindingService, normalizeBindingCode } = require("../server/accountBinding");

function createRequest({ token = "", body = {} } = {}) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
    ip: "127.0.0.1"
  };
}

function createFakeClient(options = {}) {
  const state = {
    app_users: options.app_users ? JSON.parse(JSON.stringify(options.app_users)) : [],
    account_binding_tokens: [],
    inserts: [],
    upserts: [],
    rpcCalls: [],
    rpcResult: options.rpcResult || { data: { status: "bound", mergedCount: 2, conflictCount: 1 }, error: null }
  };

  function createFilterApi(tableName, rows) {
    const filters = [];
    const api = {
      select() {
        return api;
      },
      eq(column, value) {
        filters.push({ column, value });
        return api;
      },
      async maybeSingle() {
        const row = rows.find((item) => filters.every((filter) => item[filter.column] === filter.value));
        return { data: row ? JSON.parse(JSON.stringify(row)) : null, error: null };
      }
    };
    return api;
  }

  return {
    state,
    from(tableName) {
      assert.ok(Object.hasOwn(state, tableName), `unexpected table ${tableName}`);
      return {
        select() {
          return createFilterApi(tableName, state[tableName]);
        },
        upsert(row, options = {}) {
          state.upserts.push({ tableName, row: JSON.parse(JSON.stringify(row)), options });
          const existing = state[tableName].find((item) => item.id === row.id);
          if (existing) Object.assign(existing, row);
          else state[tableName].push({ ...row });
          return {
            select() {
              return {
                async single() {
                  return { data: JSON.parse(JSON.stringify(row)), error: null };
                }
              };
            }
          };
        },
        insert(row) {
          state.inserts.push({ tableName, row: JSON.parse(JSON.stringify(row)) });
          const saved = { id: `${tableName}-1`, ...row };
          state[tableName].push(saved);
          return {
            select() {
              return {
                async single() {
                  return { data: JSON.parse(JSON.stringify(saved)), error: null };
                }
              };
            }
          };
        }
      };
    },
    async rpc(name, args) {
      state.rpcCalls.push({ name, args: JSON.parse(JSON.stringify(args)) });
      return state.rpcResult;
    }
  };
}

function createService(options = {}) {
  const client = options.client || createFakeClient();
  const authIdentity = options.authIdentity || { type: "authenticated", userId: "auth-user-1" };
  const service = createAccountBindingService({
    aiAuthResolver: {
      resolveIdentity: async () => authIdentity
    },
    env: {
      ACCOUNT_BINDING_TOKEN_SECRET: "binding-secret",
      WECHAT_SESSION_HASH_SECRET: "wechat-session-secret"
    },
    getAdminClient: () => client,
    now: () => new Date("2026-07-28T12:00:00.000Z"),
    verifyWechatRequest: async () => ({
      wechatAccountId: "wechat-account-1",
      account: { mode: "wechat", authenticated: true, cloudSyncAvailable: true }
    })
  });
  return { client, service };
}

test("normalizeBindingCode removes spaces and hyphens and uppercases safely", () => {
  assert.equal(normalizeBindingCode(" abcd-2345 ef "), "ABCD2345EF");
});

test("web users generate a one-time WeChat binding code without storing plaintext", async () => {
  const { client, service } = createService();

  const result = await service.createWebToken(createRequest({ token: "supabase-token" }));

  assert.match(result.bindingCode, /^[A-Z0-9]{10}$/);
  assert.equal(result.expiresAt, "2026-07-28T12:10:00.000Z");
  assert.equal(result.status, "created");
  assert.equal(client.state.upserts[0].tableName, "app_users");
  assert.equal(client.state.upserts[0].row.id, "auth-user-1");
  assert.equal(client.state.inserts[0].tableName, "account_binding_tokens");
  assert.equal(client.state.inserts[0].row.target_app_user_id, "auth-user-1");
  assert.notEqual(client.state.inserts[0].row.token_hash, result.bindingCode);
  assert.equal(client.state.inserts[0].row.used_at, null);
  assert.equal(client.state.inserts[0].row.failed_attempts, 0);
});

test("web binding token generation rejects guests and invalid Supabase sessions", async () => {
  const { service } = createService({ authIdentity: { type: "guest", userId: "" } });

  await assert.rejects(
    () => service.createWebToken(createRequest()),
    (error) => error.code === "AUTH_INVALID" && error.status === 401
  );
});

test("mini program confirmation ignores client user ids and requires explicit merge confirmation", async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.confirmMiniProgramBinding(createRequest({
      token: "wechat-session-token",
      body: { bindingCode: "ABCD2345EF", confirmMerge: true, userId: "forged-user" }
    })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );

  await assert.rejects(
    () => service.confirmMiniProgramBinding(createRequest({
      token: "wechat-session-token",
      body: { bindingCode: "ABCD2345EF", confirmMerge: false }
    })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );
});

test("mini program confirmation calls the transaction RPC with hashed code and WeChat account id", async () => {
  const { client, service } = createService();

  const result = await service.confirmMiniProgramBinding(createRequest({
    token: "wechat-session-token",
    body: { bindingCode: "ABCD-2345-EF", confirmMerge: true }
  }));

  assert.equal(result.status, "bound");
  assert.equal(result.message, "已完成账户绑定，梦境记录已合并。");
  assert.equal(client.state.rpcCalls.length, 1);
  assert.equal(client.state.rpcCalls[0].name, "confirm_wechat_account_binding");
  assert.notEqual(client.state.rpcCalls[0].args.p_token_hash, "ABCD2345EF");
  assert.equal(client.state.rpcCalls[0].args.p_wechat_account_id, "wechat-account-1");
  assert.equal(client.state.rpcCalls[0].args.p_now, "2026-07-28T12:00:00.000Z");
});

test("mini program confirmation maps expired used and competing binding errors safely", async () => {
  const cases = [
    ["binding_token_expired", "ACCOUNT_BINDING_INVALID", 400],
    ["binding_token_used", "ACCOUNT_BINDING_INVALID", 400],
    ["binding_token_locked", "ACCOUNT_BINDING_INVALID", 400],
    ["wechat_account_already_bound", "ACCOUNT_ALREADY_BOUND", 409]
  ];

  for (const [message, code, status] of cases) {
    const client = createFakeClient({ rpcResult: { data: null, error: { message } } });
    const { service } = createService({ client });
    await assert.rejects(
      () => service.confirmMiniProgramBinding(createRequest({
        token: "wechat-session-token",
        body: { bindingCode: "ABCD2345EF", confirmMerge: true }
      })),
      (error) => error.code === code && error.status === status && !/auth-user|wechat-account|ABCD/.test(error.message)
    );
  }
});

test("mini program confirmation maps persisted failed-attempt RPC results safely", async () => {
  const client = createFakeClient({
    rpcResult: {
      data: { status: "error", errorCode: "binding_token_locked" },
      error: null
    }
  });
  const { service } = createService({ client });

  await assert.rejects(
    () => service.confirmMiniProgramBinding(createRequest({
      token: "wechat-session-token",
      body: { bindingCode: "WRONG2345", confirmMerge: true }
    })),
    (error) => error.code === "ACCOUNT_BINDING_INVALID" && error.status === 400
  );

  assert.equal(client.state.rpcCalls.length, 1);
  assert.notEqual(client.state.rpcCalls[0].args.p_token_hash, "WRONG2345");
});

test("binding status returns only safe bound or unbound state", async () => {
  const client = createFakeClient({
    app_users: [{ id: "auth-user-1", supabase_user_id: "auth-user-1", wechat_account_id: "wechat-account-1" }]
  });
  const { service } = createService({ client });

  const status = await service.getWebStatus(createRequest({ token: "supabase-token" }));

  assert.deepEqual(status, { status: "bound" });
});
