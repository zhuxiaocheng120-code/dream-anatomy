(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamLegalDocuments = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const PRIVACY_POLICY_VERSION = "2026-07-21";
  const TERMS_VERSION = "2026-07-21";
  const AI_DISCLAIMER_VERSION = "2026-07-21";
  const CROSS_BORDER_CONSENT_VERSION = "2026-07-21";
  const PRODUCT_ANALYTICS_VERSION = "2026-07-19";
  const EFFECTIVE_DATE = "2026-07-21";
  const DEFAULT_OPERATOR_NAME = "朱校成";
  const DEFAULT_OPERATOR_TYPE = "个人运营者";
  const DEFAULT_SUPPORT_EMAIL = "zhuxiaocheng120@gmail.com";

  function getPublicInfo(runtimeEnv = {}) {
    return {
      operatorName: runtimeEnv.PUBLIC_OPERATOR_NAME || DEFAULT_OPERATOR_NAME,
      operatorType: DEFAULT_OPERATOR_TYPE,
      supportEmail: runtimeEnv.PUBLIC_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL,
      aiModelName: runtimeEnv.PUBLIC_AI_MODEL_NAME || "DeepSeek API",
      aiModelFilingNumber: runtimeEnv.PUBLIC_AI_MODEL_FILING_NUMBER || "",
      aiAppRegistrationNumber: runtimeEnv.PUBLIC_AI_APP_REGISTRATION_NUMBER || ""
    };
  }

  function getSupportEmail(runtimeEnv = {}) {
    return getPublicInfo(runtimeEnv).supportEmail;
  }

  function getLegalVersions() {
    return {
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      productAnalyticsVersion: PRODUCT_ANALYTICS_VERSION,
      termsVersion: TERMS_VERSION,
      aiDisclaimerVersion: AI_DISCLAIMER_VERSION,
      crossBorderConsentVersion: CROSS_BORDER_CONSENT_VERSION
    };
  }

  function createSection(heading, body) {
    return {
      heading,
      body: Array.isArray(body) ? body : [body]
    };
  }

  function createDocument(type, title, version, sections, runtimeEnv) {
    const info = getPublicInfo(runtimeEnv);
    return {
      type,
      title,
      version,
      effectiveDate: EFFECTIVE_DATE,
      note: "本文件适用于 Dream Anatomy 当前公开测试版本。",
      operator: {
        name: info.operatorName,
        type: info.operatorType,
        supportEmail: info.supportEmail
      },
      sections
    };
  }

  function getOperatorSections(runtimeEnv) {
    const info = getPublicInfo(runtimeEnv);
    return [
      `运营者：${info.operatorName}`,
      `主体类型：${info.operatorType}`,
      `联系邮箱：${info.supportEmail}`
    ];
  }

  function getPrivacyDocument(runtimeEnv) {
    const info = getPublicInfo(runtimeEnv);
    return createDocument("privacy", "Dream Anatomy 隐私政策", PRIVACY_POLICY_VERSION, [
      createSection("1. 政策适用范围", [
        "本政策适用于 Dream Anatomy Web 与微信小程序当前公开测试版本。Dream Anatomy 是梦境记录、AI 辅助整理和自我探索工具。"
      ]),
      createSection("2. 运营者和联系方式", getOperatorSections(runtimeEnv)),
      createSection("3. 我们处理的信息", [
        "账户信息：邮箱、Supabase 账户标识、登录和账户状态、法律文件确认版本和时间。",
        "微信身份信息：微信身份经过带密钥 HMAC 处理后的标识、Dream Anatomy Session Token 哈希、登录时间、到期时间和撤销时间。我们不保存 raw openid、raw unionid、session_key 或微信 code，也不主动获取微信昵称、头像、手机号或好友信息。",
        "梦境记录：用户主动填写的梦境正文、睡眠感受、梦境摘要、情绪和意象、AI 解析结果、Dream Result Card、用户自我思考、创建和更新时间。",
        "AI 使用统计：请求时间、用户类型、分析类型、成功或错误状态、错误码、请求耗时、模型名称、Token 用量、质量重试次数、可选成本估算和去标识化 principal hash。",
        "AI 使用统计不保存梦境正文、完整 AI 回复、邮箱、完整 Supabase UUID、access token、refresh token、Authorization header 或 raw IP。",
        "可选的产品分析（匿名使用统计）默认关闭。用户主动开启后，我们会记录页面访问、是否开始输入、是否请求或完成解析、是否查看和保存结果、是否注册或登录，以及 D1/D7 等聚合留存指标。它不包含梦境正文或 AI 分析正文，可以随时关闭和删除可关联统计数据。"
      ]),
      createSection("4. 处理目的", [
        "我们处理相关信息是为了提供账户和身份功能、保存和同步梦境、完成 AI 解析、保障安全和防止滥用、执行免费额度和限流、排查错误和改善服务，以及履行导出、删除、清空和注销请求。",
        "我们不会把用户主动写入的敏感梦境内容用于广告画像或出售。"
      ]),
      createSection("5. 敏感信息提示", [
        "梦境内容可能由用户主动写入健康、亲密关系、宗教信仰、性经历或其他敏感内容。Dream Anatomy 不要求用户填写与梦境解析无关的敏感信息。",
        "请避免输入不必要的身份证、银行卡、详细住址、医疗记录等内容。用户主动提交此类内容时，我们仅为完成其主动请求的记录、存储和 AI 解析目的处理。"
      ]),
      createSection("6. 服务提供方和数据处理地区", [
        "Render 提供 Web 和 API 服务，当前部署地区为美国俄勒冈州（Oregon, US West）。",
        "Supabase 提供账户认证和云端数据库，当前项目地区为印度孟买（South Asia / Mumbai，ap-south-1）。",
        "DeepSeek 接收完成 AI 解析所必要的梦境内容，用于生成用户主动请求的梦境解析。Dream Anatomy 不声称控制 DeepSeek 的全部基础设施地区，相关处理还受 DeepSeek 服务规则约束。",
        "微信用于小程序身份验证。当前版本不主动获取昵称、头像和手机号。"
      ]),
      createSection("7. 境外处理和单独同意", [
        "由于 Render 位于美国俄勒冈州、Supabase 位于印度孟买，用户的账户数据、梦境记录和服务请求可能在中华人民共和国境外处理或存储。",
        "在注册、首次云同步或首次需要境外处理梦境内容前，我们会显示单独的境外处理说明，并使用独立复选框。该复选框默认不勾选，用户不会因为一个隐藏在总协议中的勾选而被视为单独同意。",
        "单独同意文案为：我已阅读境外处理说明，并单独同意为提供 Dream Anatomy 服务，将完成账户、存储和 AI 解析所必要的个人信息传输或存储至美国俄勒冈州和印度孟买的服务基础设施。"
      ]),
      createSection("8. 保存期限", [
        "梦境记录保存至用户主动删除、清空或注销账户。法律同意记录保存至账户注销或法律要求的期限。微信 Session 保存至过期或撤销。",
        "产品分析数据按完成产品分析目的所必要期限保存。AI 使用统计当前长期保存，用于安全和运营分析；登录用户注销时会删除可关联 authenticated AI 统计。无法可靠关联的历史 guest 统计可能无法随账户注销删除。",
        "我们不会承诺所有信息都无限期保留，也不会承诺任何数据在所有情况下都不删除。"
      ]),
      createSection("9. 用户权利", [
        "用户可以查看、复制、导出、更正或补充自己的梦境记录，删除单条梦境，清空全部梦境，撤回产品分析同意，删除产品分析数据，注销账户，或通过联系邮箱提出请求。",
        "撤回同意不影响撤回前基于同意进行的处理。"
      ]),
      createSection("10. 安全措施", [
        "我们使用 Supabase RLS、服务端 API 鉴权、限流、Session Token 哈希、微信身份 HMAC、服务端密钥不进入前端、日志和统计不保存梦境正文等措施降低风险。",
        "互联网服务无法保证绝对安全；如果发现异常，请通过公开邮箱联系运营者。"
      ]),
      createSection("11. 未成年人", [
        "不满十四周岁的未成年人应由监护人同意和指导使用本服务。我们不鼓励未成年人独立填写敏感梦境信息。",
        "运营者发现缺乏有效监护人同意时，可以限制或删除相关数据。"
      ]),
      createSection("12. 政策更新与联系", [
        "本政策发生实质更新时，登录用户需要重新确认后继续使用相关账户功能。",
        `运营者：${info.operatorName}`,
        `联系邮箱：${info.supportEmail}`
      ])
    ], runtimeEnv);
  }

  function getTermsDocument(runtimeEnv) {
    const info = getPublicInfo(runtimeEnv);
    return createDocument("terms", "Dream Anatomy 用户协议", TERMS_VERSION, [
      createSection("1. 协议接受与生效", [
        "用户注册、登录或使用 Dream Anatomy 当前公开测试版本时，应阅读并同意本协议、隐私政策和 AI 使用说明。"
      ]),
      createSection("2. 产品定位", [
        "Dream Anatomy 是梦境记录工具、AI 辅助整理工具和自我探索工具。",
        "Dream Anatomy 不是医疗服务、心理诊断、心理治疗、紧急干预、算命、吉凶判断、未来预测、法律建议或财务建议。"
      ]),
      createSection("3. 账户规则", [
        "用户应保证提供可用邮箱，并妥善保护账户凭证。不得共享、攻击、盗用账户或尝试获取其他用户数据。",
        "微信身份与 Web 邮箱账户当前可能独立；当前版本不承诺已经实现跨端账户绑定。"
      ]),
      createSection("4. 用户内容", [
        "用户保留其合法梦境内容权利。",
        "用户授予运营者的权限仅限于存储、展示给当前用户、完成 AI 解析、同步、导出、删除、安全审查和故障处理。运营者不取得用户梦境内容的无边界、无期限、可转售所有权。"
      ]),
      createSection("5. 禁止行为", [
        "不得上传违法或侵权内容，不得攻击、爬取、绕过限流，不得尝试获取其他用户数据，不得滥用服务生成违法内容，不得将产品冒充为医疗诊断工具，不得倒卖免费额度。"
      ]),
      createSection("6. AI 内容边界", [
        "AI 可能错误、遗漏、重复或误解。短梦境可能显示有限线索提示；分数只描述本次文字中的线索，不构成人格测验或临床评估。",
        "用户不应仅依据 AI 结果作出涉及人身安全、医疗、法律、财务或其他重大事项的决定。"
      ]),
      createSection("7. Beta 服务和可用性", [
        "当前服务处于免费公开测试阶段，功能、额度、模型和界面可能调整。服务可能维护、暂停或中断，我们会合理努力保障稳定性，但不承诺永不中断。"
      ]),
      createSection("8. 责任限制", [
        "在适用法律允许的最大范围内，本服务按现状提供，不保证 AI 内容完全准确、完整、持续可用或适用于特定目的。",
        "用户不应仅依据 AI 内容作出涉及人身安全、医疗、法律、财务或其他重大事项的决定。",
        "对于依法不得排除或限制的责任，本协议不予排除或限制。"
      ]),
      createSection("9. 服务限制和终止", [
        "用户违法或恶意滥用服务时，运营者可以限制或终止相关使用。用户可以注销账户；注销后不可恢复的数据会在操作前明确提示。"
      ]),
      createSection("10. 知识产权", [
        "Dream Anatomy 品牌、代码、界面和原创视觉归相应权利人。用户保留自己合法输入内容的权利。AI 输出不保证具有排他性。"
      ]),
      createSection("11. 法律适用和争议", [
        "本协议适用中华人民共和国法律法规。争议优先友好协商；协商不成时，向依法具有管辖权的人民法院解决。"
      ]),
      createSection("12. 联系方式", [
        `运营者：${info.operatorName}`,
        `主体类型：${info.operatorType}`,
        `联系邮箱：${info.supportEmail}`
      ])
    ], runtimeEnv);
  }

  function getAiDocument(runtimeEnv) {
    const info = getPublicInfo(runtimeEnv);
    const modelLines = [`当前主要调用：${info.aiModelName}`];
    if (info.aiModelFilingNumber) modelLines.push(`模型备案或登记信息：${info.aiModelFilingNumber}`);
    if (info.aiAppRegistrationNumber) modelLines.push(`应用或功能登记信息：${info.aiAppRegistrationNumber}`);

    return createDocument("ai", "Dream Anatomy AI 使用说明与风险提示", AI_DISCLAIMER_VERSION, [
      createSection("1. 当前模型", modelLines),
      createSection("2. 内容性质", [
        "AI 解析是自我探索参考，不构成心理诊断，不构成治疗建议，不构成未来预测，也不是心理测量。",
        "Dream Anatomy 不会用 AI 内容替代医生、心理咨询师或其他合格专业人士。"
      ]),
      createSection("3. 有限线索模式", [
        "当输入很短或细节较少时，系统仍可能生成完整但暂定的画像。低置信度代表线索数量有限，不代表用户本人存在问题。"
      ]),
      createSection("4. 模型风险", [
        "AI 内容可能产生错误、遗漏，也可能给出不适合个人实际情况的理解。对同一梦境，不同时间的 AI 输出也可能不同。"
      ]),
      createSection("5. 重大决定", [
        "不要将 AI 结果作为医疗、心理、法律、财务、人身安全或重大关系决定的唯一依据。"
      ]),
      createSection("6. 紧急情况", [
        "Dream Anatomy 不是紧急援助服务。出现现实中的即时安全风险时，请联系当地紧急服务、合格专业人士或可信任的人。",
        "普通梦境描述不会被系统自动判断为危机。"
      ]),
      createSection("7. 数据处理", [
        "梦境内容会被发送至 DeepSeek API，用于完成用户当前请求。",
        "睡眠感受和 userReflection 当前不发送给 AI，除非未来明确告知并取得相应同意。"
      ]),
      createSection("8. 用户反馈", [
        `用户可以通过 ${info.supportEmail} 报告不合适内容或提出数据请求。`
      ])
    ], runtimeEnv);
  }

  function getCrossBorderDocument(runtimeEnv) {
    return createDocument("cross-border", "Dream Anatomy 境外处理说明", CROSS_BORDER_CONSENT_VERSION, [
      createSection("为什么需要境外处理", [
        "Dream Anatomy 当前 Web/API 服务由 Render 承载，部署地区为美国俄勒冈州（Oregon, US West）；账户认证和云端数据库由 Supabase 提供，项目地区为印度孟买（South Asia / Mumbai，ap-south-1）。",
        "为了完成账户、云端存储、同步和 AI 解析，完成服务所必要的个人信息可能被传输或存储至上述地区。"
      ]),
      createSection("单独同意", [
        "境外处理同意使用独立复选框，默认不勾选。不同意时，部分需要账户、云同步或 AI 解析的功能可能无法继续。",
        "你可以通过隐私与数据页面导出、删除、清空或注销账户，也可以通过公开邮箱联系运营者。"
      ])
    ], runtimeEnv);
  }

  function getLegalDocument(type, runtimeEnv = {}) {
    if (type === "terms") return getTermsDocument(runtimeEnv);
    if (type === "ai") return getAiDocument(runtimeEnv);
    if (type === "cross-border") return getCrossBorderDocument(runtimeEnv);
    return getPrivacyDocument(runtimeEnv);
  }

  function hasAcceptedVersions(consentRow) {
    return Boolean(
      consentRow
        && consentRow.privacy_policy_version === PRIVACY_POLICY_VERSION
        && consentRow.terms_version === TERMS_VERSION
        && consentRow.ai_disclaimer_version === AI_DISCLAIMER_VERSION
        && consentRow.cross_border_consent_version === CROSS_BORDER_CONSENT_VERSION
    );
  }

  return {
    AI_DISCLAIMER_VERSION,
    CROSS_BORDER_CONSENT_VERSION,
    DEFAULT_OPERATOR_NAME,
    DEFAULT_SUPPORT_EMAIL,
    PRODUCT_ANALYTICS_VERSION,
    PRIVACY_POLICY_VERSION,
    TERMS_VERSION,
    getLegalDocument,
    getLegalVersions,
    getPublicInfo,
    getSupportEmail,
    hasAcceptedVersions
  };
});
