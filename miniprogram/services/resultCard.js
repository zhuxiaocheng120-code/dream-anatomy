const { safeList, safeText } = require("../utils/safeRender");
const { sanitizeComplianceText } = require("../utils/complianceText");

const archetypes = {
  seeker: { id: "seeker", nameZh: "寻路者", nameEn: "The Seeker", summary: "本次梦境更接近寻路者原型，也许与你正在寻找方向有关。" },
  explorer: { id: "explorer", nameZh: "探索者", nameEn: "The Explorer", summary: "本次梦境更接近探索者原型，也许与你靠近未知经验有关。" },
  guardian: { id: "guardian", nameZh: "守护者", nameEn: "The Guardian", summary: "本次梦境更接近守护者原型，也许与你在意边界和保护有关。" },
  observer: { id: "observer", nameZh: "观察者", nameEn: "The Observer", summary: "本次梦境更接近观察者原型，也许与你停下来理解自身感受有关。" },
  transformer: { id: "transformer", nameZh: "转变者", nameEn: "The Transformer", summary: "本次梦境更接近转变者原型，也许与你正在经历变化有关。" },
  creator: { id: "creator", nameZh: "创造者", nameEn: "The Creator", summary: "本次梦境更接近创造者原型，也许与你表达和创造有关。" },
  healer: { id: "healer", nameZh: "疗愈者", nameEn: "The Healer", summary: "本次梦境更接近疗愈者原型，也许与你照看感受和恢复有关。" },
  homecomer: { id: "homecomer", nameZh: "归途者", nameEn: "The Homecomer", summary: "本次梦境更接近归途者原型，也许与你寻找熟悉感和归属有关。" }
};

const dimensionDefinitions = [
  { id: "symbol_depth", name: "象征深度" },
  { id: "emotion_intensity", name: "情绪强度" },
  { id: "self_awareness", name: "自我觉察" },
  { id: "growth_signal", name: "成长信号" }
];

function normalizeScore(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function displayText(value, fallback = "") {
  return sanitizeComplianceText(safeText(value, fallback), fallback);
}

function displayList(value, fallback = "") {
  return safeList(value, fallback).map((item) => sanitizeComplianceText(item, fallback));
}

function hasResultCard(raw) {
  if (!raw || typeof raw !== "object") return false;
  const hasArchetype = Boolean(raw.archetype && typeof raw.archetype === "object" && archetypes[raw.archetype.id]);
  const hasInsight = typeof raw.coreInsight === "string" && raw.coreInsight.trim().length > 0;
  const dimensionMap = new Map(Array.isArray(raw.dimensions) ? raw.dimensions.map((item) => [item && item.id, item]) : []);
  const hasAllDimensions = dimensionDefinitions.every((definition) => {
    const dimension = dimensionMap.get(definition.id);
    return Boolean(
      dimension
        && normalizeScore(dimension.score) !== null
        && Array.isArray(dimension.rationale)
        && dimension.rationale.some((item) => typeof item === "string" && item.trim())
    );
  });
  return hasArchetype && hasInsight && hasAllDimensions;
}

function normalizeResultCard(raw = {}) {
  const input = raw && typeof raw === "object" ? raw : {};
  const selected = archetypes[input.archetype && input.archetype.id];
  if (!selected) return null;
  const dimensionMap = new Map(Array.isArray(input.dimensions) ? input.dimensions.map((item) => [item && item.id, item]) : []);
  const emotion = input.emotionalProfile && typeof input.emotionalProfile === "object" ? input.emotionalProfile : {};

  return {
    archetype: {
      ...selected,
      summary: displayText(input.archetype && input.archetype.summary, selected.summary),
      evidence: displayList(input.archetype && input.archetype.evidence, "")
    },
    coreInsight: displayText(input.coreInsight, "暂未生成一句话回顾。"),
    dimensions: dimensionDefinitions.map((definition) => {
      const value = dimensionMap.get(definition.id) || {};
      return {
        id: definition.id,
        name: definition.name,
        score: normalizeScore(value.score),
        summary: displayText(value.summary, "暂未生成"),
        rationale: displayList(value.rationale, "")
      };
    }),
    symbols: Array.isArray(input.symbols)
      ? input.symbols.slice(0, 3).map((symbol) => ({
          name: displayText(symbol && symbol.name, "未命名意象"),
          contextMeaning: displayText(symbol && symbol.contextMeaning, "暂未生成"),
          evidence: displayText(symbol && symbol.evidence, "暂未生成"),
          reflectionQuestion: displayText(symbol && symbol.reflectionQuestion, "这个意象让你想到什么？")
        }))
      : [],
    emotionalProfile: {
      primary: displayText(emotion.primary, "未记录"),
      secondary: displayList(emotion.secondary, ""),
      intensity: normalizeScore(emotion.intensity),
      evidence: displayText(emotion.evidence, "暂未生成")
    },
    reflectionQuestions: displayList(input.reflectionQuestions, ""),
    safetyReminder: "本内容仅用于记录和自我反思，不代表梦境有固定说法，也不用于判断未来。"
  };
}

module.exports = { hasResultCard, normalizeResultCard };
