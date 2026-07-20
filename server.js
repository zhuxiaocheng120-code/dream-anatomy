require("dotenv").config();

const express = require("express");
const crypto = require("node:crypto");
const path = require("path");
const DreamArchetypes = require("./src/dreamArchetypes");
const DreamResultCard = require("./src/dreamResultCard");
const { createAccountDeletionService } = require("./server/accountDeletion");
const { createAdminAuth } = require("./server/adminAuth");
const { getAnalyticsSummary, getRecentAnalyticsEvents } = require("./server/adminAnalytics");
const { getProductAnalyticsFunnel, getProductAnalyticsRetention, getProductAnalyticsSummary } = require("./server/adminProductAnalytics");
const { createAdminSupabaseClient } = require("./server/adminSupabase");
const { createAiAccessControl } = require("./server/aiAccessControl");
const { createAiAuthResolver } = require("./server/aiAuth");
const { buildUsageEvent, createPrincipalHash, recordUsageEventSafely } = require("./server/aiAnalytics");
const { createApiError, formatApiError } = require("./server/aiErrors");
const {
  PRODUCT_ANALYTICS_VERSION,
  deleteProductEventsForIdentity,
  hasEnabledProductAnalyticsPreference,
  normalizeProductEventBatch,
  recordProductEventsSafely
} = require("./server/productAnalytics");
const { createWechatAuthService } = require("./server/wechatAuth");

const app = express();
const port = process.env.PORT || 3000;
const deepSeekBaseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const deepSeekModel = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const maxDreamTextLength = 5000;
const quickPromptVersion = "quick-analysis-v2";
const defaultRequestTimeoutMs = parsePositiveInteger(process.env.AI_REQUEST_TIMEOUT_MS, 45000);
const defaultInitialAttemptTimeoutMs = parsePositiveInteger(process.env.AI_INITIAL_ATTEMPT_TIMEOUT_MS, defaultRequestTimeoutMs);
const defaultRepairAttemptTimeoutMs = parsePositiveInteger(process.env.AI_REPAIR_ATTEMPT_TIMEOUT_MS, 30000);
const defaultLimitedAttemptTimeoutMs = parsePositiveInteger(process.env.AI_LIMITED_ATTEMPT_TIMEOUT_MS, 25000);
const defaultTotalRequestTimeoutMs = parsePositiveInteger(process.env.AI_TOTAL_REQUEST_TIMEOUT_MS, 90000);
const requiredResultCardDimensionIds = ["symbol_depth", "emotion_intensity", "self_awareness", "growth_signal"];

app.set("trust proxy", "loopback");
app.use(express.json({ limit: "32kb" }));
app.get("/runtime-env.js", (request, response) => {
  response.set("Cache-Control", "no-store");
  response.sendFile(path.join(__dirname, "src", "runtime-env.js"));
});
app.use(express.static(path.join(__dirname, "src")));

const defaultAiAuthResolver = createAiAuthResolver();
const defaultAiAccessControl = createAiAccessControl({
  guestDailyLimit: process.env.AI_GUEST_DAILY_LIMIT,
  userDailyLimit: process.env.AI_USER_DAILY_LIMIT,
  guestRequestsPerMinute: process.env.AI_GUEST_REQUESTS_PER_MINUTE,
  userRequestsPerMinute: process.env.AI_USER_REQUESTS_PER_MINUTE,
  maxConcurrentPerPrincipal: process.env.AI_MAX_CONCURRENT_PER_PRINCIPAL
});

function parsePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function getAiAuthResolver() {
  return app.locals.aiAuthResolver || defaultAiAuthResolver;
}

function getAiAccessControl() {
  return app.locals.aiAccessControl || defaultAiAccessControl;
}

function getAiRequestTimeoutMs() {
  return parsePositiveInteger(app.locals.aiRequestTimeoutMs, defaultRequestTimeoutMs);
}

function getAiTimeoutConfig() {
  if (app.locals.aiTimeoutConfig && typeof app.locals.aiTimeoutConfig === "object") {
    return {
      initialAttemptMs: parsePositiveInteger(app.locals.aiTimeoutConfig.initialAttemptMs, defaultInitialAttemptTimeoutMs),
      repairAttemptMs: parsePositiveInteger(app.locals.aiTimeoutConfig.repairAttemptMs, defaultRepairAttemptTimeoutMs),
      limitedAttemptMs: parsePositiveInteger(app.locals.aiTimeoutConfig.limitedAttemptMs, defaultLimitedAttemptTimeoutMs),
      totalRequestMs: parsePositiveInteger(app.locals.aiTimeoutConfig.totalRequestMs, defaultTotalRequestTimeoutMs)
    };
  }

  if (app.locals.aiRequestTimeoutMs !== undefined) {
    const legacyTimeoutMs = getAiRequestTimeoutMs();
    return {
      initialAttemptMs: legacyTimeoutMs,
      repairAttemptMs: legacyTimeoutMs,
      limitedAttemptMs: legacyTimeoutMs,
      totalRequestMs: legacyTimeoutMs
    };
  }

  return {
    initialAttemptMs: parsePositiveInteger(process.env.AI_INITIAL_ATTEMPT_TIMEOUT_MS, defaultInitialAttemptTimeoutMs),
    repairAttemptMs: parsePositiveInteger(process.env.AI_REPAIR_ATTEMPT_TIMEOUT_MS, defaultRepairAttemptTimeoutMs),
    limitedAttemptMs: parsePositiveInteger(process.env.AI_LIMITED_ATTEMPT_TIMEOUT_MS, defaultLimitedAttemptTimeoutMs),
    totalRequestMs: parsePositiveInteger(process.env.AI_TOTAL_REQUEST_TIMEOUT_MS, defaultTotalRequestTimeoutMs)
  };
}

function getAnalyticsClient() {
  if (Object.prototype.hasOwnProperty.call(app.locals, "analyticsClient")) {
    return app.locals.analyticsClient;
  }

  return createAdminSupabaseClient();
}

function getProductAnalyticsClient() {
  if (Object.prototype.hasOwnProperty.call(app.locals, "productAnalyticsClient")) {
    return app.locals.productAnalyticsClient;
  }

  return getAnalyticsClient();
}

function getAnalyticsEnv() {
  return app.locals.analyticsEnv || process.env;
}

function getAdminEnv() {
  return app.locals.adminEnv || process.env;
}

function getAnalyticsLogger() {
  return app.locals.analyticsLogger || console;
}

function shouldAwaitAnalyticsWrites() {
  return app.locals.awaitAnalyticsWrites === true;
}

function getAdminAuth() {
  return createAdminAuth({
    aiAuthResolver: getAiAuthResolver(),
    env: getAdminEnv()
  });
}

function getAccountDeletionService() {
  if (app.locals.accountDeletionService) {
    return app.locals.accountDeletionService;
  }

  return createAccountDeletionService({
    aiAuthResolver: getAiAuthResolver(),
    env: getAnalyticsEnv(),
    getAdminClient: () => createAdminSupabaseClient()
  });
}

function getWechatAuthService() {
  if (app.locals.wechatAuthService) {
    return app.locals.wechatAuthService;
  }

  if (!app.locals.defaultWechatAuthService) {
    app.locals.defaultWechatAuthService = createWechatAuthService({
      env: process.env,
      getAdminClient: () => app.locals.wechatAdminClient || createAdminSupabaseClient()
    });
  }

  return app.locals.defaultWechatAuthService;
}

function isDeepGuidanceEnabled() {
  if (typeof app.locals.deepGuidanceEnabled === "boolean") {
    return app.locals.deepGuidanceEnabled;
  }

  return process.env.DEEP_GUIDANCE_ENABLED === "true";
}

function sendApiError(response, error, usage) {
  const status = error.status || error.statusCode || 500;
  const payload = formatApiError(error, usage);

  if (error.generationMeta) {
    payload.generationMeta = error.generationMeta;
  }
  if (error.requestId) {
    payload.requestId = error.requestId;
  }

  response.set("Cache-Control", "no-store");
  if (error.retryAfter) {
    response.set("Retry-After", String(error.retryAfter));
  }
  response.status(status).json(payload);
}

const resultCardDimensionSchemaLines = [
  '      {',
  '        "id": "symbol_depth",',
  '        "name": "象征深度",',
  '        "score": 0,',
  '        "summary": "简短说明",',
  '        "rationale": ["基于梦境内容的依据"]',
  '      },',
  '      {',
  '        "id": "emotion_intensity",',
  '        "name": "情绪强度",',
  '        "score": 0,',
  '        "summary": "简短说明",',
  '        "rationale": ["基于梦境内容的依据"]',
  '      },',
  '      {',
  '        "id": "self_awareness",',
  '        "name": "自我觉察",',
  '        "score": 0,',
  '        "summary": "简短说明",',
  '        "rationale": ["基于梦境内容的依据"]',
  '      },',
  '      {',
  '        "id": "growth_signal",',
  '        "name": "成长信号",',
  '        "score": 0,',
  '        "summary": "简短说明",',
  '        "rationale": ["基于梦境内容的依据"]',
  '      }'
];

function getStableArchetypePromptLine() {
  const archetypeList = DreamArchetypes.archetypes
    .map((item) => `${item.id}（${item.nameZh} / ${item.nameEn}）`)
    .join("、");

  return `梦境原型必须从稳定原型集合中选择一个 id，不得返回未知 id。稳定原型集合：${archetypeList}。`;
}

