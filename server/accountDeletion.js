const crypto = require("node:crypto");
const { createApiError } = require("./aiErrors");
const { deleteProductEventsForIdentity } = require("./productAnalytics");

const requiredConfirmationText = "注销账户";

function createAuthenticatedPrincipalHash(userId, secret) {
  if (!secret) {
    return null;
  }

  return crypto.createHmac("sha256", secret).update(`user:${userId}`).digest("hex");
}

function assertDeleteSuccess(response, requestId) {
  if (response && response.error) {
    throw createApiError("ACCOUNT_DELETION_FAILED", "账户注销暂时没有完成，请稍后重试。", 500, { requestId });
  }
}

async function deleteFromTable(client, tableName, filters, requestId) {
  let query = client.from(tableName).delete();
  filters.forEach(({ column, value }) => {
    query = query.eq(column, value);
  });
  const response = await query;
  assertDeleteSuccess(response, requestId);
}

function createAccountDeletionService(options = {}) {
  const aiAuthResolver = options.aiAuthResolver;
  const env = options.env || process.env;
  const getAdminClient = options.getAdminClient || function () { return null; };
  const requestIdFactory = options.requestIdFactory || function () {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  };

  async function deleteAccount(request) {
    const requestId = requestIdFactory();
    const identity = await aiAuthResolver.resolveIdentity(request);

    if (!identity || identity.type !== "authenticated" || !identity.userId) {
      throw createApiError("AUTH_INVALID", "请先登录后再注销账户。", 401, { requestId });
    }

    const confirmation = request && request.body ? request.body.confirmation : "";
    if (confirmation !== requiredConfirmationText) {
      throw createApiError("INVALID_REQUEST", "请输入正确确认文字后再注销账户。", 400, { requestId });
    }

    const client = getAdminClient();
    const analyticsSecret = env.ANALYTICS_HASH_SECRET || "";

    if (!client) {
      throw createApiError("ANALYTICS_UNAVAILABLE", "账户注销暂时不可用，请检查服务端配置。", 503, { requestId });
    }

    const authAdmin = client.auth && client.auth.admin;
    if (!authAdmin || typeof authAdmin.deleteUser !== "function") {
      throw createApiError("ACCOUNT_DELETION_FAILED", "账户注销暂时没有完成，请稍后重试。", 500, { requestId });
    }

    const principalHash = createAuthenticatedPrincipalHash(identity.userId, analyticsSecret);

    if (principalHash) {
      await deleteFromTable(client, "ai_usage_events", [
        { column: "principal_type", value: "authenticated" },
        { column: "principal_hash", value: principalHash }
      ], requestId);

      const productEventsResult = await deleteProductEventsForIdentity(
        client,
        identity,
        null,
        analyticsSecret
      );
      if (!productEventsResult.deleted) {
        throw createApiError("ACCOUNT_DELETION_FAILED", "账户注销暂时没有完成，请稍后重试。", 500, { requestId });
      }
    }

    const authResponse = await authAdmin.deleteUser(identity.userId);
    assertDeleteSuccess(authResponse, requestId);

    await deleteFromTable(client, "product_analytics_preferences", [
      { column: "user_id", value: identity.userId }
    ], requestId);
    await deleteFromTable(client, "legal_consents", [
      { column: "user_id", value: identity.userId }
    ], requestId);
    await deleteFromTable(client, "dream_records", [
      { column: "user_id", value: identity.userId }
    ], requestId);

    return { ok: true, requestId };
  }

  return {
    deleteAccount
  };
}

module.exports = {
  createAccountDeletionService,
  createAuthenticatedPrincipalHash
};
