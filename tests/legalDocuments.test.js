const assert = require("node:assert/strict");
const test = require("node:test");

const LegalDocuments = require("../src/legalDocuments");

test("legal documents expose stable versions and configured support email", () => {
  const versions = LegalDocuments.getLegalVersions();
  assert.match(versions.privacyPolicyVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(versions.termsVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(versions.aiDisclaimerVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(versions.crossBorderConsentVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(versions.privacyPolicyVersion, "2026-07-21");
  assert.equal(versions.productAnalyticsVersion, "2026-07-19");
  assert.equal(versions.termsVersion, "2026-07-21");
  assert.equal(versions.aiDisclaimerVersion, "2026-07-21");
  assert.equal(versions.crossBorderConsentVersion, "2026-07-21");

  const privacy = LegalDocuments.getLegalDocument("privacy", { PUBLIC_SUPPORT_EMAIL: "support@example.com", PUBLIC_OPERATOR_NAME: "测试运营者" });
  assert.equal(privacy.title, "Dream Anatomy 隐私政策");
  assert.equal(privacy.version, versions.privacyPolicyVersion);
  assert.equal(privacy.effectiveDate, "2026-07-21");
  assert.match(JSON.stringify(privacy), /测试运营者/);
  assert.match(JSON.stringify(privacy), /support@example\.com/);
  assert.match(JSON.stringify(privacy), /可选的产品分析/);
  assert.match(JSON.stringify(privacy), /梦境正文|邮箱|raw IP|User-Agent|token|UUID/);
});

test("public beta legal documents include operator provider and cross-border facts", () => {
  const runtimeEnv = {};
  const privacy = JSON.stringify(LegalDocuments.getLegalDocument("privacy", runtimeEnv));
  const terms = JSON.stringify(LegalDocuments.getLegalDocument("terms", runtimeEnv));
  const ai = JSON.stringify(LegalDocuments.getLegalDocument("ai", runtimeEnv));
  const all = [privacy, terms, ai].join("\n");

  assert.match(all, /朱校成/);
  assert.match(all, /个人运营者/);
  assert.match(all, /zhuxiaocheng120@gmail\.com/);
  assert.match(privacy, /美国俄勒冈州（Oregon, US West）/);
  assert.match(privacy, /印度孟买（South Asia \/ Mumbai，ap-south-1）/);
  assert.match(privacy, /DeepSeek/);
  assert.match(privacy, /境外处理和单独同意/);
  assert.match(privacy, /未成年人/);
  assert.match(terms, /在适用法律允许的最大范围内/);
  assert.match(terms, /依法不得排除或限制的责任/);
  assert.match(ai, /DeepSeek API/);
  assert.match(ai, /有限线索模式/);
});

test("legal documents do not make forbidden legal or privacy claims", () => {
  const all = ["privacy", "terms", "ai"].map((type) =>
    JSON.stringify(LegalDocuments.getLegalDocument(type, {}))
  ).join("\n");

  assert.doesNotMatch(all, /永久保存|永不删除|完全匿名|律师审核|正式发布前仍需完成专业法律审阅/);
  assert.doesNotMatch(all, /无论任何原因.*不承担责任/);
  assert.match(all, /当前公开测试版本/);
  assert.doesNotMatch(all, /联系方式尚未配置/);
  assert.match(all, /不构成心理诊断/);
  assert.match(all, /不构成治疗建议/);
  assert.match(all, /不构成未来预测/);
});

test("hasAcceptedVersions checks all current legal versions", () => {
  const versions = LegalDocuments.getLegalVersions();
  assert.equal(LegalDocuments.hasAcceptedVersions({
    privacy_policy_version: versions.privacyPolicyVersion,
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion,
    cross_border_consent_version: versions.crossBorderConsentVersion
  }), true);
  assert.equal(LegalDocuments.hasAcceptedVersions({
    privacy_policy_version: "old",
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion,
    cross_border_consent_version: versions.crossBorderConsentVersion
  }), false);
  assert.equal(LegalDocuments.hasAcceptedVersions({
    privacy_policy_version: versions.privacyPolicyVersion,
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion
  }), false);
});
