const { createClient: defaultCreateClient } = require("@supabase/supabase-js");
const LegalDocuments = require("../src/legalDocuments");
const { createApiError } = require("./aiErrors");

function getAuthorizationToken(request) {
  const headers = request && request.headers ? request.headers : {};
  const authorization = String(headers.authorization || headers.Authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match && match[1] ? match[1].trim() : "";
}

function hasCurrentLegalConsent(row, versions = LegalDocuments.getLegalVersions()) {
  return Boolean(
    row
      && row.privacy_policy_version === versions.privacyPolicyVersion
      && row.terms_version === versions.termsVersion
      && row.ai_disclaimer_version === versions.aiDisclaimerVersion
      && row.cross_border_consent_version === versions.crossBorderConsentVersion
  );
}

function createLegalConsentVerifier({ createClient = defaultCreateClient, env = process.env, versions = LegalDocuments.getLegalVersions() } = {}) {
  async function ensureAccepted({ request, identity }) {
    if (!identity || identity.type !== "authenticated") {
      return true;
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw createApiError("INTERNAL_ERROR", "服务暂时遇到问题，请稍后再试。", 500);
    }

    const token = getAuthorizationToken(request);
    if (!token) {
      throw createApiError("AUTH_INVALID", "登录状态已失效，请重新登录。", 401);
    }

    const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const result = await client
      .from("legal_consents")
      .select("privacy_policy_version,terms_version,ai_disclaimer_version,cross_border_consent_version")
      .eq("user_id", identity.userId)
      .maybeSingle();

    if (result.error) {
      throw createApiError("INTERNAL_ERROR", "服务暂时遇到问题，请稍后再试。", 500);
    }

    if (!hasCurrentLegalConsent(result.data, versions)) {
      throw createApiError("LEGAL_CONSENT_REQUIRED", "请先确认当前版本的用户协议、隐私政策、AI 使用说明和境外处理说明。", 403);
    }

    return true;
  }

  return { ensureAccepted };
}

module.exports = {
  createLegalConsentVerifier,
  hasCurrentLegalConsent
};
