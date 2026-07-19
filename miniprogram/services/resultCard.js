const { safeList, safeText } = require("../utils/safeRender");

const archetypes = {
  seeker: { id: "seeker", nameZh: "寻路者", nameEn: "The Seeker", summary: "本次梦境更接近寻路者原型，也许与你正在寻找方向有关。" },
  explorer: { id: "explorer", nameZh: "探索者", nameEn: "The Explorer", summary: "本次梦境更接近探索者原型，也许与你靠近未知经验有关。" },
  guardian: { id: "guardian", nameZh: "守护者", nameEn: "The Guardian", summary: "本次梦境更接近守护者原型，也许与你在意边界和保护有关。" }
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

function hasResultCard(raw) {
  if (!raw || typeof raw !== "object") return false;
  const hasArchetype = Boolean(raw.archetype && typeof raw.archetype === "object" && raw.archetype.id);
  const hasInsight = typeof raw.coreInsight === "string" && raw.coreInsight.trim().length > 0;
  const hasDimension = Array.isArray(raw.dimensions)
    && raw.dimensions.some((dimension) => dimension && dimension.id && normalizeScore(dimension.score) !== null);
  return hasArchetype && hasInsight && hasDimension;
}

function normalizeResultCard(raw = {}) {
  const input = raw && typeof raw === "object" ? raw : {};
  const selected = archetypes[input.archetype && input.archetype.id] || archetypes.seeker;
  const dimensionMap = new Map(Array.isArray(input.dimensions) ? input.dimensions.map((item) => [item && item.id, item]) : []);
  const emotion = input.emotionalProfile && typeof input.emotionalProfile === "object" ? input.emotionalProfile : {};

  return {
    archetype: {
      ...selected,
      summary: safeText(input.archetype && input.archetype.summary, selected.summary),
      evidence: safeList(input.archetype && input.archetype.evidence, "")
    },
    coreInsight: safeText(input.coreInsight, "暂未生成一句话洞察。"),
    dimensions: dimensionDefinitions.map((definition) => {
      const value = dimensionMap.get(definition.id) || {};
      return {
        id: definition.id,
        name: definition.name,
        score: normalizeScore(value.score),
        summary: safeText(value.summary, "暂未生成"),
        rationale: safeList(value.rationale, "")
      };
    }),
    symbols: Array.isArray(input.symbols)
      ? input.symbols.slice(0, 3).map((symbol) => ({
          name: safeText(symbol && symbol.name, "未命名意象"),
          contextMeaning: safeText(symbol && symbol.contextMeaning, "暂未生成"),
          evidence: safeText(symbol && symbol.evidence, "暂未生成"),
          reflectionQuestion: safeText(symbol && symbol.reflectionQuestion, "这个意象让你想到什么？")
        }))
      : [],
    emotionalProfile: {
      primary: safeText(emotion.primary, "未记录"),
      secondary: safeList(emotion.secondary, ""),
      intensity: normalizeScore(emotion.intensity),
      evidence: safeText(emotion.evidence, "暂未生成")
    },
    reflectionQuestions: safeList(input.reflectionQuestions, ""),
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
}

module.exports = { hasResultCard, normalizeResultCard };
