const { createApiError } = require("./aiErrors");
const {
  assertWechatAuthConfigured,
  createWechatIdentityClient,
  createWechatIdentityHash,
  validateWechatCode
} = require("./wechatIdentity");
const { createSafeAccount, createWechatSessionStore } = require("./wechatSession");

const minuteMs = 60 * 1000;

function toPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function getRequestIp(request) {
  return (request && (request.ip || (request.socket && request.socket.remoteAddress))) || "unknown";
}

function createLoginLimiter({ env = process.env, now = () => new Date() } = {}) {
  const maxPerMinute = toPositiveInteger(env.WECHAT_LOGIN_REQUESTS_PER_MINUTE, 5);
  const attempts = new Map();

  function getNowMs() {
    const value = now();
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
  }

  function check(request) {
    const current = getNowMs();
    const key = `wechat-login:${getRequestIp(request)}`;
    const records = (attempts.get(key) || []).filter((timestamp) => current - timestamp < minuteMs);

    if (records.length >= maxPerMinute) {
      const retryAfter = Math.max(1, Math.ceil((minuteMs - (current - records[0])) / 1000));
      throw createApiError("RATE_LIMITED", "请求太频繁了，请稍后再试。", 429, { retryAfter });
    }

    records.push(current);
    attempts.set(key, records);
  }

  return { check };
}

function assertAdminClient(client) {
  if (!client) {
    throw createApiError("WECHAT_AUTH_UNAVAILABLE", "微信身份服务暂时不可用，请稍后再试。", 503);
  }
}

function assertSupabaseSuccess(response) {
  if (response && response.error) {
    throw createApiError("INTERNAL_ERROR", "服务暂时遇到问题，请稍后再试。", 500);
  }
}

function createWechatAuthService(options = {}) {
  const env = options.env || process.env;
  const getAdminClient = options.getAdminClient || function () { return null; };
  const now = typeof options.now === "function" ? options.now : () => new Date();
  const identityClient = options.identityClient || createWechatIdentityClient({
    env,
    fetchImpl: options.fetchImpl || fetch
  });
  const loginLimiter = options.loginLimiter || createLoginLimiter({ env, now });

  function getClient() {
    assertWechatAuthConfigured(env);
    const client = getAdminClient();
    assertAdminClient(client);
    return client;
  }

  function getNowIso() {
    const value = now();
    return (value instanceof Date ? value : new Date(value)).toISOString();
  }

  async function findAccount(client, openidHash) {
    const response = await client
      .from("wechat_accounts")
      .select("id, disabled_at")
      .eq("app_id", env.WECHAT_MINIPROGRAM_APP_ID)
      .eq("openid_hash", openidHash)
      .maybeSingle();
    assertSupabaseSuccess(response);
    return response.data || null;
  }

  async function createAccount(client, hashes) {
    const response = await client
      .from("wechat_accounts")
      .insert({
        app_id: env.WECHAT_MINIPROGRAM_APP_ID,
        openid_hash: hashes.openidHash,
        unionid_hash: hashes.unionidHash,
        linked_supabase_user_id: null,
        created_at: getNowIso(),
        last_login_at: getNowIso()
      })
      .select("id, disabled_at")
      .single();
    assertSupabaseSuccess(response);
    return response.data;
  }

  async function touchAccountLogin(client, accountId) {
    try {
      await client
        .from("wechat_accounts")
        .update({ last_login_at: getNowIso() })
        .eq("id", accountId);
    } catch (error) {
      // Last-login telemetry should not block a valid login.
    }
  }

  async function login(request) {
    loginLimiter.check(request);
    const code = validateWechatCode(request && request.body ? request.body.code : "");
    const client = getClient();
    const identity = await identityClient.exchangeCode(code);
    const hashes = createWechatIdentityHash({
      appId: env.WECHAT_MINIPROGRAM_APP_ID,
      openid: identity.openid,
      unionid: identity.unionid,
      secret: env.WECHAT_IDENTITY_HASH_SECRET
    });

    let account = await findAccount(client, hashes.openidHash);
    if (!account) {
      account = await createAccount(client, hashes);
    } else if (account.disabled_at) {
      throw createApiError("AUTH_INVALID", "微信登录状态已失效，请重新登录。", 401);
    } else {
      await touchAccountLogin(client, account.id);
    }

    const sessionStore = createWechatSessionStore({ client, env, now });
    const session = await sessionStore.createSession(account.id);

    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      account: createSafeAccount()
    };
  }

  async function getSession(request) {
    const client = getClient();
    return createWechatSessionStore({ client, env, now }).verifyRequest(request);
  }

  async function logout(request) {
    const client = getClient();
    return createWechatSessionStore({ client, env, now }).revokeRequest(request);
  }

  return {
    getSession,
    login,
    logout
  };
}

module.exports = {
  createLoginLimiter,
  createWechatAuthService
};
