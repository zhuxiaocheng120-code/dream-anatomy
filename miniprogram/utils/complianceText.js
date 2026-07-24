const replacements = [
  [/这个梦/g, "这个记录片段"],
  [/梦境解析/g, "梦境文字整理"],
  [/AI 解梦/g, "AI 辅助整理"],
  [/梦境画像/g, "梦境线索卡"],
  [/梦境原型/g, "记录类型提示"],
  [/核心解析/g, "文字线索整理"],
  [/象征含义/g, "意象关键词"],
  [/象征着/g, "可能关联着"],
  [/意味着/g, "可能让你联想到"],
  [/预示着/g, "可能让你联想到"],
  [/潜意识告诉你/g, "你可以回想"],
  [/固定含义/g, "固定说法"],
  [/命运判断/g, "现实结论判断"],
  [/预测未来/g, "判断未来"],
  [/吉凶判断/g, "结果判断"],
  [/吉凶/g, "结果"],
  [/算命/g, "记录整理"],
  [/占卜/g, "记录整理"],
  [/通灵/g, "记录整理"],
  [/弗洛伊德/g, "心理学视角"],
  [/荣格/g, "心理学视角"],
  [/命运/g, "生活体验"]
];

function sanitizeComplianceText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  let text = String(value);
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function sanitizeComplianceObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeComplianceObject(item));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).reduce((result, [key, nested]) => {
      result[key] = sanitizeComplianceObject(nested);
      return result;
    }, {});
  }
  if (typeof value === "string") {
    return sanitizeComplianceText(value);
  }
  return value;
}

function formatMiniProgramAnalysisType(value) {
  if (value === "快速解析" || value === "Quick" || value === "quick") return "AI 整理";
  if (value === "深度引导" || value === "Deep" || value === "deep") return "深度记录";
  return sanitizeComplianceText(value || "本机记录");
}

function createMiniProgramDisplayTitle(record = {}) {
  const analysis = record.reportContent && record.reportContent.analysis ? record.reportContent.analysis : {};
  const source = analysis.dreamSummary || record.dreamText || "未命名梦境";
  const sanitized = sanitizeComplianceText(source, "未命名梦境").replace(/\s+/g, " ").trim();
  return sanitized || "未命名梦境";
}

module.exports = {
  createMiniProgramDisplayTitle,
  formatMiniProgramAnalysisType,
  sanitizeComplianceObject,
  sanitizeComplianceText
};