function getResultCardSchemaRules() {
  return [
    getStableArchetypePromptLine(),
    "dimensions 必须正好返回四项，不得遗漏，不得增加未知 id，不得重复维度。",
    "每项维度必须有数值 score、summary 和至少一条 rationale；信息较少时仍要根据当前文本线索谨慎评分。",
    "不得使用 null、暂不可用或暂不评分。score=0 是有效真实评分，但只能在有梦境依据时使用。",
    "archetype.evidence 必须至少两条，并引用当前梦境线索。",
    "reflectionQuestions 至少 1 个，快速解析整体 analysis.reflectionQuestions 必须正好 3 个。",
    "emotionalProfile 必须包含 primary、secondary、intensity 和 evidence。"
  ];
}

function getResultCardValidationIssueCodes(issues = []) {
  const codes = [];

  issues.forEach((issue) => {
    const text = normalizeText(issue);

    if (!text) return;

    if (text.includes("不是合法") || text.includes("不是 JSON")) {
      codes.push("invalid_json");
    }

    if (text.includes("稳定原型") || text.includes("未知 id")) {
      codes.push("invalid_archetype_id");
    }

    if (text.includes("四个梦境维度")) {
      requiredResultCardDimensionIds.forEach((id) => codes.push(`missing_dimension_${id}`));
    }

    requiredResultCardDimensionIds.forEach((id) => {
      if (text.includes(id)) {
        codes.push(`missing_dimension_${id}`);
      }
    });

    if (text.includes("rationale")) {
      codes.push("missing_rationale");
    }

    if (text.includes("分数") || text.includes("score")) {
      codes.push("invalid_score");
    }

    if (text.includes("情绪画像")) {
      codes.push("missing_emotional_profile");
    }

    if (text.includes("主要意象")) {
      codes.push("missing_symbols");
    }

    if (text.includes("自我思考问题")) {
      codes.push("missing_reflection_questions");
    }

    if (text.includes("安全提醒")) {
      codes.push("missing_safety_reminder");
    }
  });

  return Array.from(new Set(codes));
}

function applyValidationIssueAnalytics(analyticsMeta, issues) {
  if (!analyticsMeta) return;
  const validationIssueCodes = getResultCardValidationIssueCodes(issues);
  analyticsMeta.validationIssueCodes = validationIssueCodes;
  analyticsMeta.finalErrorCode = validationIssueCodes[0] || "GENERATION_INCOMPLETE";
}

function getResultCardObjectSchemaLines(indent = "    ") {
  return [
    `${indent}"archetype": { "id": "seeker", "nameZh": "寻路者", "nameEn": "The Seeker", "summary": "本次梦境更接近某个稳定原型的说明", "evidence": ["梦中证据1", "梦中证据2"] },`,
    `${indent}"coreInsight": "一句温和且不绝对的核心洞察",`,
    `${indent}"dimensions": [`,
    ...resultCardDimensionSchemaLines.map((line) => `${indent}${line}`),
    `${indent}],`,
    `${indent}"symbols": [{ "name": "意象", "generalPossibility": "可能性", "contextMeaning": "这次梦里的可能含义", "evidence": "梦中线索", "reflectionQuestion": "开放问题" }],`,
    `${indent}"emotionalProfile": { "primary": "主要情绪", "secondary": ["伴随情绪"], "intensity": 0, "evidence": "梦中线索" },`,
    `${indent}"reflectionQuestions": ["开放问题"],`,
    `${indent}"safetyReminder": "这不是诊断、治疗或预言，只是一种自我探索视角。"`
  ];
}

function getResultCardEnvelopeSchemaLines(indent = "    ") {
  return [
    `${indent}"dreamResultCard": {`,
    ...getResultCardObjectSchemaLines(`${indent}  `),
    `${indent}},`,
    `${indent}"generationMeta": { "source": "ai_generated", "promptVersion": "quick-analysis-v2", "qualityStatus": "passed", "limitedEvidence": false, "evidenceConfidence": "high" }`
  ];
}

function buildSystemPrompt() {
  return [
    "你是一个温和的中文梦境自我探索助手。",
    "你使用荣格心理学作为一种非确定性的观察视角，而不是固定解释。",
    "请使用“可能”“也许”“可以理解为”“你可以思考”等非绝对表达。",
    "不得声称提供心理诊断，不得声称提供心理治疗。",
    "不得预测未来，不得进行算命或吉凶判断。",
    "不得把梦境符号解释为固定含义。",
    "必须提醒：这不是诊断、治疗或预言，只是一种自我探索视角。",
    "只返回合法 JSON，不要 Markdown，不要代码块。"
  ].join("\n");
}

function buildUserPrompt(dreamText) {
  return [
    `promptVersion: ${quickPromptVersion}`,
    "请基于用户的梦境碎片生成快速解析，并在同一次上下文中生成梦境画像。",
    "请先完成定性分析，再生成四维评分。不要单纯增加字数；每个结论都要有梦境细节依据。",
    "快速解析不能只返回几句通用话，必须至少引用两个梦中的具体场景、人物、动作或物件。",
    "禁止把 fallback、mock、模板或通用解释伪装成正常 AI 输出。",
    "所有解释都要分清：梦中实际发生的内容，以及你提供的可能理解。",
    "主要意象最多 3 个。每个意象必须结合这次梦的语境，不能写“梦见某物代表固定含义”。",
    "反思问题必须有 3 个，并尽量包含梦里的具体人物、地点、物件或情节。",
    "温和行动必须是低压力、非治疗性质的小动作。",
    "四维评分必须有 0-100 分、简短解释和 rationale；rationale 要说明梦境内容依据，不要随机分数。",
    ...getResultCardSchemaRules(),
    "评分说明：象征深度 0-25 直接事件较多，26-50 少量可解释意象，51-75 多个意象相互关联，76-100 意象、情绪和情节形成明显主题网络。",
    "评分说明：情绪强度 0-25 情绪轻微，26-50 情绪可辨认，51-75 情绪推动情节，76-100 情绪贯穿梦境并留下强烈醒后感。",
    "评分说明：自我觉察 0-25 只记录事件，26-50 能识别感受，51-75 能观察自己的反应，76-100 能把梦中反应与自我理解连接。",
    "评分说明：成长信号 0-25 线索较少，26-50 有轻微变化，51-75 出现选择/边界/新方向，76-100 梦境呈现清晰转变或整合可能。",
    "返回 JSON 结构必须严格符合：",
    "{",
    '  "analysis": {',
    '    "dreamSummary": "80-160 个中文字符，使用梦中的具体人物、场景和事件，不重复原文，不添加梦里没有发生的内容",',
    '    "coreTheme": "一句话说明这次梦最值得关注的心理主题",',
    '    "coreInterpretation": "250-450 个中文字符，引用至少两个梦境细节，使用可能/也许/可以理解为",',
    '    "evidence": [{ "dreamFragment": "梦境片段", "interpretation": "为什么这个片段支持当前分析" }],',
    '    "emotionalReading": { "primaryEmotion": "主要情绪", "secondaryEmotions": ["次要情绪"], "intensity": 0, "evidence": "情绪来自哪个具体梦境片段，并说明不代表现实固定心理状态" },',
    '    "symbolReading": [{ "symbol": "意象", "context": "本次梦里的具体语境", "possibleMeaning": "可能与什么有关", "evidence": "支持判断的梦境片段", "reflectionQuestion": "与用户自身有关的开放问题" }],',
    '    "reflectionQuestions": ["开放问题1", "开放问题2", "开放问题3"],',
    '    "gentleAction": "一个很小、低压力、非治疗性质的行动",',
    '    "safetyReminder": "这不是诊断、治疗或预言，只是一种自我探索视角。"',
    "  },",
    ...getResultCardEnvelopeSchemaLines("  "),
    "}",
    "梦境内容：",
    dreamText
  ].join("\n");
}

function buildQuickRetryUserPrompt(dreamText, issues) {
  return [
    buildUserPrompt(dreamText),
    "",
    "上一次输出没有通过质量检查，请修复以下缺失项后重新返回完整 JSON：",
    issues.map((issue) => `- ${issue}`).join("\n")
  ].join("\n");
}

function buildResultCardRetryUserPrompt(dreamText, issues) {
  return [
    buildResultCardUserPrompt(dreamText),
    "",
    "上一次梦境画像输出没有通过质量检查，请只返回完整梦境画像 JSON 对象本身，并补齐以下缺失项：",
    "必须返回整张完整 Dream Result Card，不能只返回缺失字段片段，不能返回 analysis 包裹层。",
    issues.map((issue) => `- ${issue}`).join("\n")
  ].join("\n");
}

function formatValidatedQuickAnalysisForPrompt(analysis) {
  return JSON.stringify({
    dreamSummary: analysis.dreamSummary,
    coreTheme: analysis.coreTheme,
    coreInterpretation: analysis.coreInterpretation,
    evidence: analysis.evidence,
    emotionalReading: analysis.emotionalReading,
    symbolReading: analysis.symbolReading,
    reflectionQuestions: analysis.reflectionQuestions,
    gentleAction: analysis.gentleAction,
    safetyReminder: analysis.safetyReminder
  });
}

function buildQuickResultCardRepairUserPrompt(dreamText, analysis, issues) {
  return [
    "请只返回完整梦境画像 JSON 对象本身；不要重新生成或改写 analysis。",
    "你必须使用下面已通过校验的快速解析作为同一上下文依据，保持画像与文字分析一致。",
    "如果梦境线索有限，仍然必须给出完整画像、四个 0-100 数字评分和 rationale；可以把 evidenceConfidence 设为 low 或 medium。",
    "不要生成假分数，不要把缺失分数补成 0；分数必须来自你根据本次梦境文本和已验证 analysis 的谨慎判断。",
    ...getResultCardSchemaRules(),
    "当前缺少哪些维度或字段会列在下方；你仍需返回整张完整 Dream Result Card，不能只返回缺失字段片段。",
    "standalone result_card 必须返回卡片对象本身，不能返回 analysis 包裹层，也不要返回 dreamResultCard 包裹层。",
    "返回 JSON 结构必须严格符合：",
    "{",
    ...getResultCardObjectSchemaLines("  "),
    "}",
    "上一次画像缺失项：",
    issues.map((issue) => `- ${issue}`).join("\n"),
    "已验证 analysis：",
    formatValidatedQuickAnalysisForPrompt(analysis),
    "梦境内容：",
    dreamText
  ].join("\n");
}

