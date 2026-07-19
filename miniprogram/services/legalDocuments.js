const LEGAL_CONSENT_KEY = "dream_anatomy_guest_legal_consent_v1";
const PRIVACY_POLICY_VERSION = "2026-07-19";
const TERMS_VERSION = "2026-07-17";
const AI_DISCLAIMER_VERSION = "2026-07-17";

function createSection(title, paragraphs) {
  return {
    title,
    paragraphs: Array.isArray(paragraphs) ? paragraphs : [paragraphs]
  };
}

function getLegalVersions() {
  return {
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    termsVersion: TERMS_VERSION,
    aiDisclaimerVersion: AI_DISCLAIMER_VERSION
  };
}

function getLegalDocument(type) {
  if (type === "terms") {
    return {
      type: "terms",
      title: "用户协议",
      version: TERMS_VERSION,
      sections: [
        createSection("产品定位", "Dream Anatomy 是梦境记录和自我探索工具，不是心理诊断、心理治疗、算命、吉凶判断或未来预测服务。"),
        createSection("游客版边界", "当前小程序为免费游客版基础体验，梦境只保存在本机，功能和可用性可能调整。"),
        createSection("内容责任", "请不要输入身份证、手机号、住址等与梦境记录无关的敏感信息。你需要对自己输入的内容负责。")
      ]
    };
  }
  if (type === "ai") {
    return {
      type: "ai",
      title: "AI 使用说明",
      version: AI_DISCLAIMER_VERSION,
      sections: [
        createSection("AI 内容性质", "AI 解析只是梦境自我探索视角，不构成心理诊断、治疗建议或未来预测。"),
        createSection("理解方式", "AI 可能产生错误或遗漏，请结合自己的真实感受谨慎理解。"),
        createSection("安全提醒", "如果梦境或情绪长期困扰你，可以考虑寻求合格专业人士支持。")
      ]
    };
  }
  return {
    type: "privacy",
    title: "隐私政策",
    version: PRIVACY_POLICY_VERSION,
    sections: [
      createSection("我们处理哪些数据", "小程序游客版会在本机保存你主动输入的梦境正文、睡眠质量、AI 分析结果和梦境画像。"),
      createSection("AI 请求", "快速解析会调用现有 Render 后端，再由后端安全调用 AI 服务。小程序不保存 API key，也不直接调用 DeepSeek。"),
      createSection("本机数据控制", "你可以在隐私与数据页面导出或清除本机梦境数据。")
    ]
  };
}

function readConsent(wxRef) {
  try {
    const value = wxRef.getStorageSync(LEGAL_CONSENT_KEY);
    return value && typeof value === "object" ? value : null;
  } catch (error) {
    return null;
  }
}

function hasAcceptedLegalVersions(wxRef) {
  const consent = readConsent(wxRef);
  const versions = getLegalVersions();
  return Boolean(
    consent
      && consent.privacyPolicyVersion === versions.privacyPolicyVersion
      && consent.termsVersion === versions.termsVersion
      && consent.aiDisclaimerVersion === versions.aiDisclaimerVersion
  );
}

function saveGuestLegalConsent(wxRef) {
  const consent = {
    ...getLegalVersions(),
    acceptedAt: new Date().toISOString()
  };
  wxRef.setStorageSync(LEGAL_CONSENT_KEY, consent);
  return consent;
}

module.exports = {
  LEGAL_CONSENT_KEY,
  getLegalDocument,
  getLegalVersions,
  hasAcceptedLegalVersions,
  saveGuestLegalConsent
};
