(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamLegalDocuments = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const PRIVACY_POLICY_VERSION = "2026-07-19";
  const PRODUCT_ANALYTICS_VERSION = "2026-07-19";
  const TERMS_VERSION = "2026-07-17";
  const AI_DISCLAIMER_VERSION = "2026-07-17";

  function getSupportEmail(runtimeEnv = {}) {
    return runtimeEnv.PUBLIC_SUPPORT_EMAIL || "联系方式尚未配置";
  }

  function getLegalVersions() {
    return {
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      productAnalyticsVersion: PRODUCT_ANALYTICS_VERSION,
      termsVersion: TERMS_VERSION,
      aiDisclaimerVersion: AI_DISCLAIMER_VERSION
    };
  }

  function createSection(heading, body) {
    return {
      heading,
      body: Array.isArray(body) ? body : [body]
    };
  }

  function getPrivacyDocument(runtimeEnv) {
    const supportEmail = getSupportEmail(runtimeEnv);

    return {
      type: "privacy",
      title: "隐私政策",
      version: PRIVACY_POLICY_VERSION,
      note: "这是 Dream Anatomy Web Beta 技术版本文本，正式发布前仍需完成专业法律审阅。",
      sections: [
        createSection("我们收集哪些信息", [
          "为了提供账户、梦境记录、云同步和 AI 解析功能，我们会处理你的邮箱、Supabase 账户标识、梦境正文、睡眠质量、情绪、意象、AI 分析结果和 Dream Result Card。",
          "你不需要输入身份证号、手机号、住址、银行卡号或其他与梦境记录无关的敏感信息。"
        ]),
        createSection("AI 使用统计", [
          "为了服务安全、额度控制、成本估算和运营分析，我们会记录 AI 请求时间、用户类型、analysisType、结果状态、错误码、耗时、模型、Token 用量和可选成本估算。",
          "AI 使用统计不保存梦境正文、邮箱、raw IP、完整 Supabase UUID、access token、refresh token、Authorization header 或完整 AI 回复。",
          "principal_hash 是经过 ANALYTICS_HASH_SECRET 处理的去标识化标识，用于近似独立用户统计、长期趋势和使用频率分析。它不是完全不可关联的数据。"
        ]),
        createSection("可选的产品分析", [
          "产品分析默认关闭。只有你主动开启后，我们才会记录不包含梦境内容的功能使用事件，用于分析产品体验、错误和使用趋势。",
          "产品分析不记录梦境正文、邮箱、raw IP、raw User-Agent、token、完整 UUID 或直接身份关联信息。你可以随时在隐私与数据中心关闭产品分析，并删除可关联的产品分析数据。"
        ]),
        createSection("服务提供方", [
          "Dream Anatomy 当前使用 Supabase 提供账户、认证和云端数据存储能力，使用 Render 承载 Web 服务，使用 DeepSeek 提供 AI 解析能力。",
          "我们不会把服务端密钥放入浏览器运行时配置。"
        ]),
        createSection("导出、删除和注销", [
          "你可以导出自己的梦境数据，删除单条梦境，清空当前账户的梦境记录，或申请注销账户。",
          "注销账户时，系统会删除当前登录账户可关联的梦境记录、法律同意记录和 authenticated AI 使用统计；guest AI 使用统计不会被删除，因为无法可靠证明历史 guest 信号都属于该账户。"
        ]),
        createSection("数据保存原则", [
          "我们会在实现产品功能、服务安全和运营分析目的所必要的期限内保存相关数据。用户主动删除梦境或注销账户时，我们将按照产品功能和适用规则处理相关数据。",
          "如果未来调整保留期限或处理方式，会在隐私政策和部署文档中同步更新。"
        ]),
        createSection("未成年人提示", [
          "如果你是未成年人，请在监护人知情和适当指导下使用本产品，不要输入不必要的个人敏感信息。"
        ]),
        createSection("文件更新和联系", [
          "我们可能随产品功能变化更新本政策。重要版本更新后，登录用户需要重新确认。",
          `联系邮箱：${supportEmail}`
        ])
      ]
    };
  }

  function getTermsDocument(runtimeEnv) {
    const supportEmail = getSupportEmail(runtimeEnv);

    return {
      type: "terms",
      title: "用户协议",
      version: TERMS_VERSION,
      note: "这是 Dream Anatomy Web Beta 技术版本文本，正式发布前仍需完成专业法律审阅。",
      sections: [
        createSection("产品定位", [
          "Dream Anatomy 是梦境记录和自我探索工具，不是心理诊断、心理治疗、算命、吉凶判断或未来预测服务。"
        ]),
        createSection("账户和内容", [
          "你需要对自己输入的内容负责，不应上传违法、侵权、骚扰、恶意攻击或与梦境记录无关的内容。",
          "请妥善管理账户和密码。如果发现异常使用，可以通过公开联系方式联系我们。"
        ]),
        createSection("Beta 服务边界", [
          "当前服务处于免费 Beta 阶段，功能、额度、模型表现和可用性可能调整、暂停或出现错误。",
          "我们会尽量保持服务稳定，但不承诺任何 AI 内容一定准确、完整或适合所有场景。"
        ]),
        createSection("知识产权", [
          "Dream Anatomy 的界面、文案结构和代码属于项目维护方或相应权利人。你保留自己输入梦境内容中的合法权利。"
        ]),
        createSection("服务终止和更新", [
          "如果用户滥用服务、攻击系统、绕过限制或违反本协议，我们可以限制或终止相关使用。",
          "协议版本更新后，可能要求你重新确认后继续使用账户功能。"
        ]),
        createSection("联系方式", [
          `联系邮箱：${supportEmail}`
        ])
      ]
    };
  }

  function getAiDocument(runtimeEnv) {
    const supportEmail = getSupportEmail(runtimeEnv);

    return {
      type: "ai",
      title: "AI 使用说明",
      version: AI_DISCLAIMER_VERSION,
      note: "这是 Dream Anatomy Web Beta 技术版本文本，正式发布前仍需完成专业法律审阅。",
      sections: [
        createSection("AI 内容的性质", [
          "AI 解析只是梦境自我探索视角，不构成心理诊断，不构成治疗建议，也不构成未来预测。",
          "AI 可能产生错误、遗漏或与你真实处境不一致的内容，你需要结合自己的实际感受谨慎理解。"
        ]),
        createSection("安全语言边界", [
          "Dream Anatomy 要求 AI 使用“可能”“也许”“可以理解为”等非绝对表达，不使用恐吓、宿命论或固定人格结论。",
          "AI 不应判断吉凶，不应替代医生、心理咨询师或其他合格专业人士。"
        ]),
        createSection("何时寻求额外支持", [
          "如果梦境或相关情绪让你持续痛苦、影响睡眠或日常生活，你可以考虑寻求合格专业人士支持，或与可信任的人谈谈。",
          "不要把 AI 内容作为重大生活、健康、法律或财务决定的唯一依据。"
        ]),
        createSection("联系", [
          `联系邮箱：${supportEmail}`
        ])
      ]
    };
  }

  function getLegalDocument(type, runtimeEnv = {}) {
    if (type === "terms") return getTermsDocument(runtimeEnv);
    if (type === "ai") return getAiDocument(runtimeEnv);
    return getPrivacyDocument(runtimeEnv);
  }

  function hasAcceptedVersions(consentRow) {
    return Boolean(
      consentRow
        && consentRow.privacy_policy_version === PRIVACY_POLICY_VERSION
        && consentRow.terms_version === TERMS_VERSION
        && consentRow.ai_disclaimer_version === AI_DISCLAIMER_VERSION
    );
  }

  return {
    AI_DISCLAIMER_VERSION,
    PRODUCT_ANALYTICS_VERSION,
    PRIVACY_POLICY_VERSION,
    TERMS_VERSION,
    getLegalDocument,
    getLegalVersions,
    hasAcceptedVersions
  };
});
