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

  return {
    requireAdminIdentity
  };
}

module.exports = {
  createAdminAuth,
  parseAdminUserIds
};
