(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamArchetypes = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const archetypes = [
    { id: "seeker", nameZh: "寻路者", nameEn: "The Seeker", summary: "也许与你正在寻找方向有关。", keywords: ["方向", "寻找"] },
    { id: "explorer", nameZh: "探索者", nameEn: "The Explorer", summary: "也许与你靠近未知经验有关。", keywords: ["未知", "探索"] },
    { id: "guardian", nameZh: "守护者", nameEn: "The Guardian", summary: "也许与你在意边界和保护有关。", keywords: ["保护", "边界"] },
    { id: "observer", nameZh: "观察者", nameEn: "The Observer", summary: "也许与你停下来理解自身感受有关。", keywords: ["观察", "理解"] },
    { id: "transformer", nameZh: "转变者", nameEn: "The Transformer", summary: "也许与你正在经历变化有关。", keywords: ["变化", "转变"] },
    { id: "creator", nameZh: "创造者", nameEn: "The Creator", summary: "也许与你表达和创造有关。", keywords: ["表达", "创造"] },
    { id: "healer", nameZh: "疗愈者", nameEn: "The Healer", summary: "也许与你照看感受和恢复有关。", keywords: ["照看", "恢复"] },
    { id: "homecomer", nameZh: "归途者", nameEn: "The Homecomer", summary: "也许与你寻找熟悉感和归属有关。", keywords: ["归属", "熟悉"] }
  ];

  function getArchetypeById(id) {
    return archetypes.find((item) => item.id === id) || null;
  }

  function getFallbackArchetype() {
    return archetypes[0];
  }

  function normalizeArchetype(value) {
    const input = value && typeof value === "object" ? value : {};
    const definition = getArchetypeById(input.id) || getFallbackArchetype();
    return {
      id: definition.id,
      nameZh: definition.nameZh,
      nameEn: definition.nameEn,
      summary: typeof input.summary === "string" && input.summary.trim() ? input.summary.trim() : definition.summary,
      keywords: definition.keywords.slice()
    };
  }

  return { archetypes, getArchetypeById, getFallbackArchetype, normalizeArchetype };
});
