const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeQuickCombinedOutput } = require("../server");

const safetyReminder = "这不是诊断、治疗或预言，只是一种自我探索视角。";

const syntheticDreams = [
  { id: "chased", dream: "我梦见自己在夜里的街道被追赶，一直跑到一扇门前。", anchor: "追赶", other: "海洋" },
  { id: "animal-death", dream: "我梦见一只黑狗被困住，我很想救它，却只能站在旁边。", anchor: "黑狗", other: "考试" },
  { id: "school-exam", dream: "我梦见回到学校考试，试卷空白，教室里的钟一直响。", anchor: "考试", other: "恋人" },
  { id: "flying", dream: "我梦见自己从屋顶飞起来，穿过云层，又担心会掉下去。", anchor: "屋顶", other: "走廊" },
  { id: "lost", dream: "我梦见在陌生城市迷路，地图上的路不断改变。", anchor: "迷路", other: "黑狗" },
  { id: "relationship", dream: "我梦见和恋人隔着玻璃说话，声音很近，却怎么也听不清。", anchor: "恋人", other: "学校" },
  { id: "water", dream: "我梦见站在海边，潮水慢慢上涨，脚下的沙被水带走。", anchor: "海边", other: "试卷" },
  { id: "recurring", dream: "我又梦见同一条长走廊，每次都走到那扇门前醒来。", anchor: "走廊", other: "潮水" },
  { id: "short", dream: "梦见门。很亮。", anchor: "门", other: "黑狗" },
  { id: "confused-emotion", dream: "梦里很多画面混在一起：雨、车站、蓝色灯光，我醒来很慌。", anchor: "车站", other: "教室" }
];

const limitedShortCase = { id: "short-simple", dream: "梦见门。", anchor: "门", other: "黑狗" };

function createSyntheticAnalysis({ dream, anchor }) {
  return {
    dreamSummary: `这次梦里，“${anchor}”是最清楚的线索之一，梦境围绕它展开，并带出一种正在靠近又有些停顿的感受。整体画面不需要被解释成单一答案，而可以先被整理为一组值得观察的梦境片段。`,
    coreTheme: `这个梦更像是在围绕“${anchor}”带出的压力、边界和靠近感展开。`,
    coreInterpretation: `梦中实际出现的“${anchor}”是这次解析最重要的依据之一。它可能并不是固定象征，而是和梦里的行动、停顿或情绪一起形成线索。你可以把“${anchor}”看作一个入口：也许它提示你留意最近是否有某种想靠近、想保护、想离开或还没准备好的感受。这样的理解只是自我探索视角，不替你下结论。`,
    evidence: [
      {
        dreamFragment: anchor,
        interpretation: `“${anchor}”直接来自这次梦境，因此可以作为当前主题的主要证据。`
      },
      {
        dreamFragment: dream.slice(0, Math.min(dream.length, 18)),
        interpretation: `这个片段和“${anchor}”一起出现，支持把梦境理解为一组相互关联的情绪线索。`
      }
    ],
    emotionalReading: {
      primaryEmotion: "紧张",
      secondaryEmotions: ["迟疑", "好奇"],
      intensity: 66,
      evidence: `情绪主要来自梦中围绕“${anchor}”展开的片段，这不代表现实中的固定心理状态。`
    },
    symbolReading: [
      {
        symbol: anchor,
        context: `“${anchor}”在这次梦里是一个具体画面。`,
        possibleMeaning: `它可能与选择、边界、保护或变化有关，但需要放回这次梦的语境里看。`,
        evidence: `梦境原文中出现了“${anchor}”。`,
        reflectionQuestion: `当你想到梦里的“${anchor}”时，身体最先有什么感觉？`
      }
    ],
    reflectionQuestions: [
      `梦里的“${anchor}”最像在提醒你留意什么感受？`,
      `如果“${anchor}”可以继续变化，你希望它走向哪里？`,
      `最近有没有什么事情让你产生和“${anchor}”类似的停顿或靠近感？`
    ],
    gentleAction: `你可以用两分钟写下：梦中关于“${anchor}”的一个画面，以及醒来后残留的一个感受。`,
    safetyReminder
  };
}

