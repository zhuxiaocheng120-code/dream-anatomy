const { createClient: defaultCreateClient } = require("@supabase/supabase-js");
const { createApiError } = require("./aiErrors");

function getHeader(request, name) {
  const headers = request && request.headers ? request.headers : {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "";
}

function getRequestIp(request) {
  return (request && (request.ip || (request.socket && request.socket.remoteAddress))) || "unknown";
}

function createAiAuthResolver({ createClient = defaultCreateClient, env = process.env } = {}) {
  let supabaseClient = null;

  function getServerClient() {
    if (supabaseClient) return supabaseClient;

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw createApiError("INTERNAL_ERROR", "服务暂时遇到问题，请稍后再试。", 500);
    }

    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    return supabaseClient;
  }

  async function resolveIdentity(request) {
    const authorization = String(getHeader(request, "authorization") || "").trim();

    if (!authorization) {
      const ip = getRequestIp(request);
      return {
        type: "guest",
        userId: "",
        rateLimitKey: `guest:${ip}`
      };
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1].trim()) {
      throw createApiError("AUTH_INVALID", "登录状态已失效，请重新登录。", 401);
    }

    const token = match[1].trim();
    let result = null;

    try {
      result = await getServerClient().auth.getUser(token);
    } catch (error) {
      throw createApiError("AUTH_INVALID", "登录状态已失效，请重新登录。", 401);
    }

    const user = result && result.data ? result.data.user : null;
    if ((result && result.error) || !user || !user.id) {
      throw createApiError("AUTH_INVALID", "登录状态已失效，请重新登录。", 401);
    }

    return {
      type: "authenticated",
      userId: user.id,
      rateLimitKey: `user:${user.id}`
    };
  }

  return {
    resolveIdentity
  };
}

module.exports = {
  createAiAuthResolver
};
