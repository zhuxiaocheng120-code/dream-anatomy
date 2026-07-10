const express = require("express");
const path = require("path");

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

function validateDreamAnalysisRequest(body) {
  const dreamText = typeof body.dreamText === "string" ? body.dreamText.trim() : "";

  if (!dreamText) {
    return { error: "dreamText must be a non-empty string." };
  }

  if (dreamText.length > maxDreamTextLength) {
    return { error: "dreamText must be 5000 characters or fewer." };
  }

  if (body.analysisType !== "quick") {
    return { error: "analysisType must be quick." };
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

async function requestDeepSeekQuickAnalysis(dreamText) {
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
        { role: "user", content: buildUserPrompt(dreamText) }
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
  const normalized = parsed ? normalizeDeepSeekOutput(parsed) : null;

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
    const analysis = await requestDeepSeekQuickAnalysis(validation.dreamText);
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
  normalizeDeepSeekOutput,
  validateDreamAnalysisRequest
};