function createLimitedSyntheticAnalysis({ anchor }) {
  return {
    dreamSummary: `这次梦里只留下“${anchor}”这个清楚线索，适合先做温和整理。`,
    coreTheme: `围绕“${anchor}”的暂定线索`,
    coreInterpretation: `当前梦境信息较少，主要能确认的是“${anchor}”这个片段。它可能只是一个值得继续观察的入口线索，不适合被扩展成更多故事。你可以先留意它带来的感受或联想。`,
    evidence: [
      {
        dreamFragment: anchor,
        interpretation: `“${anchor}”直接来自这次梦境，因此可以作为当前分析的主要依据。`
      }
    ],
    emotionalReading: {
      primaryEmotion: "情绪未明",
      secondaryEmotions: ["留意"],
      intensity: 20,
      evidence: `当前文本只描述“${anchor}”，没有呈现强烈情绪，因此情绪强度适合保持谨慎。`
    },
    symbolReading: [
      {
        symbol: anchor,
        context: `“${anchor}”是这次短梦中唯一清楚的画面。`,
        possibleMeaning: "它可能是一条值得继续观察的个人线索。",
        evidence: `梦境原文中出现了“${anchor}”。`,
        reflectionQuestion: `“${anchor}”让你想到什么具体感受？`
      }
    ],
    reflectionQuestions: [
      `“${anchor}”在梦里最让你注意到什么？`,
      `如果只保留“${anchor}”，它和最近哪种感受有一点相似？`,
      `醒来后再想起“${anchor}”，身体或情绪有什么轻微变化？`
    ],
    gentleAction: `你可以用一分钟补充“${anchor}”的颜色、位置或第一感觉。`,
    safetyReminder
  };
}

function createSyntheticCard({ anchor }) {
  return {
    archetype: {
      id: "observer",
      summary: `本次梦境更接近观察者原型，也许与你正在理解“${anchor}”带来的感受有关。`,
      evidence: [`梦中出现了“${anchor}”。`, `你记录了与“${anchor}”相关的感受。`]
    },
    coreInsight: `这个梦也许在邀请你温和地看见“${anchor}”背后的感受。`,
    dimensions: [
      { id: "symbol_depth", score: 72, summary: `“${anchor}”提供了象征线索。`, rationale: [`“${anchor}”是反复可观察的梦境画面。`] },
      { id: "emotion_intensity", score: 66, summary: "梦中情绪清晰但不需要被夸大。", rationale: [`情绪证据来自“${anchor}”附近的梦境片段。`] },
      { id: "self_awareness", score: 58, summary: "你已经记录了梦中感受。", rationale: [`你能回看“${anchor}”带来的感受。`] },
      { id: "growth_signal", score: 63, summary: "梦里有继续探索的入口。", rationale: [`“${anchor}”可以作为温和反思的起点。`] }
    ],
    symbols: [
      {
        name: anchor,
        generalPossibility: "这个意象有时会和边界、变化或注意力有关。",
        contextMeaning: `在这次梦里，“${anchor}”更适合作为个人语境中的线索。`,
        evidence: `梦中出现了“${anchor}”。`,
        reflectionQuestion: `“${anchor}”让你想到现实中的哪一种感受？`
      }
    ],
    emotionalProfile: {
      primary: "紧张",
      secondary: ["迟疑"],
      intensity: 66,
      evidence: `紧张来自梦中围绕“${anchor}”展开的片段。`
    },
    reflectionQuestions: [`你可以怎样温和地理解“${anchor}”？`],
    safetyReminder
  };
}

test("synthetic quick-analysis dataset passes V2 quality without cross-dream leakage", () => {
  syntheticDreams.forEach((caseItem) => {
    const result = normalizeQuickCombinedOutput({
      analysis: createSyntheticAnalysis(caseItem),
      dreamResultCard: createSyntheticCard(caseItem)
    }, caseItem.dream);

    assert.deepEqual(result.issues, [], caseItem.id);
    assert.equal(result.output.generationMeta.qualityStatus, "passed");
    assert.equal(result.output.analysis.evidence.length, 2);
    assert.equal(result.output.analysis.reflectionQuestions.length, 3);
    assert.match(JSON.stringify(result.output), new RegExp(caseItem.anchor));
    assert.doesNotMatch(JSON.stringify(result.output), new RegExp(caseItem.other));
  });
});

test("limited-evidence quick generation defaults missing confidence to low", () => {
  const result = normalizeQuickCombinedOutput({
    analysis: createLimitedSyntheticAnalysis(limitedShortCase),
    dreamResultCard: createSyntheticCard(limitedShortCase),
    generationMeta: {
      source: "ai_generated",
      promptVersion: "quick-analysis-v2",
      qualityStatus: "passed",
      limitedEvidence: true
    }
  }, limitedShortCase.dream);

  assert.equal(result.output.dreamResultCardStatus, "ai_generated");
  assert.equal(result.output.generationMeta.limitedEvidence, true);
  assert.equal(result.output.generationMeta.evidenceConfidence, "low");
});
