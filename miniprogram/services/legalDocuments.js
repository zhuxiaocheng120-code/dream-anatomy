const LEGAL_CONSENT_KEY = "dream_anatomy_guest_legal_consent_v1";
const PRIVACY_POLICY_VERSION = "2026-07-21";
const TERMS_VERSION = "2026-07-21";
const AI_DISCLAIMER_VERSION = "2026-07-21";
const CROSS_BORDER_CONSENT_VERSION = "2026-07-21";

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
    aiDisclaimerVersion: AI_DISCLAIMER_VERSION,
    crossBorderConsentVersion: CROSS_BORDER_CONSENT_VERSION
  };
}

function getLegalDocument(type) {
  if (type === "terms") {
    return {
      type: "terms",
      title: "用户协议",
      version: TERMS_VERSION,
      sections: [
        createSection("适用范围", "本文件适用于 Dream Anatomy 当前公开测试版本。运营者为朱校成，主体类型为个人运营者，联系邮箱为 zhuxiaocheng120@gmail.com。"),
        createSection("产品定位", "Dream Anatomy 是梦境记录、睡眠感受记录与 AI 辅助文字整理工具。本功能不是解梦、算命、占卜、吉凶判断或未来预测服务。"),
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
        createSection("当前模型", "当前主要通过 Dream Anatomy 后端调用 DeepSeek API 完成用户主动请求的 AI 辅助文字整理。"),
        createSection("AI 内容性质", "AI 只会依据你主动提交的梦境文字进行摘要整理、情绪词识别、意象关键词整理，并生成开放式自我反思问题。"),
        createSection("边界说明", "本功能不是解梦、算命、占卜、吉凶判断或未来预测服务；AI 输出不代表梦境符号有固定含义，也不是心理诊断、心理治疗或医疗建议。"),
        createSection("理解方式", "AI 可能产生错误或遗漏，请结合自己的真实感受谨慎理解。"),
        createSection("安全提醒", "如果梦境或情绪长期困扰你，可以考虑寻求合格专业人士支持。")
      ]
    };
  }
  if (type === "cross-border") {
    return {
      type: "cross-border",
      title: "境外处理说明",
      version: CROSS_BORDER_CONSENT_VERSION,
      sections: [
        createSection("必要处理", "为提供 Dream Anatomy 服务，账户、存储和 AI 整理请求可能通过位于美国俄勒冈州的 Render 服务和印度孟买的 Supabase 项目处理或存储。"),
        createSection("AI 请求", "当你主动提交 AI 整理时，必要的梦境内容会经 Dream Anatomy 后端发送至 DeepSeek API，用于生成本次文字整理。"),
        createSection("单独同意", "你可以选择不勾选单独同意；未同意时不会开始 AI 辅助文字整理。")
      ]
    };
  }
  return {
    type: "privacy",
    title: "隐私政策",
    version: PRIVACY_POLICY_VERSION,
    sections: [
      createSection("运营者和联系方式", "运营者：朱校成。主体类型：个人运营者。联系邮箱：zhuxiaocheng120@gmail.com。"),
      createSection("我们处理哪些数据", "小程序游客版会在本机保存你主动输入的梦境正文、睡眠质量、AI 辅助整理结果和梦境线索卡。"),
      createSection("服务提供方和地区", "Render 提供 Web 和 API 服务，当前部署在美国俄勒冈州；Supabase 项目地区为印度孟买；DeepSeek API 用于生成用户主动请求的 AI 辅助文字整理；微信用于小程序身份验证。"),
      createSection("AI 请求", "AI 整理会调用现有 Render 后端，再由后端安全调用 DeepSeek API。小程序不保存 API key，也不直接调用 DeepSeek。"),
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
      && consent.crossBorderConsentVersion === versions.crossBorderConsentVersion
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
