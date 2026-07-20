const crypto = require("node:crypto");
const { createApiError } = require("./aiErrors");

const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;

function getHeader(request, name) {
  const headers = request && request.headers ? request.headers : {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "";
}

function getBearerToken(request) {
  const authorization = String(getHeader(request, "authorization") || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match && match[1] ? match[1].trim() : "";
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function createWechatSessionHash(token, secret) {
  if (!token || !secret) {
    throw createApiError("WECHAT_AUTH_UNAVAILABLE", "微信身份服务暂时不可用，请稍后再试。", 503);
  }

  return crypto.createHmac("sha256", secret).update(`wechat-session:${token}`).digest("hex");
}

function createSafeAccount() {
  return {
    mode: "wechat",
    authenticated: true,
    cloudSyncAvailable: false
  };
}

function assertClient(client) {
  if (!client) {
    throw createApiError("WECHAT_AUTH_UNAVAILABLE", "微信身份服务暂时不可用，请稍后再试。", 503);
  }
}

function createWechatSessionStore({ client, env = process.env, now = () => new Date() } = {}) {
  function getNowDate() {
    const value = now();
    return value instanceof Date ? value : new Date(value);
  }

  function createHash(token) {
    return createWechatSessionHash(token, env.WECHAT_SESSION_HASH_SECRET);
  }

  async function createSession(accountId) {
    assertClient(client);
    if (!accountId) {
      throw createApiError("INTERNAL_ERROR", "服务暂时遇到问题，请稍后再试。", 500);
    }

    const createdAt = getNowDate();
    const expiresAt = new Date(createdAt.getTime() + sessionTtlMs);
    const sessionToken = createSessionToken();
    const tokenHash = createHash(sessionToken);
    const response = await client
      .from("wechat_sessions")
      .insert({
        account_id: accountId,
        token_hash: tokenHash,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString()
      })
      .select("id, expires_at")
      .single();

    if (response && response.error) {
      throw createApiError("INTERNAL_ERROR", "服务暂时遇到问题，请稍后再试。", 500);
    }

    return {
      sessionToken,
      expiresAt: expiresAt.toISOString()
    };
  }

  async function findSession(token) {
    assertClient(client);
    if (!token) {
      throw createApiError("AUTH_INVALID", "微信登录状态已失效，请重新登录。", 401);
    }

    const tokenHash = createHash(token);
    const sessionResponse = await client
      .from("wechat_sessions")
      .select("account_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    const session = sessionResponse && sessionResponse.data;
    if ((sessionResponse && sessionResponse.error) || !session) {
      throw createApiError("AUTH_INVALID", "微信登录状态已失效，请重新登录。", 401);
    }

    return { session, tokenHash };
  }

  async function verifySession(token) {
    const { session, tokenHash } = await findSession(token);
    const current = getNowDate();

    if (session.revoked_at || new Date(session.expires_at).getTime() <= current.getTime()) {
      throw createApiError("AUTH_INVALID", "微信登录状态已失效，请重新登录。", 401);
    }

    const accountResponse = await client
      .from("wechat_accounts")
      .select("id, disabled_at")
      .eq("id", session.account_id)
      .maybeSingle();
    const account = accountResponse && accountResponse.data;

    if ((accountResponse && accountResponse.error) || !account || account.disabled_at) {
      throw createApiError("AUTH_INVALID", "微信登录状态已失效，请重新登录。", 401);
    }

    try {
      await client
        .from("wechat_sessions")
        .update({ last_seen_at: current.toISOString() })
        .eq("token_hash", tokenHash);
    } catch (error) {
      // Best-effort presence update only; identity verification already succeeded.
    }

    return {
      account: createSafeAccount(),
      expiresAt: new Date(session.expires_at).toISOString(),
      wechatAccountId: account.id
    };
  }

  async function revokeSession(token) {
    assertClient(client);
    if (!token) {
      return { ok: true };
    }

    const tokenHash = createHash(token);
    try {
      const response = await client
        .from("wechat_sessions")
        .update({ revoked_at: getNowDate().toISOString() })
        .eq("token_hash", tokenHash);
      if (response && response.error) {
        throw response.error;
      }
    } catch (error) {
      throw createApiError("INTERNAL_ERROR", "微信身份退出暂时没有完成，请稍后再试。", 500);
    }

    return { ok: true };
  }

  function verifyRequest(request) {
    return verifySession(getBearerToken(request));
  }

  function revokeRequest(request) {
    return revokeSession(getBearerToken(request));
  }

  return {
    createSession,
    revokeRequest,
    revokeSession,
    verifyRequest,
    verifySession
  };
}

module.exports = {
  createSafeAccount,
  createSessionToken,
  createWechatSessionHash,
  createWechatSessionStore,
  getBearerToken
};
