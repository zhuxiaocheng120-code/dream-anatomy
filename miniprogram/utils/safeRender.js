const unsafeLanguage = /你就是|你一定|必然|绝对|注定|命运|吉凶|算命|预言|预测未来|诊断为|心理治疗|治疗方案|治疗建议/u;

function safeText(value, fallback = "暂未提供") {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || unsafeLanguage.test(text)) return fallback;
  return text;
}

function safeList(value, fallback) {
  return Array.isArray(value)
    ? value.map((item) => safeText(item, fallback)).filter((item) => item && item !== fallback).slice(0, 3)
    : [];
}

module.exports = { safeList, safeText };