function buildLimitedEvidenceResultCardUserPrompt(dreamText, analysis, issues) {
  return [
    "请生成一个基于有限线索的最小完整 Dream Result Card。",
    "请只返回完整梦境画像 JSON 对象本身。",
    "这是最后一次修复：即使梦境很短或信息较少，也必须返回完整画像，不能返回空字段、null 分数、暂不可用或暂不评分。",
    "所有分数必须是 0-100 的数字，并用 rationale 说明它只依据本次记录中呈现的线索。",
    "如果线索较少，请让解释更谨慎、分数更保守，并设置 limitedEvidence: true。",
    "不得编造梦里没有出现的人物、事件、情绪或现实背景。",
    ...getResultCardSchemaRules(),
    "仍需返回整张完整 Dream Result Card，不能只返回缺失字段片段。",
    "standalone result_card 必须返回卡片对象本身，不能返回 analysis 包裹层，也不要返回 dreamResultCard 包裹层。",
    "返回 JSON 结构必须严格符合：",
    "{",
    ...getResultCardObjectSchemaLines("  "),
    "}",
    "仍需补齐的问题：",
    issues.map((issue) => `- ${issue}`).join("\n"),
    "已验证 analysis：",
    analysis ? formatValidatedQuickAnalysisForPrompt(analysis) : "无已验证快速解析，请仅依据梦境内容生成画像。",
    "梦境内容：",
    dreamText
  ].join("\n");
}

function buildResultCardUserPrompt(dreamText) {
  return [
    "请基于用户的梦境碎片生成梦境画像。",
    "只返回严格合法 JSON，不要 Markdown，不要代码块。",
    "不要诊断、治疗、预测未来、判断吉凶、算命，或给出固定的象征含义与人格结论。",
    "所有解读使用可能、也许、可以理解为等非绝对表达。",
    "必须结合梦境中的具体人物、场景、动作或情绪线索，不要输出通用模板。",
    "四个维度必须都有 0-100 分、简短解释和至少一条基于梦境内容的 rationale。",
    "梦境原型必须从稳定原型中选择，并提供至少两条 evidence。",
    ...getResultCardSchemaRules(),
    "standalone result_card 必须返回卡片对象本身，不能返回 analysis 包裹层，也不要返回 dreamResultCard 包裹层。",
    "返回 JSON 结构必须严格符合：",
    "{",
    ...getResultCardObjectSchemaLines("  "),
    "}",
    "梦境内容：",
    dreamText
  ].join("\n");
}

function buildGuidedQuestionsUserPrompt(dreamText) {
  return [
    "请基于用户的梦境内容生成 3-5 个温和、简短、与本次梦境相关的深度引导问题。",
    "问题要覆盖情绪、联想、现实连接、梦中主动性、醒后感受中的至少 3 类。",
    "禁止固定模板式问题，必须引用梦中的具体画面、人物、地点或动作。",
    "不要诱导创伤或过度隐私，不要诊断、治疗、预测未来、判断吉凶或算命。",
    "只返回严格合法 JSON，不要 Markdown，不要代码块。",
    "返回 JSON 结构必须严格符合：",
    "{",
    '  "questions": [{ "id": "emotion", "label": "情绪", "question": "短问题", "placeholder": "温和示例" }]',
    "}",
    "梦境内容：",
    dreamText
  ].join("\n");
}

