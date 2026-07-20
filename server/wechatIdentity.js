const crypto = require("node:crypto");
const { createApiError } = require("./aiErrors");

const codePattern = /^[A-Za-z0-9_-]{1,256}$/;
const defaultWechatApiBaseUrl = "https://api.weixin.qq.com";

function assertWechatAuthConfigured(env = process.env) {
  if (
    !env.WECHAT_MINIPROGRAM_APP_ID ||
    !env.WECHAT_MINIPROGRAM_APP_SECRET ||
    !env.WECHAT_IDENTITY_HASH_SECRET ||
    !env.WECHAT_SESSION_HASH_SECRET
  ) {
    throw createApiError("WECHAT_AUTH_UNAVAILABLE", "微信身份服务暂时不可用，请稍后再试。", 503);
  }
}

function validateWechatCode(code) {
  const normalized = typeof code === "string" ? code.trim() : "";
  if (!codePattern.test(normalized)) {
    throw createApiError("INVALID_REQUEST", "微信登录凭证无效，请重新尝试。", 400);
  }

  return normalized;
}

function hmacHex(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function createWechatIdentityHash({ appId, openid, unionid = "", secret }) {
  if (!secret || !appId || !openid) {
    throw createApiError("WECHAT_AUTH_UNAVAILABLE", "微信身份服务暂时不可用，请稍后再试。", 503);
  }

  return {
    openidHash: hmacHex(secret, `wechat-openid:${appId}:${openid}`),
    unionidHash: unionid ? hmacHex(secret, `wechat-unionid:${unionid}`) : null
  };
}

function createWechatIdentityClient({ env = process.env, fetchImpl = fetch } = {}) {
  async function exchangeCode(code) {
    assertWechatAuthConfigured(env);
    const normalizedCode = validateWechatCode(code);
    const apiBaseUrl = env.WECHAT_API_BASE_URL || defaultWechatApiBaseUrl;
    const url = new URL("/sns/jscode2session", apiBaseUrl);
    url.searchParams.set("appid", env.WECHAT_MINIPROGRAM_APP_ID);
    url.searchParams.set("secret", env.WECHAT_MINIPROGRAM_APP_SECRET);
    url.searchParams.set("js_code", normalizedCode);
    url.searchParams.set("grant_type", "authorization_code");

    let response;
    try {
      response = await fetchImpl(url.toString(), { method: "GET" });
    } catch (error) {
      throw createApiError("UPSTREAM_UNAVAILABLE", "微信身份服务暂时不可用，请稍后再试。", 502);
    }

    if (!response || !response.ok) {
      throw createApiError("UPSTREAM_UNAVAILABLE", "微信身份服务暂时不可用，请稍后再试。", 502);
    }

    const data = await response.json();
    if (!data || data.errcode || typeof data.openid !== "string" || !data.openid.trim()) {
      throw createApiError("AUTH_INVALID", "微信登录凭证无效，请重新尝试。", 401);
    }

    return {
      openid: data.openid.trim(),
      unionid: typeof data.unionid === "string" && data.unionid.trim() ? data.unionid.trim() : null
    };
  }

  return { exchangeCode };
}

module.exports = {
  assertWechatAuthConfigured,
  createWechatIdentityClient,
  createWechatIdentityHash,
  validateWechatCode
};
