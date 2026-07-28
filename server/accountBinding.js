const crypto = require("node:crypto");
const { createApiError } = require("./aiErrors");
const { createWechatSessionStore, getBearerToken } = require("./wechatSession");

const bindingAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const tokenLength = 10;
const tokenTtlMs = 10 * 60 * 1000;
const minuteMs = 60 * 1000;
const forbiddenClientIdentityFields = ["user_id", "userId", "targetUserId", "target_app_user_id", "email", "openid", "unionid", "accountId"];

function normalizeBindingCode(value) {
  return String(value || "").replace(/[\s-]+/g, "").trim().toUpperCase();
}

function createBindingCode(randomInt = crypto.randomInt) {
  let code = "";
  for (let index = 0; index < tokenLength; index += 1) {
    code += bindingAlphabet[randomInt(0, bindingAlphabet.length)];
  }
  return code;
}

function createRequestCorrelationId() {
  return crypto.randomBytes(12).toString("hex");
}

function createTokenHash(code, secret) {
  if (!secret) {
    throw createApiError("ACCOUNT_BINDING_UNAVAILABLE", "账户绑定服务暂时不可用，请稍后再试。", 503);
  }
  return crypto.createHmac("sha256", secret).update(`account-binding:${normalizeBindingCode(code)}`).digest("hex");
}

function getRequestIp(request) {
  return (request && (request.ip || (request.socket && request.socket.remoteAddress))) || "unknown";
}

function parsePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function createMinuteLimiter({ limit, now = () => new Date() } = {}) {
  const attempts = new Map();

  function getNowMs() {
    const value = now();
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
  }

  function check(key) {
    const current = getNowMs();
    const records = (attempts.get(key) || []).filter((timestamp) => current - timestamp < minuteMs);
    if (records.length >= limit) {
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
    throw createApiError("ACCOUNT_BINDING_UNAVAILABLE", "账户绑定服务暂时不可用，请稍后再试。", 503);
  }
}

function assertSupabaseSuccess(response, message = "账户绑定暂时没有完成，请稍后再试。") {
  if (response && response.error) {
    throw createApiError("INTERNAL_ERROR", message, 500);
  }
  return response ? response.data : null;
}

function assertNoClientIdentity(body = {}) {
  const hasForbidden = forbiddenClientIdentityFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (hasForbidden) {
    throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
  }
}

function mapBindingRpcError(error) {
  const message = String((error && error.message) || "");
  if (/binding_token_(invalid|expired|used|locked)/i.test(message)) {
    return createApiError("ACCOUNT_BINDING_INVALID", "绑定码无效或已过期，请重新生成。", 400);
  }
  if (/wechat_account_already_bound|target_already_bound/i.test(message)) {
    return createApiError("ACCOUNT_ALREADY_BOUND", "这个微信身份已经绑定到其他账户。", 409);
  }
  return createApiError("INTERNAL_ERROR", "账户绑定暂时没有完成，请稍后再试。", 500);
}

function createAccountBindingService(options = {}) {
  const env = options.env || process.env;
  const now = typeof options.now === "function" ? options.now : () => new Date();
  const getAdminClient = options.getAdminClient || function () { return null; };
  const aiAuthResolver = options.aiAuthResolver;
  const verifyWechatRequest = options.verifyWechatRequest || (async (request, client) => (
    createWechatSessionStore({ client, env, now }).verifyRequest(request)
  ));
  const generateLimiter = options.generateLimiter || createMinuteLimiter({
    limit: parsePositiveInteger(env.ACCOUNT_BINDING_GENERATE_PER_MINUTE, 3),
    now
  });
  const confirmLimiter = options.confirmLimiter || createMinuteLimiter({
    limit: parsePositiveInteger(env.ACCOUNT_BINDING_CONFIRM_PER_MINUTE, 5),
    now
  });

  function getClient() {
    const client = getAdminClient();
    assertAdminClient(client);
    return client;
  }

  function getNowDate() {
    const value = now();
    return value instanceof Date ? value : new Date(value);
  }

  async function requireWebIdentity(request) {
    if (!aiAuthResolver || typeof aiAuthResolver.resolveIdentity !== "function") {
      throw createApiError("ACCOUNT_BINDING_UNAVAILABLE", "账户绑定服务暂时不可用，请稍后再试。", 503);
    }
    const identity = await aiAuthResolver.resolveIdentity(request);
    if (!identity || identity.type !== "authenticated" || !identity.userId) {
      throw createApiError("AUTH_INVALID", "请先登录后再绑定微信账户。", 401);
    }
    return identity;
  }

  async function ensureWebAppUser(client, supabaseUserId) {
    const current = getNowDate().toISOString();
    const response = await client
      .from("app_users")
      .upsert({
        id: supabaseUserId,
        supabase_user_id: supabaseUserId,
        updated_at: current
      }, { onConflict: "id" })
      .select("id, supabase_user_id, wechat_account_id")
      .single();
    const row = assertSupabaseSuccess(response);
    if (!row || !row.id) {
      throw createApiError("INTERNAL_ERROR", "账户绑定暂时没有完成，请稍后再试。", 500);
    }
    return row;
  }

  async function getWebAppUser(client, supabaseUserId) {
    const response = await client
      .from("app_users")
      .select("id, supabase_user_id, wechat_account_id")
      .eq("supabase_user_id", supabaseUserId)
      .maybeSingle();
    return assertSupabaseSuccess(response);
  }

  async function createWebToken(request) {
    const identity = await requireWebIdentity(request);
    generateLimiter.check(`web:${identity.userId}`);
    const client = getClient();
    const appUser = await ensureWebAppUser(client, identity.userId);
    const bindingCode = createBindingCode();
    const current = getNowDate();
    const expiresAt = new Date(current.getTime() + tokenTtlMs);
    const tokenHash = createTokenHash(bindingCode, env.ACCOUNT_BINDING_TOKEN_SECRET);
    const response = await client
      .from("account_binding_tokens")
      .insert({
        target_app_user_id: appUser.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        used_at: null,
        failed_attempts: 0,
        created_at: current.toISOString(),
        request_correlation_id: createRequestCorrelationId()
      })
      .select("id")
      .single();
    assertSupabaseSuccess(response);
    return {
      status: "created",
      bindingCode,
      expiresAt: expiresAt.toISOString()
    };
  }

  async function getWebStatus(request) {
    const identity = await requireWebIdentity(request);
    const client = getClient();
    const row = await getWebAppUser(client, identity.userId);
    return {
      status: row && row.wechat_account_id ? "bound" : "unbound"
    };
  }

  async function requireWechatIdentity(request, client) {
    const token = getBearerToken(request);
    if (!token) {
      throw createApiError("AUTH_INVALID", "请先建立微信身份。", 401);
    }
    const session = await verifyWechatRequest(request, client);
    if (!session || !session.wechatAccountId) {
      throw createApiError("AUTH_INVALID", "请先建立微信身份。", 401);
    }
    return session;
  }

  function validateConfirmBody(body = {}) {
    assertNoClientIdentity(body);
    if (body.confirmMerge !== true) {
      throw createApiError("INVALID_REQUEST", "请先确认账户合并说明。", 400);
    }
    const bindingCode = normalizeBindingCode(body.bindingCode);
    if (!/^[A-Z0-9]{8,16}$/.test(bindingCode)) {
      throw createApiError("ACCOUNT_BINDING_INVALID", "绑定码无效或已过期，请重新生成。", 400);
    }
    return bindingCode;
  }

  async function confirmMiniProgramBinding(request) {
    const body = request && request.body ? request.body : {};
    const bindingCode = validateConfirmBody(body);
    confirmLimiter.check(`mini:${getRequestIp(request)}`);
    const client = getClient();
    const session = await requireWechatIdentity(request, client);
    const tokenHash = createTokenHash(bindingCode, env.ACCOUNT_BINDING_TOKEN_SECRET);
    const response = await client.rpc("confirm_wechat_account_binding", {
      p_token_hash: tokenHash,
      p_wechat_account_id: session.wechatAccountId,
      p_now: getNowDate().toISOString()
    });

    if (response && response.error) {
      throw mapBindingRpcError(response.error);
    }
    if (response && response.data && response.data.status === "error") {
      throw mapBindingRpcError({ message: response.data.errorCode });
    }

    return {
      status: "bound",
      message: "已完成账户绑定，梦境记录已合并。",
      merge: response && response.data ? response.data : {}
    };
  }

  async function getMiniProgramStatus(request) {
    const client = getClient();
    const session = await requireWechatIdentity(request, client);
    const response = await client
      .from("app_users")
      .select("id, supabase_user_id")
      .eq("wechat_account_id", session.wechatAccountId)
      .maybeSingle();
    const row = assertSupabaseSuccess(response);
    return {
      status: row && row.supabase_user_id ? "bound" : "unbound"
    };
  }

  return {
    confirmMiniProgramBinding,
    createWebToken,
    getMiniProgramStatus,
    getWebStatus
  };
}

module.exports = {
  createAccountBindingService,
  createBindingCode,
  createTokenHash,
  normalizeBindingCode
};
