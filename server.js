require("dotenv").config();

const express = require("express");
const path = require("path");
const DreamResultCard = require("./src/dreamResultCard");

const app = express();
const port = process.env.PORT || 3000;
const deepSeekBaseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const deepSeekModel = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const maxDreamTextLength = 5000;

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "src")));

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
    "请基于用户的梦境碎片生成快速解析，并在同一次上下文中生成梦境画像。",
    "快速解析不能只返回几句通用话，必须引用梦中的具体场景。",
    "返回 JSON 结构必须严格符合：",
    "{",
    '  "analysis": {',
    '    "summary": "具体梦境摘要",',
    '    "coreInterpretation": "结合梦中细节的核心解析",',
    '    "emotions": [{ "name": "情绪", "evidence": "梦中证据" }],',
    '    "symbols": [{ "name": "意象", "contextMeaning": "本次梦里的语境解释" }],',
    '    "reflectionQuestions": ["与梦境有关的问题"],',
    '    "gentleReminder": "这不是诊断、治疗或预言，只是一种自我探索视角。"',
    "  },",
    '  "dreamResultCard": {',
    '    "archetype": { "id": "seeker", "summary": "本次梦境更接近寻路者，也许与你正在寻找方向有关。" },',
    '    "coreInsight": "一句温和且不绝对的核心洞察",',
    '    "dimensions": [{ "id": "symbol_depth", "score": 0, "summary": "简短说明", "rationale": ["线索"] }],',
    '    "symbols": [{ "name": "意象", "generalPossibility": "可能性", "contextMeaning": "这次梦里的可能含义", "evidence": "梦中线索", "reflectionQuestion": "开放问题" }],',
    '    "emotionalProfile": { "primary": "主要情绪", "secondary": ["伴随情绪"], "intensity": 0, "evidence": "梦中线索" },',
    '    "reflectionQuestions": ["开放问题"],',
    '    "safetyReminder": "这不是诊断、治疗或预言，只是一种自我探索视角。"',
    "  }",
    "}",
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
    "返回 JSON 结构必须严格符合：",
    "{",
    '  "archetype": { "id": "seeker", "summary": "本次梦境更接近寻路者，也许与你正在寻找方向有关。" },',
    '  "coreInsight": "一句温和且不绝对的核心洞察",',
    '  "dimensions": [{ "id": "symbol_depth", "score": 0, "summary": "简短说明", "rationale": ["线索"] }],',
    '  "symbols": [{ "name": "意象", "generalPossibility": "可能性", "contextMeaning": "这次梦里的可能含义", "evidence": "梦中线索", "reflectionQuestion": "开放问题" }],',
    '  "emotionalProfile": { "primary": "主要情绪", "secondary": ["伴随情绪"], "intensity": 0, "evidence": "梦中线索" },',
    '  "reflectionQuestions": ["开放问题"],',
    '  "safetyReminder": "这不是诊断、治疗或预言，只是一种自我探索视角。"',
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
    '  "dreamResultCard": {',
    '    "archetype": { "id": "seeker", "summary": "本次梦境更接近寻路者，也许与你正在寻找方向有关。" },',
    '    "coreInsight": "一句温和且不绝对的核心洞察",',
    '    "dimensions": [{ "id": "symbol_depth", "score": 0, "summary": "简短说明", "rationale": ["线索"] }],',
    '    "symbols": [{ "name": "意象", "generalPossibility": "可能性", "contextMeaning": "这次梦里的可能含义", "evidence": "梦中线索", "reflectionQuestion": "开放问题" }],',
    '    "emotionalProfile": { "primary": "主要情绪", "secondary": ["伴随情绪"], "intensity": 0, "evidence": "梦中线索" },',
    '    "reflectionQuestions": ["开放问题"],',
    '    "safetyReminder": "这不是诊断、治疗或预言，只是一种自我探索视角。"',
    "  }",
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
    summary: normalizeText(parsed.summary),
    coreInterpretation: normalizeText(parsed.coreInterpretation),
    emotions,
    symbols,
    reflectionQuestions,
    gentleReminder: normalizeText(parsed.gentleReminder)
  };
}

function normalizeLegacyQuickAnalysisOutput(parsed) {
  const legacy = normalizeDeepSeekOutput(parsed);

  if (!legacy) return null;

  return {
    summary: legacy.dreamSummary,
    coreInterpretation: legacy.jungianInterpretation,
    emotions: [{ name: legacy.coreEmotion, evidence: "来自快速解析返回的核心情绪。" }],
    symbols: legacy.symbols.map((symbol) => ({
      name: symbol,
      contextMeaning: "这是快速解析返回的主要意象，可以结合梦境语境继续观察。"
    })),
    reflectionQuestions: legacy.reflectionQuestions,
    gentleReminder: legacy.gentleReminder
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

async function requestDeepSeekAnalysis(dreamText, analysisType, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    const missingKeyError = new Error("DeepSeek API key is not configured.");
    missingKeyError.statusCode = 502;
    throw missingKeyError;
  }

  const response = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: deepSeekModel,
      temperature: 0.6,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: getUserPrompt(dreamText, analysisType, options)
        }
      ]
    })
  });

  if (!response.ok) {
    const upstreamError = new Error("DeepSeek request failed.");
    upstreamError.statusCode = 502;
    throw upstreamError;
  }

  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";
  const parsed = typeof content === "string" ? parseJsonObject(content) : null;
  let normalized = null;

  if (parsed && analysisType === "result_card") {
    normalized = normalizeDeepSeekResultCardOutput(parsed);
  } else if (parsed && analysisType === "guided_questions") {
    normalized = normalizeGuidedQuestionsOutput(parsed);
  } else if (parsed && analysisType === "guided_final") {
    normalized = normalizeCombinedOutput(parsed, normalizeDeepReportOutput);
  } else if (parsed) {
    normalized = normalizeCombinedOutput(parsed, normalizeQuickAnalysisOutput, { allowLegacyQuickShape: true });
  }

  if (!normalized) {
    const invalidJsonError = new Error("DeepSeek response was not valid JSON.");
    invalidJsonError.statusCode = 502;
    throw invalidJsonError;
  }

  return normalized;
}

app.post("/api/dream-analysis", async (request, response) => {
  const validation = validateDreamAnalysisRequest(request.body || {});

  if (validation.error) {
    response.status(400).json({ error: validation.error });
    return;
  }

  try {
    const analysis = await requestDeepSeekAnalysis(validation.dreamText, request.body.analysisType, {
      guidedAnswers: validation.guidedAnswers
    });
    response.json(request.body.analysisType === "result_card" ? { analysis } : analysis);
  } catch (error) {
    const statusCode = error.statusCode || 502;
    response.status(statusCode).json({
      error: "Dream analysis service is temporarily unavailable."
    });
  }
});

app.use((error, request, response, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Request body must be valid JSON." });
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
  buildResultCardUserPrompt,
  normalizeGuidedQuestionsOutput,
  normalizeQuickAnalysisOutput,
  normalizeDeepSeekOutput,
  normalizeDeepSeekResultCardOutput,
  requestDeepSeekAnalysis,
  validateDreamAnalysisRequest
};
