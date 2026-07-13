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
    "请基于用户的梦境碎片生成快速解析。",
    "返回 JSON 结构必须严格符合：",
    "{",
    '  "dreamSummary": "梦境整理",',
    '  "coreEmotion": "核心情绪",',
    '  "symbols": ["象征1", "象征2"],',
    '  "jungianInterpretation": "初步荣格式解读",',
    '  "reflectionQuestions": ["问题1", "问题2"],',
    '  "gentleReminder": "温和提醒"',
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

function validateDreamAnalysisRequest(body) {
  const dreamText = typeof body.dreamText === "string" ? body.dreamText.trim() : "";

  if (!dreamText) {
    return { error: "dreamText must be a non-empty string." };
  }

  if (dreamText.length > maxDreamTextLength) {
    return { error: "dreamText must be 5000 characters or fewer." };
  }

  if (body.analysisType !== "quick" && body.analysisType !== "result_card") {
    return { error: "analysisType must be quick or result_card." };
  }

  return { dreamText };
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

async function requestDeepSeekAnalysis(dreamText, analysisType) {
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
          content: analysisType === "result_card"
            ? buildResultCardUserPrompt(dreamText)
            : buildUserPrompt(dreamText)
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
  const normalized = parsed
    ? analysisType === "result_card"
      ? normalizeDeepSeekResultCardOutput(parsed)
      : normalizeDeepSeekOutput(parsed)
    : null;

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
    const analysis = await requestDeepSeekAnalysis(validation.dreamText, request.body.analysisType);
    response.json({ analysis });
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
  buildResultCardUserPrompt,
  normalizeDeepSeekOutput,
  normalizeDeepSeekResultCardOutput,
  requestDeepSeekAnalysis,
  validateDreamAnalysisRequest
};
