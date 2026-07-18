const assert = require("node:assert/strict");
const test = require("node:test");

const LegalDocuments = require("../src/legalDocuments");

test("legal documents expose stable versions and configured support email", () => {
  const versions = LegalDocuments.getLegalVersions();
  assert.match(versions.privacyPolicyVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(versions.termsVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(versions.aiDisclaimerVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(versions.privacyPolicyVersion, "2026-07-19");
  assert.equal(versions.productAnalyticsVersion, "2026-07-19");
  assert.equal(versions.termsVersion, "2026-07-17");
  assert.equal(versions.aiDisclaimerVersion, "2026-07-17");

  const privacy = LegalDocuments.getLegalDocument("privacy", { PUBLIC_SUPPORT_EMAIL: "support@example.com" });
  assert.equal(privacy.title, "隐私政策");
  assert.equal(privacy.version, versions.privacyPolicyVersion);
  assert.match(JSON.stringify(privacy), /support@example\.com/);
  assert.match(JSON.stringify(privacy), /可选的产品分析/);
  assert.match(JSON.stringify(privacy), /梦境正文|邮箱|raw IP|User-Agent|token|UUID/);
});

test("legal documents do not make forbidden legal or privacy claims", () => {
  const all = ["privacy", "terms", "ai"].map((type) =>
    JSON.stringify(LegalDocuments.getLegalDocument(type, {}))
  ).join("\n");

  assert.doesNotMatch(all, /永久保存|永不删除|完全匿名|律师审核/);
  assert.match(all, /Beta 技术版本/);
  assert.match(all, /联系方式尚未配置/);
  assert.match(all, /不构成心理诊断/);
  assert.match(all, /不构成治疗建议/);
  assert.match(all, /不构成未来预测/);
});

test("hasAcceptedVersions checks all current legal versions", () => {
  const versions = LegalDocuments.getLegalVersions();
  assert.equal(LegalDocuments.hasAcceptedVersions({
    privacy_policy_version: versions.privacyPolicyVersion,
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion
  }), true);
  assert.equal(LegalDocuments.hasAcceptedVersions({
    privacy_policy_version: "old",
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion
  }), false);
});