function buildGuidedFinalUserPrompt(dreamText, guidedAnswers) {
  const answerLines = Object.entries(guidedAnswers || {})
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key}: ${value.trim()}`);

  return [
    "请综合用户的梦境原文和深度引导回答，生成 Dream Anatomy Report，并在同一次上下文中生成梦境画像。",
    "必须使用用户写下的回答；如果某个回答为空，可以轻轻跳过，不要编造现实背景。",
    "所有解读使用可能、也许、可以理解为、你可以思考等非绝对表达。",
    "不要诊断、治疗、预测未来、判断吉凶、算命，或给出固定人格结论。",
    ...getResultCardSchemaRules(),
    "只返回严格合法 JSON，不要 Markdown，不要代码块。",
    "返回 JSON 结构必须严格符合：",
    "{",
    '  "analysis": {',
    '    "summary": "梦境整理",',
    '    "emotionClues": "情绪线索",',
    '    "coreImages": "核心意象",',
    '    "jungianView": "荣格式初步解读",',
    '    "lifeConnection": "现实连接，必须结合用户回答",',
    '    "reflectionQuestions": "自我反思问题",',
    '    "smallAction": "今日小行动",',
    '    "gentleReminder": "这不是诊断、治疗或预言，只是一种自我探索视角。"',
    "  },",
    ...getResultCardEnvelopeSchemaLines("  "),
    "}",
    "梦境内容：",
    dreamText,
    "用户回答：",
    answerLines.length ? answerLines.join("\n") : "用户暂未填写回答。"
  ].join("\n");
}

function validateDreamAnalysisRequest(body) {
  const dreamText = typeof body.dreamText === "string" ? body.dreamText.trim() : "";

  if (!dreamText) {
    return { error: "dreamText must be a non-empty string." };
  }

  if (dreamText.length > maxDreamTextLength) {
    return { error: "dreamText must be 5000 characters or fewer." };
  }

  if (!["quick", "result_card", "guided_questions", "guided_final"].includes(body.analysisType)) {
    return { error: "analysisType must be quick, result_card, guided_questions, or guided_final." };
  }

  const guidedAnswers = body.guidedAnswers && typeof body.guidedAnswers === "object" && !Array.isArray(body.guidedAnswers)
    ? Object.fromEntries(
        Object.entries(body.guidedAnswers)
          .filter(([, value]) => typeof value === "string")
          .map(([key, value]) => [key, value.trim()])
      )
    : {};

  return { dreamText, guidedAnswers };
}

function parseJsonObject(content) {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeObjectList(value, requiredKeys) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isPlainObject)
    .map((item) => {
      const normalized = {};
      requiredKeys.forEach((key) => {
        normalized[key] = normalizeText(item[key]);
      });
      return normalized;
    })
    .filter((item) => requiredKeys.every((key) => item[key]))
    .slice(0, 4);
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function normalizeDeepSeekOutput(parsed) {
  if (
    typeof parsed.dreamSummary !== "string" ||
    typeof parsed.coreEmotion !== "string" ||
    !isStringArray(parsed.symbols) ||
    typeof parsed.jungianInterpretation !== "string" ||
    !isStringArray(parsed.reflectionQuestions) ||
    typeof parsed.gentleReminder !== "string"
  ) {
    return null;
  }

  return {
    dreamSummary: parsed.dreamSummary,
    coreEmotion: parsed.coreEmotion,
    symbols: parsed.symbols,
    jungianInterpretation: parsed.jungianInterpretation,
    reflectionQuestions: parsed.reflectionQuestions,
    gentleReminder: parsed.gentleReminder
  };
}

function normalizeQuickAnalysisOutput(parsed) {
  if (!isPlainObject(parsed)) return null;

  if (typeof parsed.dreamSummary === "string") {
    return normalizeQuickAnalysisOutputV2(parsed);
  }

  const emotions = normalizeObjectList(parsed.emotions, ["name", "evidence"]);
  const symbols = normalizeObjectList(parsed.symbols, ["name", "contextMeaning"]);
  const reflectionQuestions = isStringArray(parsed.reflectionQuestions)
    ? parsed.reflectionQuestions.map(normalizeText).filter(Boolean).slice(0, 3)
    : [];

  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.coreInterpretation !== "string" ||
    emotions.length === 0 ||
    symbols.length === 0 ||
    reflectionQuestions.length === 0 ||
    typeof parsed.gentleReminder !== "string"
  ) {
    return null;
  }

  return {
    dreamSummary: normalizeText(parsed.summary),
    coreTheme: "",
    coreInterpretation: normalizeText(parsed.coreInterpretation),
    evidence: [],
    emotionalReading: {
      primaryEmotion: emotions[0] ? emotions[0].name : "",
      secondaryEmotions: emotions.slice(1).map((emotion) => emotion.name),
      intensity: null,
      evidence: emotions.map((emotion) => emotion.evidence).filter(Boolean).join("；")
    },
    symbolReading: symbols.map((symbol) => ({
      symbol: symbol.name,
      context: symbol.contextMeaning,
      possibleMeaning: symbol.contextMeaning,
      evidence: symbol.contextMeaning,
      reflectionQuestion: ""
    })),
    reflectionQuestions,
    gentleAction: "",
    safetyReminder: normalizeText(parsed.gentleReminder)
  };
}

function normalizeQuickAnalysisOutputV2(parsed) {
  const evidence = normalizeObjectList(parsed.evidence, ["dreamFragment", "interpretation"]).slice(0, 3);
  const emotionalInput = isPlainObject(parsed.emotionalReading) ? parsed.emotionalReading : {};
  const symbolReading = Array.isArray(parsed.symbolReading)
    ? parsed.symbolReading
      .filter(isPlainObject)
      .map((symbol) => ({
        symbol: normalizeText(symbol.symbol),
        context: normalizeText(symbol.context),
        possibleMeaning: normalizeText(symbol.possibleMeaning),
        evidence: normalizeText(symbol.evidence),
        reflectionQuestion: normalizeText(symbol.reflectionQuestion)
      }))
      .filter((symbol) => symbol.symbol && symbol.context && symbol.possibleMeaning && symbol.evidence && symbol.reflectionQuestion)
      .slice(0, 3)
    : [];
  const reflectionQuestions = isStringArray(parsed.reflectionQuestions)
    ? parsed.reflectionQuestions.map(normalizeText).filter(Boolean).slice(0, 3)
    : [];

  if (
    typeof parsed.dreamSummary !== "string" ||
    typeof parsed.coreTheme !== "string" ||
    typeof parsed.coreInterpretation !== "string" ||
    evidence.length === 0 ||
    !isPlainObject(parsed.emotionalReading) ||
    symbolReading.length === 0 ||
    reflectionQuestions.length === 0 ||
    typeof parsed.gentleAction !== "string" ||
    typeof parsed.safetyReminder !== "string"
  ) {
    return null;
  }

  return {
    dreamSummary: normalizeText(parsed.dreamSummary),
    coreTheme: normalizeText(parsed.coreTheme),
    coreInterpretation: normalizeText(parsed.coreInterpretation),
    evidence,
    emotionalReading: {
      primaryEmotion: normalizeText(emotionalInput.primaryEmotion),
      secondaryEmotions: isStringArray(emotionalInput.secondaryEmotions)
        ? emotionalInput.secondaryEmotions.map(normalizeText).filter(Boolean).slice(0, 3)
        : [],
      intensity: normalizeNumber(emotionalInput.intensity),
      evidence: normalizeText(emotionalInput.evidence)
    },
    symbolReading,
    reflectionQuestions,
    gentleAction: normalizeText(parsed.gentleAction),
    safetyReminder: normalizeText(parsed.safetyReminder)
  };
}

function normalizeLegacyQuickAnalysisOutput(parsed) {
  const legacy = normalizeDeepSeekOutput(parsed);

  if (!legacy) return null;

  return {
    dreamSummary: legacy.dreamSummary,
    coreTheme: "",
    coreInterpretation: legacy.jungianInterpretation,
    evidence: [],
    emotionalReading: {
      primaryEmotion: legacy.coreEmotion,
      secondaryEmotions: [],
      intensity: null,
      evidence: "来自快速解析返回的核心情绪。"
    },
    symbolReading: legacy.symbols.map((symbol) => ({
      symbol,
      context: "这是快速解析返回的主要意象。",
      possibleMeaning: "可以结合梦境语境继续观察。",
      evidence: "来自快速解析返回的主要意象。",
      reflectionQuestion: `你可以思考“${symbol}”在这次梦里带来的感受。`
    })),
    reflectionQuestions: legacy.reflectionQuestions,
    gentleAction: "",
    safetyReminder: legacy.gentleReminder
  };
}

function normalizeDeepReportOutput(parsed) {
  if (
    !isPlainObject(parsed) ||
    typeof parsed.summary !== "string" ||
    typeof parsed.emotionClues !== "string" ||
    typeof parsed.coreImages !== "string" ||
    typeof parsed.jungianView !== "string" ||
    typeof parsed.lifeConnection !== "string" ||
    typeof parsed.reflectionQuestions !== "string" ||
    typeof parsed.smallAction !== "string" ||
    typeof parsed.gentleReminder !== "string"
  ) {
    return null;
  }

  return {
    summary: normalizeText(parsed.summary),
    emotionClues: normalizeText(parsed.emotionClues),
    coreImages: normalizeText(parsed.coreImages),
    jungianView: normalizeText(parsed.jungianView),
    lifeConnection: normalizeText(parsed.lifeConnection),
    reflectionQuestions: normalizeText(parsed.reflectionQuestions),
    smallAction: normalizeText(parsed.smallAction),
    gentleReminder: normalizeText(parsed.gentleReminder)
  };
}

function normalizeGuidedQuestionsOutput(parsed) {
  const questions = isPlainObject(parsed) && Array.isArray(parsed.questions)
    ? parsed.questions
      .filter(isPlainObject)
      .map((question, index) => ({
        id: normalizeText(question.id) || `question-${index + 1}`,
        label: normalizeText(question.label) || "引导问题",
        question: normalizeText(question.question),
        placeholder: normalizeText(question.placeholder) || "可以简单写几句，也可以跳过。"
      }))
      .filter((question) => question.question)
      .slice(0, 5)
    : [];

  return questions.length >= 3 ? { questions } : null;
}

function normalizeCombinedOutput(parsed, normalizeAnalysis, options = {}) {
  if (!isPlainObject(parsed)) return null;

  const analysis = normalizeAnalysis(parsed.analysis)
    || (options.allowLegacyQuickShape ? normalizeLegacyQuickAnalysisOutput(parsed) : null);

  if (!analysis) return null;

  const dreamResultCard = normalizeDeepSeekResultCardOutput(parsed.dreamResultCard);

  if (!dreamResultCard) {
    return {
      analysis,
      dreamResultCardStatus: "generation_failed"
    };
  }

  return {
    analysis,
    dreamResultCard,
    dreamResultCardStatus: "ai_generated"
  };
}

function normalizeDeepSeekResultCardOutput(parsed) {
  if (
    !isPlainObject(parsed) ||
    !isPlainObject(parsed.archetype) ||
    typeof parsed.coreInsight !== "string" ||
    !Array.isArray(parsed.dimensions) ||
    !Array.isArray(parsed.symbols) ||
    !isPlainObject(parsed.emotionalProfile) ||
    !Array.isArray(parsed.reflectionQuestions) ||
    typeof parsed.safetyReminder !== "string"
  ) {
    return null;
  }

  if (
    typeof parsed.archetype.id !== "string" ||
    typeof parsed.archetype.summary !== "string" ||
    !parsed.dimensions.every((dimension) => isPlainObject(dimension) && typeof dimension.id === "string") ||
    !parsed.symbols.every((symbol) => isPlainObject(symbol) && typeof symbol.name === "string") ||
    typeof parsed.emotionalProfile.primary !== "string"
  ) {
    return null;
  }

  return DreamResultCard.normalizeDreamResultCard(parsed);
}

function hasModelText(value) {
  return normalizeText(value).length > 0;
}

function hasModelScore(value) {
  if (value === null || value === undefined || value === "") return false;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100;
}

function hasModelTextList(value, minLength = 1) {
  return Array.isArray(value) && value.filter(hasModelText).length >= minLength;
}

function validateRawResultCardCompleteness(card) {
  const issues = [];

  if (!isPlainObject(card)) {
    return ["缺少完整 dreamResultCard。"];
  }

  if (!isPlainObject(card.archetype) || !hasModelText(card.archetype.id) || !hasModelText(card.archetype.summary) || !hasModelTextList(card.archetype.evidence, 2)) {
    issues.push("梦境原型缺少真实 id、summary 或至少 2 条 evidence。");
  } else if (!DreamArchetypes.getArchetypeById(card.archetype.id)) {
    issues.push("梦境原型必须使用稳定原型集合中的 id。");
  }

  if (!hasModelText(card.coreInsight)) {
    issues.push("一句话核心洞察缺失。");
  }

  if (!Array.isArray(card.dimensions)) {
    issues.push("四个梦境维度必须齐全。");
  } else {
    requiredResultCardDimensionIds.forEach((id) => {
      const dimension = card.dimensions.find((item) => isPlainObject(item) && item.id === id);
      if (!dimension || !hasModelScore(dimension.score) || !hasModelText(dimension.summary) || !hasModelTextList(dimension.rationale)) {
        issues.push(`${id} 缺少真实分数、summary 或 rationale。`);
      }
    });
  }

  const symbols = Array.isArray(card.symbols) ? card.symbols.slice(0, 3) : [];
  if (!symbols.length) {
    issues.push("梦境画像主要意象缺失。");
  } else if (!symbols.every((symbol) => (
    isPlainObject(symbol)
    && hasModelText(symbol.name)
    && hasModelText(symbol.contextMeaning)
    && hasModelText(symbol.evidence)
    && hasModelText(symbol.reflectionQuestion)
  ))) {
    issues.push("梦境画像主要意象缺少语境解释、证据或反思问题。");
  }

  if (
    !isPlainObject(card.emotionalProfile) ||
    !hasModelText(card.emotionalProfile.primary) ||
    !hasModelScore(card.emotionalProfile.intensity) ||
    !hasModelText(card.emotionalProfile.evidence)
  ) {
    issues.push("情绪画像必须包含真实主要情绪、强度和梦境线索。");
  }

  if (!hasModelTextList(card.reflectionQuestions)) {
    issues.push("梦境画像自我思考问题缺失。");
  }

  if (!hasModelText(card.safetyReminder) || !normalizeText(card.safetyReminder).includes("这不是诊断、治疗或预言，只是一种自我探索视角")) {
    issues.push("梦境画像安全提醒缺失。");
  }

  return issues;
}

const forbiddenAnalysisLanguage = /算命|吉凶|预言|预测未来|命运|你就是|这(?:说明|代表)[：:，,\s]*你?一定|一定代表|绝对|必然|注定|诊断为|抑郁症|焦虑症|PTSD|心理治疗|治疗方案|治疗建议|药物治疗|会发财|会倒霉|会遇灾|恋爱成功/u;

function getTextLength(value) {
  return normalizeText(value).length;
}

function getDreamAnchors(dreamText) {
  const text = normalizeText(dreamText);
  const anchors = new Set();
  const knownTerms = ["学校", "教室", "走廊", "考试", "动物", "黑狗", "狗", "猫", "死亡", "追赶", "飞行", "迷路", "海洋", "水", "河", "门", "桥", "妈妈", "父亲", "恋人", "朋友", "下雨", "发光"];

  knownTerms.forEach((term) => {
    if (text.includes(term)) {
      anchors.add(term);
    }
  });

  const chineseRuns = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  chineseRuns.forEach((run) => {
    for (let index = 0; index <= run.length - 2; index += 1) {
      const anchor = run.slice(index, index + 2);
      if (!["一个", "一种", "自己", "一直", "最后", "然后", "这个", "那个"].includes(anchor)) {
        anchors.add(anchor);
      }
    }
  });

  return Array.from(anchors);
}

function hasDreamAnchor(value, dreamAnchors) {
  const text = normalizeText(value);
  return dreamAnchors.some((anchor) => text.includes(anchor));
}

function collectAnalysisText(analysis) {
  return [
    analysis.dreamSummary,
    analysis.coreTheme,
    analysis.coreInterpretation,
    ...(analysis.evidence || []).flatMap((item) => [item.dreamFragment, item.interpretation]),
    analysis.emotionalReading && analysis.emotionalReading.evidence,
    ...(analysis.symbolReading || []).flatMap((item) => [item.symbol, item.context, item.possibleMeaning, item.evidence, item.reflectionQuestion]),
    ...(analysis.reflectionQuestions || []),
    analysis.gentleAction
  ].filter(Boolean).join("\n");
}

function validateQuickAnalysisQuality(analysis, dreamText) {
  const issues = [];
  const dreamAnchors = getDreamAnchors(dreamText);

  if (!analysis) {
    return ["缺少完整 analysis。"];
  }

  if (getTextLength(analysis.dreamSummary) < 40) {
    issues.push("梦境摘要过短，必须使用当前梦境的具体人物、场景和事件。");
  }

  if (getTextLength(analysis.coreTheme) < 18) {
    issues.push("核心主题过短或缺失。");
  }

  if (getTextLength(analysis.coreInterpretation) < 120) {
    issues.push("核心解析过短，必须引用至少两个梦境细节。");
  }

  if (!Array.isArray(analysis.evidence) || analysis.evidence.length < 2) {
    issues.push("证据与解释至少需要 2 条。");
  } else {
    const anchoredEvidenceCount = analysis.evidence.filter((item) => (
      hasDreamAnchor(`${item.dreamFragment} ${item.interpretation}`, dreamAnchors)
      && getTextLength(item.interpretation) >= 20
    )).length;

    if (anchoredEvidenceCount < 2) {
      issues.push("至少 2 条证据必须引用当前梦境细节并解释其依据。");
    }
  }

  if (
    !analysis.emotionalReading ||
    !analysis.emotionalReading.primaryEmotion ||
    getTextLength(analysis.emotionalReading.evidence) < 16 ||
    analysis.emotionalReading.intensity === null
  ) {
    issues.push("情绪分析必须包含主要情绪、强度和具体梦境片段依据。");
  }

  if (!Array.isArray(analysis.symbolReading) || analysis.symbolReading.length === 0) {
    issues.push("主要意象至少需要 1 个，并包含语境、可能含义、证据和反思问题。");
  }

  if (!Array.isArray(analysis.reflectionQuestions) || analysis.reflectionQuestions.length !== 3) {
    issues.push("反思问题必须正好 3 个。");
  } else if (!analysis.reflectionQuestions.some((question) => hasDreamAnchor(question, dreamAnchors))) {
    issues.push("反思问题至少有 1 个必须包含当前梦境的具体线索。");
  }

  if (getTextLength(analysis.gentleAction) < 20) {
    issues.push("今日小行动过短或缺失。");
  }

  if (!normalizeText(analysis.safetyReminder).includes("这不是诊断、治疗或预言，只是一种自我探索视角")) {
    issues.push("温和提醒必须保留安全声明。");
  }

  if (forbiddenAnalysisLanguage.test(collectAnalysisText(analysis))) {
    issues.push("输出包含诊断、治疗、预言、算命、固定人格或绝对化语言。");
  }

  return issues;
}

function validateResultCardQuality(card, dreamText) {
  const issues = [];
  const dreamAnchors = getDreamAnchors(dreamText);

  if (!card) {
    return ["缺少完整 dreamResultCard。"];
  }

  if (!card.archetype || !card.archetype.id || !card.archetype.summary || !Array.isArray(card.archetype.evidence) || card.archetype.evidence.length < 2) {
    issues.push("梦境原型缺少 id、summary 或至少 2 条 evidence。");
  }

  if (!Array.isArray(card.dimensions) || card.dimensions.length !== 4) {
    issues.push("四个梦境维度必须齐全。");
  } else {
    requiredResultCardDimensionIds.forEach((id) => {
      const dimension = card.dimensions.find((item) => item.id === id);
      if (!dimension || dimension.score === null || !Array.isArray(dimension.rationale) || dimension.rationale.length === 0) {
        issues.push(`${id} 缺少分数或 rationale。`);
      } else if (!dimension.rationale.some((item) => hasDreamAnchor(item, dreamAnchors))) {
        issues.push(`${id} 的 rationale 缺少当前梦境依据。`);
      }
    });
  }

  if (!Array.isArray(card.symbols) || card.symbols.length === 0 || card.symbols.length > 3) {
    issues.push("梦境画像主要意象必须为 1-3 个。");
  }

  if (!card.emotionalProfile || !card.emotionalProfile.primary || card.emotionalProfile.intensity === null || !hasDreamAnchor(card.emotionalProfile.evidence, dreamAnchors)) {
    issues.push("情绪画像必须包含主要情绪、强度和当前梦境线索。");
  }

  if (!Array.isArray(card.reflectionQuestions) || card.reflectionQuestions.length === 0) {
    issues.push("梦境画像自我思考问题缺失。");
  }

  if (!normalizeText(card.safetyReminder).includes("这不是诊断、治疗或预言，只是一种自我探索视角")) {
    issues.push("梦境画像安全提醒缺失。");
  }

  return issues;
}

function normalizeQuickCombinedOutput(parsed, dreamText) {
  if (!isPlainObject(parsed)) return { output: null, issues: ["返回内容不是 JSON 对象。"] };

  const analysis = normalizeQuickAnalysisOutput(parsed.analysis)
    || normalizeLegacyQuickAnalysisOutput(parsed);

  if (!analysis) {
    return { output: null, issues: ["缺少完整快速解析结构。"] };
  }

  const analysisIssues = validateQuickAnalysisQuality(analysis, dreamText);
  if (analysisIssues.length) {
    return { output: null, issues: analysisIssues };
  }

  const rawCardIssues = validateRawResultCardCompleteness(parsed.dreamResultCard);
  const dreamResultCard = rawCardIssues.length ? null : normalizeDeepSeekResultCardOutput(parsed.dreamResultCard);
  const cardIssues = rawCardIssues.length
    ? rawCardIssues
    : (dreamResultCard ? validateResultCardQuality(dreamResultCard, dreamText) : ["梦境画像暂时未能完整生成。"]);
  const generationMeta = normalizeGenerationMeta(parsed.generationMeta);

  if (!dreamResultCard || cardIssues.length) {
    return {
      output: null,
      analysis,
      issues: cardIssues.length ? cardIssues : ["梦境画像暂时未能完整生成。"],
      issueScope: "dreamResultCard"
    };
  }

  return {
    output: {
      analysis,
      dreamResultCard,
      dreamResultCardStatus: "ai_generated",
      generationMeta
    },
    issues: []
  };
}

function normalizeStandaloneResultCardOutput(parsed, dreamText) {
  const envelope = extractResultCardEnvelope(parsed);

  if (!envelope.card) {
    return { output: null, issues: ["返回内容不是合法 Dream Result Card JSON 对象。"], generationMeta: envelope.generationMeta };
  }

  const rawCardIssues = validateRawResultCardCompleteness(envelope.card);
  const dreamResultCard = rawCardIssues.length ? null : normalizeDeepSeekResultCardOutput(envelope.card);
  const cardIssues = rawCardIssues.length
    ? rawCardIssues
    : (dreamResultCard ? validateResultCardQuality(dreamResultCard, dreamText) : ["梦境画像暂时未能完整生成。"]);

  return !dreamResultCard || cardIssues.length
    ? { output: null, issues: cardIssues, generationMeta: envelope.generationMeta }
    : { output: dreamResultCard, issues: [], generationMeta: envelope.generationMeta };
}

function extractResultCardEnvelope(parsed) {
  if (!isPlainObject(parsed)) {
    return { card: null, generationMeta: normalizeGenerationMeta(null) };
  }

  return {
    card: isPlainObject(parsed.dreamResultCard) ? parsed.dreamResultCard : parsed,
    generationMeta: normalizeGenerationMeta(parsed.generationMeta)
  };
}

function normalizeGenerationMeta(rawMeta, overrides = {}) {
  const meta = isPlainObject(rawMeta) ? rawMeta : {};
  const limitedEvidence = typeof overrides.limitedEvidence === "boolean"
    ? overrides.limitedEvidence
    : meta.limitedEvidence === true;
  const evidenceConfidence = overrides.limitedEvidence === true
    ? "low"
    : ["low", "medium", "high"].includes(meta.evidenceConfidence)
    ? meta.evidenceConfidence
    : (limitedEvidence ? "low" : "high");

  return {
    source: "ai_generated",
    promptVersion: quickPromptVersion,
    qualityStatus: "passed",
    limitedEvidence,
    evidenceConfidence
  };
}

function getAnalyticsOutcome(errorCode) {
  if (errorCode === "UPSTREAM_TIMEOUT") {
    return "timeout";
  }

  if (errorCode === "GENERATION_INCOMPLETE") {
    return "generation_incomplete";
  }

  return "upstream_error";
}

function readUsageNumber(usage, key) {
  if (!usage || usage[key] === null || usage[key] === undefined || (typeof usage[key] === "string" && !usage[key].trim())) {
    return null;
  }

  const number = Number(usage[key]);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function combineUpstreamUsage(left, right) {
  const keys = ["prompt_tokens", "completion_tokens", "total_tokens"];
  const combined = {};
  let hasAnyValue = false;

  keys.forEach((key) => {
    const leftValue = readUsageNumber(left, key);
    const rightValue = readUsageNumber(right, key);

    if (leftValue === null && rightValue === null) {
      combined[key] = null;
      return;
    }

    combined[key] = (leftValue || 0) + (rightValue || 0);
    hasAnyValue = true;
  });

  return hasAnyValue ? combined : null;
}

function getTimeoutStageCode(stage) {
  if (stage === "initial") return "INITIAL_TIMEOUT";
  if (stage === "repair") return "REPAIR_TIMEOUT";
  if (stage === "limited") return "LIMITED_TIMEOUT";
  return "UPSTREAM_TIMEOUT";
}

function createStageTimeoutError(stage) {
  return createApiError("UPSTREAM_TIMEOUT", "AI 暂时没有及时回应，请稍后再试。", 504, {
    generationStage: stage,
    internalErrorCode: getTimeoutStageCode(stage)
  });
}

function appendStageDuration(analyticsMeta, stage, startedAt) {
  if (!analyticsMeta) return;
  if (!analyticsMeta.stageDurations || typeof analyticsMeta.stageDurations !== "object") {
    analyticsMeta.stageDurations = {};
  }
  analyticsMeta.stageDurations[stage] = Date.now() - startedAt;
  analyticsMeta.generationStage = stage;
}

async function runDeepSeekStage(stage, timeoutMs, totalDeadlineAt, task, analyticsMeta) {
  const startedAt = Date.now();
  const remainingTotalMs = totalDeadlineAt - startedAt;

  if (remainingTotalMs <= 0) {
    appendStageDuration(analyticsMeta, stage, startedAt);
    throw createStageTimeoutError(stage);
  }

  const abortController = new AbortController();
  const stageTimeout = setTimeout(
    () => abortController.abort(),
    Math.max(1, Math.min(timeoutMs, remainingTotalMs))
  );
  if (typeof stageTimeout.unref === "function") {
    stageTimeout.unref();
  }

  try {
    return await task(abortController.signal);
  } catch (error) {
    if (error && error.code === "UPSTREAM_TIMEOUT") {
      error.generationStage = stage;
      error.internalErrorCode = getTimeoutStageCode(stage);
    }
    throw error;
  } finally {
    clearTimeout(stageTimeout);
    appendStageDuration(analyticsMeta, stage, startedAt);
  }
}

async function recordAiUsageEvent(context) {
  const analyticsEnv = getAnalyticsEnv();
  const principalHash = createPrincipalHash(context.identity, context.request, analyticsEnv.ANALYTICS_HASH_SECRET);

  if (!principalHash) {
    return { ok: false, skipped: true };
  }

  const event = buildUsageEvent({
    requestId: context.requestId,
    occurredAt: context.occurredAt,
    identity: context.identity,
    principalHash,
    analysisType: context.analysisType,
    outcome: context.outcome,
    errorCode: context.errorCode,
    httpStatus: context.httpStatus,
    durationMs: Date.now() - context.startedAt,
    qualityRetryCount: context.analyticsMeta && context.analyticsMeta.qualityRetryCount,
    promptVersion: context.analyticsMeta && context.analyticsMeta.promptVersion,
    model: context.analyticsMeta && context.analyticsMeta.model,
    upstreamUsage: context.analyticsMeta && context.analyticsMeta.upstreamUsage,
    generationStage: context.analyticsMeta && context.analyticsMeta.generationStage,
    stageDurations: context.analyticsMeta && context.analyticsMeta.stageDurations,
    validationIssueCodes: context.analyticsMeta && context.analyticsMeta.validationIssueCodes,
    finalErrorCode: context.analyticsMeta && context.analyticsMeta.finalErrorCode,
    env: analyticsEnv
  });

  return recordUsageEventSafely(getAnalyticsClient(), event, getAnalyticsLogger());
}

function dispatchAiUsageEvent(context) {
  const promise = recordAiUsageEvent(context);

  if (shouldAwaitAnalyticsWrites()) {
    return promise;
  }

  promise.catch(() => {});
  return Promise.resolve({ ok: false, detached: true });
}

function getUserPrompt(dreamText, analysisType, options = {}) {
  if (analysisType === "result_card") {
    return buildResultCardUserPrompt(dreamText);
  }

  if (analysisType === "guided_questions") {
    return buildGuidedQuestionsUserPrompt(dreamText);
  }

  if (analysisType === "guided_final") {
    return buildGuidedFinalUserPrompt(dreamText, options.guidedAnswers);
  }

  return buildUserPrompt(dreamText);
}

function getRetryUserPrompt(dreamText, analysisType, issues) {
  if (analysisType === "result_card") {
    return buildResultCardRetryUserPrompt(dreamText, issues);
  }

  return buildQuickRetryUserPrompt(dreamText, issues);
}

async function requestDeepSeekCompletion(dreamText, analysisType, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    const missingKeyError = createApiError("UPSTREAM_UNAVAILABLE", "梦境解析服务暂时不可用，请稍后再试。", 502);
    missingKeyError.statusCode = 502;
    throw missingKeyError;
  }

  let response;
  try {
    response = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
      method: "POST",
      signal: options.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: deepSeekModel,
        temperature: 0.55,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          {
            role: "user",
            content: options.userPrompt
              ? options.userPrompt
              : options.retryIssues && options.retryIssues.length
              ? getRetryUserPrompt(dreamText, analysisType, options.retryIssues)
              : getUserPrompt(dreamText, analysisType, options)
          }
        ]
      })
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw createApiError("UPSTREAM_TIMEOUT", "AI 暂时没有及时回应，请稍后再试。", 504);
    }

    throw createApiError("UPSTREAM_UNAVAILABLE", "梦境解析服务暂时不可用，请稍后再试。", 502);
  }

  if (!response.ok) {
    const upstreamError = createApiError("UPSTREAM_UNAVAILABLE", "梦境解析服务暂时不可用，请稍后再试。", 502);
    upstreamError.statusCode = 502;
    throw upstreamError;
  }

  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";

  return {
    parsed: typeof content === "string" ? parseJsonObject(content) : null,
    usage: data && data.usage ? data.usage : null
  };
}

async function requestDeepSeekAnalysis(dreamText, analysisType, options = {}) {
  const analyticsMeta = {
    upstreamUsage: null,
    qualityRetryCount: 0,
    promptVersion: quickPromptVersion,
    model: deepSeekModel,
    generationStage: "initial",
    stageDurations: {},
    finalErrorCode: null
  };
  const timeoutConfig = options.timeoutConfig || {
    initialAttemptMs: defaultInitialAttemptTimeoutMs,
    repairAttemptMs: defaultRepairAttemptTimeoutMs,
    limitedAttemptMs: defaultLimitedAttemptTimeoutMs,
    totalRequestMs: defaultTotalRequestTimeoutMs
  };
  const totalDeadlineAt = Date.now() + timeoutConfig.totalRequestMs;
  const requestOptions = { ...options };
  delete requestOptions.signal;
  delete requestOptions.timeoutConfig;
  let completion;
  try {
    completion = await runDeepSeekStage(
      "initial",
      timeoutConfig.initialAttemptMs,
      totalDeadlineAt,
      (signal) => requestDeepSeekCompletion(dreamText, analysisType, { ...requestOptions, signal }),
      analyticsMeta
    );
  } catch (error) {
    analyticsMeta.finalErrorCode = error.internalErrorCode || error.code || "UPSTREAM_UNAVAILABLE";
    error.analyticsMeta = analyticsMeta;
    throw error;
  }
  const parsed = completion.parsed;
  analyticsMeta.upstreamUsage = combineUpstreamUsage(analyticsMeta.upstreamUsage, completion.usage);
  let normalized = null;

  if (analysisType === "result_card") {
    let result = normalizeStandaloneResultCardOutput(parsed, dreamText);
    normalized = result.output;

    if (!normalized) {
      analyticsMeta.qualityRetryCount += 1;
      let retryCompletion;
      try {
        retryCompletion = await runDeepSeekStage(
          "repair",
          timeoutConfig.repairAttemptMs,
          totalDeadlineAt,
          (signal) => requestDeepSeekCompletion(dreamText, analysisType, {
            ...requestOptions,
            retryIssues: result.issues,
            signal
          }),
          analyticsMeta
        );
      } catch (error) {
        analyticsMeta.finalErrorCode = error.internalErrorCode || error.code || "UPSTREAM_UNAVAILABLE";
        error.analyticsMeta = analyticsMeta;
        throw error;
      }
      analyticsMeta.upstreamUsage = combineUpstreamUsage(analyticsMeta.upstreamUsage, retryCompletion.usage);
      result = normalizeStandaloneResultCardOutput(retryCompletion.parsed, dreamText);
      normalized = result.output;

      if (!normalized) {
        analyticsMeta.qualityRetryCount += 1;
        let limitedCompletion;
        try {
          limitedCompletion = await runDeepSeekStage(
            "limited",
            timeoutConfig.limitedAttemptMs,
            totalDeadlineAt,
            (signal) => requestDeepSeekCompletion(dreamText, analysisType, {
              ...requestOptions,
              userPrompt: buildLimitedEvidenceResultCardUserPrompt(dreamText, null, result.issues),
              signal
            }),
            analyticsMeta
          );
        } catch (error) {
          analyticsMeta.finalErrorCode = error.internalErrorCode || error.code || "UPSTREAM_UNAVAILABLE";
          error.analyticsMeta = analyticsMeta;
          throw error;
        }
        analyticsMeta.upstreamUsage = combineUpstreamUsage(analyticsMeta.upstreamUsage, limitedCompletion.usage);
        result = normalizeStandaloneResultCardOutput(limitedCompletion.parsed, dreamText);
        normalized = result.output;

        if (!normalized) {
          const incompleteError = new Error("Dream result card generation was incomplete.");
          incompleteError.code = "GENERATION_INCOMPLETE";
          incompleteError.statusCode = 422;
          incompleteError.status = 422;
          incompleteError.generationMeta = {
            source: "generation_failed",
            promptVersion: quickPromptVersion,
            qualityStatus: "incomplete"
          };
          applyValidationIssueAnalytics(analyticsMeta, result.issues);
          incompleteError.analyticsMeta = analyticsMeta;
          throw incompleteError;
        }
      }
    }
  } else if (parsed && analysisType === "guided_questions") {
    normalized = normalizeGuidedQuestionsOutput(parsed);
  } else if (parsed && analysisType === "guided_final") {
    normalized = normalizeCombinedOutput(parsed, normalizeDeepReportOutput);
  } else if (analysisType === "quick") {
    let result = parsed ? normalizeQuickCombinedOutput(parsed, dreamText) : { output: null, issues: ["返回内容不是合法 JSON。"] };
    normalized = result.output;

    if (!normalized && result.analysis && result.issueScope === "dreamResultCard") {
      analyticsMeta.qualityRetryCount += 1;
      let repairCompletion;
      try {
        repairCompletion = await runDeepSeekStage(
          "repair",
          timeoutConfig.repairAttemptMs,
          totalDeadlineAt,
          (signal) => requestDeepSeekCompletion(dreamText, analysisType, {
            ...requestOptions,
            userPrompt: buildQuickResultCardRepairUserPrompt(dreamText, result.analysis, result.issues),
            signal
          }),
          analyticsMeta
        );
      } catch (error) {
        analyticsMeta.finalErrorCode = error.internalErrorCode || error.code || "UPSTREAM_UNAVAILABLE";
        error.analyticsMeta = analyticsMeta;
        throw error;
      }
      analyticsMeta.upstreamUsage = combineUpstreamUsage(analyticsMeta.upstreamUsage, repairCompletion.usage);
      let repairedCard = normalizeStandaloneResultCardOutput(repairCompletion.parsed, dreamText);

      if (!repairedCard.output) {
        analyticsMeta.qualityRetryCount += 1;
        let limitedCompletion;
        try {
          limitedCompletion = await runDeepSeekStage(
            "limited",
            timeoutConfig.limitedAttemptMs,
            totalDeadlineAt,
            (signal) => requestDeepSeekCompletion(dreamText, analysisType, {
              ...requestOptions,
              userPrompt: buildLimitedEvidenceResultCardUserPrompt(dreamText, result.analysis, repairedCard.issues),
              signal
            }),
            analyticsMeta
          );
        } catch (error) {
          analyticsMeta.finalErrorCode = error.internalErrorCode || error.code || "UPSTREAM_UNAVAILABLE";
          error.analyticsMeta = analyticsMeta;
          throw error;
        }
        analyticsMeta.upstreamUsage = combineUpstreamUsage(analyticsMeta.upstreamUsage, limitedCompletion.usage);
        repairedCard = normalizeStandaloneResultCardOutput(limitedCompletion.parsed, dreamText);
        if (repairedCard.output) {
          repairedCard.generationMeta = normalizeGenerationMeta(repairedCard.generationMeta, { limitedEvidence: true });
        }
      }

      if (repairedCard.output) {
        normalized = {
          analysis: result.analysis,
          dreamResultCard: repairedCard.output,
          dreamResultCardStatus: "ai_generated",
          generationMeta: repairedCard.generationMeta
        };
      } else {
        const incompleteError = new Error("Dream analysis result was incomplete.");
        incompleteError.code = "GENERATION_INCOMPLETE";
        incompleteError.statusCode = 422;
        incompleteError.status = 422;
        incompleteError.generationMeta = {
          source: "generation_failed",
          promptVersion: quickPromptVersion,
          qualityStatus: "incomplete"
        };
        applyValidationIssueAnalytics(analyticsMeta, repairedCard.issues);
        incompleteError.analyticsMeta = analyticsMeta;
        throw incompleteError;
      }
    } else if (!normalized) {
      analyticsMeta.qualityRetryCount += 1;
      let retryCompletion;
      try {
        retryCompletion = await runDeepSeekStage(
          "repair",
          timeoutConfig.repairAttemptMs,
          totalDeadlineAt,
          (signal) => requestDeepSeekCompletion(dreamText, analysisType, {
            ...requestOptions,
            retryIssues: result.issues,
            signal
          }),
          analyticsMeta
        );
      } catch (error) {
        analyticsMeta.finalErrorCode = error.internalErrorCode || error.code || "UPSTREAM_UNAVAILABLE";
        error.analyticsMeta = analyticsMeta;
        throw error;
      }
      analyticsMeta.upstreamUsage = combineUpstreamUsage(analyticsMeta.upstreamUsage, retryCompletion.usage);
      const retryParsed = retryCompletion.parsed;
      result = retryParsed ? normalizeQuickCombinedOutput(retryParsed, dreamText) : { output: null, issues: ["重试后仍不是合法 JSON。"] };
      normalized = result.output;

      if (!normalized) {
        const incompleteError = new Error("Dream analysis result was incomplete.");
        incompleteError.code = "GENERATION_INCOMPLETE";
        incompleteError.statusCode = 422;
        incompleteError.status = 422;
        incompleteError.generationMeta = {
          source: "generation_failed",
          promptVersion: quickPromptVersion,
          qualityStatus: "incomplete"
        };
        applyValidationIssueAnalytics(analyticsMeta, result.issues);
        incompleteError.analyticsMeta = analyticsMeta;
        throw incompleteError;
      }
    }
  } else if (parsed) {
    normalized = normalizeCombinedOutput(parsed, normalizeQuickAnalysisOutput, { allowLegacyQuickShape: true });
  }

  if (!normalized) {
    const invalidJsonError = createApiError("UPSTREAM_UNAVAILABLE", "梦境解析服务暂时不可用，请稍后再试。", 502);
    invalidJsonError.statusCode = 502;
    analyticsMeta.finalErrorCode = invalidJsonError.code;
    invalidJsonError.analyticsMeta = analyticsMeta;
    throw invalidJsonError;
  }

  if (normalized && typeof normalized === "object") {
    analyticsMeta.finalErrorCode = null;
    normalized.__analyticsMeta = analyticsMeta;
  }

  return normalized;
}

async function handleDreamAnalysisRequest(request, response) {
  response.set("Cache-Control", "no-store");
  const requestId = crypto.randomUUID();
  const occurredAt = new Date();
  const startedAt = Date.now();

  const validation = validateDreamAnalysisRequest(request.body || {});

  if (validation.error) {
    sendApiError(response, createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400));
    return;
  }

  const accessControl = getAiAccessControl();
  let identity;
  try {
    identity = await getAiAuthResolver().resolveIdentity(request);
  } catch (error) {
    sendApiError(response, error);
    return;
  }

  if (["guided_questions", "guided_final"].includes(request.body.analysisType) && !isDeepGuidanceEnabled()) {
    sendApiError(
      response,
      createApiError("FEATURE_DISABLED", "深度引导正在开发中。", 403),
      accessControl.getUsage(identity)
    );
    return;
  }

  let reservation;
  let analyticsMeta = null;
  try {
    reservation = accessControl.start(identity, request.body.analysisType);

    const analysis = await requestDeepSeekAnalysis(validation.dreamText, request.body.analysisType, {
      guidedAnswers: validation.guidedAnswers,
      timeoutConfig: getAiTimeoutConfig()
    });
    analyticsMeta = analysis && analysis.__analyticsMeta ? analysis.__analyticsMeta : null;
    if (analysis && typeof analysis === "object") {
      delete analysis.__analyticsMeta;
    }
    accessControl.finish(reservation, { refundDaily: false });
    reservation = null;

    const usage = accessControl.getUsage(identity);
    await dispatchAiUsageEvent({
      request,
      requestId,
      occurredAt,
      startedAt,
      identity,
      analysisType: request.body.analysisType,
      outcome: "success",
      httpStatus: 200,
      analyticsMeta
    });
    response.json({
      ...(request.body.analysisType === "result_card" ? { analysis } : analysis),
      usage
    });
  } catch (error) {
    const code = error.code || (error.statusCode === 422 ? "GENERATION_INCOMPLETE" : "UPSTREAM_UNAVAILABLE");
    const apiError = error.code
      ? error
      : createApiError(code, code === "GENERATION_INCOMPLETE" ? "AI 结果暂时不够完整，请稍后再试。" : "梦境解析服务暂时不可用，请稍后再试。", error.statusCode || 502);

    if (error.generationMeta && !apiError.generationMeta) {
      apiError.generationMeta = error.generationMeta;
    }
    analyticsMeta = error.analyticsMeta || analyticsMeta;

    if (reservation) {
      accessControl.finish(reservation, {
        refundDaily: ["UPSTREAM_TIMEOUT", "UPSTREAM_UNAVAILABLE", "GENERATION_INCOMPLETE"].includes(apiError.code)
      });
    }

    if (identity && reservation) {
      await dispatchAiUsageEvent({
        request,
        requestId,
        occurredAt,
        startedAt,
        identity,
        analysisType: request.body.analysisType,
        outcome: getAnalyticsOutcome(apiError.code),
        errorCode: analyticsMeta && analyticsMeta.finalErrorCode ? analyticsMeta.finalErrorCode : apiError.code,
        httpStatus: apiError.status || apiError.statusCode || 500,
        analyticsMeta
      });
    }

    sendApiError(response, apiError, identity ? accessControl.getUsage(identity) : null);
  }
}
async function requireAdminAndAnalyticsClient(request) {
  await getAdminAuth().requireAdminIdentity(request);
  const client = getAnalyticsClient();

  if (!client) {
    throw createApiError("ANALYTICS_UNAVAILABLE", "运营统计暂时不可用，请检查服务端配置。", 503);
  }

  return client;
}

async function handleAdminSummaryRequest(request, response) {
  response.set("Cache-Control", "no-store");

  try {
    const client = await requireAdminAndAnalyticsClient(request);
    const summary = await getAnalyticsSummary(client, {
      range: request.query ? request.query.range : "",
      now: new Date()
    });

    response.json(summary);
  } catch (error) {
    const apiError = error && error.code
      ? error
      : createApiError("INTERNAL_ERROR", "运营统计暂时不可用，请稍后再试。", 500);
    sendApiError(response, apiError);
  }
}

async function handleAdminRecentRequest(request, response) {
  response.set("Cache-Control", "no-store");

  try {
    const client = await requireAdminAndAnalyticsClient(request);
    const recent = await getRecentAnalyticsEvents(client, {
      limit: request.query ? request.query.limit : ""
    });

    response.json(recent);
  } catch (error) {
    const apiError = error && error.code
      ? error
      : createApiError("INTERNAL_ERROR", "运营统计暂时不可用，请稍后再试。", 500);
    sendApiError(response, apiError);
  }
}

async function handleProductEventsRequest(request, response) {
  response.set("Cache-Control", "no-store");

  try {
    if (!request.body || request.body.analyticsConsent !== true) {
      throw createApiError("PRODUCT_ANALYTICS_DISABLED", "产品分析尚未启用，未记录本次事件。", 403);
    }

    const identity = await getAiAuthResolver().resolveIdentity(request);
    const client = getProductAnalyticsClient();
    const analyticsEnv = getAnalyticsEnv();
    if (!client || !analyticsEnv.ANALYTICS_HASH_SECRET) {
      throw createApiError("ANALYTICS_UNAVAILABLE", "运营统计暂时不可用，请检查服务端配置。", 503);
    }

    if (!Array.isArray(request.body.events) || request.body.events.length < 1 || request.body.events.length > 20) {
      throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
    }

    if (identity.type === "authenticated" && request.body.installationId) {
      throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
    }

    if (identity.type === "authenticated") {
      const preference = await hasEnabledProductAnalyticsPreference(client, identity.userId);
      if (!preference.ok) {
        throw createApiError("ANALYTICS_UNAVAILABLE", "运营统计暂时不可用，请检查服务端配置。", 503);
      }
      if (!preference.enabled) {
        throw createApiError("PRODUCT_ANALYTICS_DISABLED", "产品分析尚未启用，未记录本次事件。", 403);
      }
    }

    const normalized = normalizeProductEventBatch(request.body, {
      identity,
      secret: analyticsEnv.ANALYTICS_HASH_SECRET,
      appVersion: PRODUCT_ANALYTICS_VERSION
    });
    if (normalized.rejected.length || normalized.events.length !== request.body.events.length) {
      throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
    }

    const result = await recordProductEventsSafely(client, normalized.events, getAnalyticsLogger());
    if (!result.ok) {
      throw createApiError("PRODUCT_ANALYTICS_WRITE_FAILED", "产品分析暂时无法记录，请稍后再试。", 503);
    }

    response.json({ ok: true, insertedCount: result.insertedCount, duplicateCount: result.duplicateCount });
  } catch (error) {
    const apiError = error && error.code
      ? error
      : createApiError("INTERNAL_ERROR", "服务暂时遇到问题，请稍后再试。", 500);
    sendApiError(response, apiError);
  }
}

async function handleProductAnalyticsDeletionRequest(request, response) {
  response.set("Cache-Control", "no-store");

  try {
    const identity = await getAiAuthResolver().resolveIdentity(request);
    const client = getProductAnalyticsClient();
    const analyticsEnv = getAnalyticsEnv();
    if (!client || !analyticsEnv.ANALYTICS_HASH_SECRET) {
      throw createApiError("ANALYTICS_UNAVAILABLE", "运营统计暂时不可用，请检查服务端配置。", 503);
    }

    const result = await deleteProductEventsForIdentity(
      client,
      identity,
      request.body && request.body.installationId,
      analyticsEnv.ANALYTICS_HASH_SECRET
    );
    if (!result.deleted) {
      throw createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400);
    }

    response.json({ ok: true });
  } catch (error) {
    const apiError = error && error.code
      ? error
      : createApiError("INTERNAL_ERROR", "产品分析数据暂时无法删除，请稍后再试。", 500);
    sendApiError(response, apiError);
  }
}

async function handleAdminProductAnalyticsRequest(request, response, getReport) {
  response.set("Cache-Control", "no-store");

  try {
    await getAdminAuth().requireAdminIdentity(request);
    const client = getProductAnalyticsClient();
    if (!client) {
      throw createApiError("ANALYTICS_UNAVAILABLE", "运营统计暂时不可用，请检查服务端配置。", 503);
    }
    response.json(await getReport(client, { range: request.query ? request.query.range : "", now: new Date() }));
  } catch (error) {
    const apiError = error && error.code
      ? error
      : createApiError("INTERNAL_ERROR", "运营统计暂时不可用，请稍后再试。", 500);
    sendApiError(response, apiError);
  }
}

function handleAdminProductSummaryRequest(request, response) {
  return handleAdminProductAnalyticsRequest(request, response, getProductAnalyticsSummary);
}

function handleAdminProductFunnelRequest(request, response) {
  return handleAdminProductAnalyticsRequest(request, response, getProductAnalyticsFunnel);
}

function handleAdminProductRetentionRequest(request, response) {
  return handleAdminProductAnalyticsRequest(request, response, getProductAnalyticsRetention);
}

async function handleAccountDeletionRequest(request, response) {
  response.set("Cache-Control", "no-store");

  try {
    const result = await getAccountDeletionService().deleteAccount(request);
    response.json(result);
  } catch (error) {
    const apiError = error && error.code
      ? error
      : createApiError("INTERNAL_ERROR", "账户注销暂时没有完成，请稍后重试。", 500);
    sendApiError(response, apiError);
  }
}

async function handleWechatLoginRequest(request, response) {
  response.set("Cache-Control", "no-store");

  try {
    const result = await getWechatAuthService().login(request);
    response.json(result);
  } catch (error) {
    const apiError = error && error.code
      ? error
      : createApiError("INTERNAL_ERROR", "微信身份服务暂时不可用，请稍后再试。", 500);
    sendApiError(response, apiError);
  }
}

async function handleWechatSessionRequest(request, response) {
  response.set("Cache-Control", "no-store");

  try {
    const result = await getWechatAuthService().getSession(request);
    response.json({
      account: result.account,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    const apiError = error && error.code
      ? error
      : createApiError("INTERNAL_ERROR", "微信身份服务暂时不可用，请稍后再试。", 500);
    sendApiError(response, apiError);
  }
}

async function handleWechatLogoutRequest(request, response) {
  response.set("Cache-Control", "no-store");

  try {
    const result = await getWechatAuthService().logout(request);
    response.json(result);
  } catch (error) {
    const apiError = error && error.code
      ? error
      : createApiError("INTERNAL_ERROR", "微信身份服务暂时不可用，请稍后再试。", 500);
    sendApiError(response, apiError);
  }
}

app.post("/api/v1/dream-analysis", handleDreamAnalysisRequest);
app.post("/api/dream-analysis", handleDreamAnalysisRequest);
app.post("/api/v1/wechat-auth/login", handleWechatLoginRequest);
app.get("/api/v1/wechat-auth/session", handleWechatSessionRequest);
app.post("/api/v1/wechat-auth/logout", handleWechatLogoutRequest);
app.post("/api/v1/product-events", handleProductEventsRequest);
app.delete("/api/v1/product-analytics", handleProductAnalyticsDeletionRequest);
app.get("/api/v1/admin/analytics/summary", handleAdminSummaryRequest);
app.get("/api/v1/admin/analytics/recent", handleAdminRecentRequest);
app.get("/api/v1/admin/product-analytics/summary", handleAdminProductSummaryRequest);
app.get("/api/v1/admin/product-analytics/funnel", handleAdminProductFunnelRequest);
app.get("/api/v1/admin/product-analytics/retention", handleAdminProductRetentionRequest);
app.delete("/api/v1/account", handleAccountDeletionRequest);

app.use((error, request, response, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    sendApiError(response, createApiError("INVALID_REQUEST", "请求内容不完整，请检查后再试。", 400));
    return;
  }

  next(error);
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Dream Anatomy server listening on http://localhost:${port}`);
  });
}

module.exports = {
  app,
  buildSystemPrompt,
  buildGuidedFinalUserPrompt,
  buildGuidedQuestionsUserPrompt,
  buildLimitedEvidenceResultCardUserPrompt,
  buildQuickResultCardRepairUserPrompt,
  buildQuickRetryUserPrompt,
  buildResultCardRetryUserPrompt,
  buildResultCardUserPrompt,
  buildUserPrompt,
  normalizeGuidedQuestionsOutput,
  normalizeQuickAnalysisOutput,
  normalizeQuickCombinedOutput,
  normalizeDeepSeekOutput,
  normalizeDeepSeekResultCardOutput,
  validateQuickAnalysisQuality,
  validateResultCardQuality,
  requestDeepSeekAnalysis,
  validateDreamAnalysisRequest
};
