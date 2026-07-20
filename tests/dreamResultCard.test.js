const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const DreamArchetypes = require("../src/dreamArchetypes");
const DreamResultCard = require("../src/dreamResultCard");

function createFakeElement(tagName = "div") {
  const listeners = new Map();
  const element = {
    tagName: tagName.toUpperCase(),
    children: [],
    className: "",
    dataset: {},
    textContent: "",
    type: "",
    disabled: false,
    style: {},
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    trigger(type) {
      const listener = listeners.get(type);
      if (listener) return listener({ target: this });
    }
  };

  Object.defineProperty(element, "innerHTML", {
    set() {
      throw new Error("Dream Result Card rendering must not assign innerHTML");
    }
  });

  return element;
}

function collectText(node) {
  return [node.textContent, ...node.children.flatMap((child) => collectText(child))]
    .filter(Boolean)
    .join(" ");
}

function findElements(node, predicate) {
  return [node, ...node.children.flatMap((child) => findElements(child, predicate))]
    .filter(predicate);
}

function createResultCardFixture() {
  return {
    archetype: {
      id: "creator",
      summary: "本次梦境更接近创造者原型，也许和表达有关。",
      evidence: ["门发光。", "你停在门前。"]
    },
    coreInsight: "这个梦也许在提醒你重新看见表达。",
    dimensions: [
      { id: "symbol_depth", score: 72, summary: "多个意象出现。", rationale: ["门出现。"] },
      { id: "emotion_intensity", score: 64, summary: "情绪清晰。", rationale: ["梦里感到迟疑。"] },
      { id: "self_awareness", score: 55, summary: "你注意到自己的停留。", rationale: ["记录了迟疑。"] },
      { id: "growth_signal", score: 72, summary: "也许出现新的方向。", rationale: ["发光的门。"] }
    ],
    symbols: [
      { name: "门", contextMeaning: "在这次梦里可能和选择有关。", evidence: "门发光。", reflectionQuestion: "门后是什么？" },
      { name: "走廊", contextMeaning: "可能和过渡有关。", evidence: "走进走廊。", reflectionQuestion: "你正走向哪里？" },
      { name: "光", contextMeaning: "可能带来一点看见。", evidence: "远处有光。", reflectionQuestion: "光照亮了什么？" },
      { name: "不应显示", contextMeaning: "不应显示。", evidence: "不应显示。", reflectionQuestion: "不应显示？" }
    ],
    emotionalProfile: { primary: "迟疑", secondary: ["好奇"], intensity: 64, evidence: "停在门前很久。" },
    reflectionQuestions: ["门后可能是什么？", "你想靠近什么？"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
}

test("normalizes stable archetypes with Chinese primary names", () => {
  assert.equal(DreamArchetypes.archetypes.length, 8);
  assert.deepEqual(
    DreamArchetypes.archetypes.map((item) => item.id),
    ["seeker", "explorer", "guardian", "observer", "transformer", "creator", "healer", "homecomer"]
  );
  assert.equal(DreamArchetypes.normalizeArchetype({ id: "seeker" }).nameZh, "寻路者");
  assert.equal(DreamArchetypes.normalizeArchetype({ id: "unknown" }).nameZh, "寻路者");
});

test("normalizes Dream Result Card fields safely", () => {
  const card = DreamResultCard.normalizeDreamResultCard({
    archetype: { id: "creator", summary: "本次梦境更接近创造者原型，也许和表达有关。" },
    coreInsight: "这个梦也许在提醒你重新看见表达。",
    dimensions: [
      { id: "symbol_depth", score: 200, summary: "多个意象出现。", rationale: ["门出现。"] },
      { id: "emotion_intensity", score: -4, summary: "情绪很轻。", rationale: ["语气平静。"] },
      { id: "self_awareness", score: 55, summary: "有停留观察。", rationale: ["记录了自己的迟疑。"] },
      { id: "growth_signal", score: 72, summary: "也许出现新的方向。", rationale: ["发光的门。"] },
      { id: "unsupported", score: 99, summary: "忽略。", rationale: ["忽略。"] }
    ],
    symbols: [
      { name: "门", contextMeaning: "在这次梦里可能和选择有关。", evidence: "门发光。", reflectionQuestion: "门后是什么？" },
      { name: "走廊" },
      { name: "光" },
      { name: "第四个应被忽略" }
    ],
    emotionalProfile: { primary: "迟疑", secondary: ["好奇", "紧张"], intensity: 101, evidence: "停在门前很久。" },
    reflectionQuestions: ["门后可能是什么？", "你想靠近什么？", "哪里让你迟疑？", "第四个忽略。"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  });

  assert.equal(card.archetype.nameZh, "创造者");
  assert.equal(card.dimensions.length, 4);
  assert.equal(card.dimensions[0].score, 100);
  assert.equal(card.dimensions[1].score, 0);
  assert.equal(card.symbols.length, 3);
  assert.equal(card.emotionalProfile.intensity, 100);
  assert.equal(card.reflectionQuestions.length, 3);
  assert.match(card.safetyReminder, /不是诊断、治疗或预言/);
});

test("does not render missing dimension scores as real zero values", () => {
  const card = DreamResultCard.normalizeDreamResultCard({
    archetype: { id: "observer", summary: "本次梦境更接近观察者原型，也许和停留观看有关。" },
    coreInsight: "这个梦也许在邀请你看见某个片段。",
    dimensions: [],
    symbols: [],
    emotionalProfile: { primary: "安静", intensity: 41, evidence: "梦里只是站着看。" },
    reflectionQuestions: ["你最想继续看见什么？"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  }, {}, { allowUnavailableScores: true });
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, {
    reportContent: { dreamResultCard: card, dreamResultCardStatus: "mock_legacy" }
  });

  assert.equal(card.dimensions[0].score, null);
  assert.match(collectText(container), /线索不足，暂不评分/);
  assert.doesNotMatch(collectText(container), /象征深度 0/);
  assert.equal(findElements(container, (element) => element.className === "result-card-progress").length, 0);
});

test("does not render missing dimension scores as zero for ai generated cards", () => {
  const card = {
    archetype: { id: "observer", summary: "本次梦境更接近观察者原型，也许和停留观看有关。" },
    coreInsight: "这个梦也许在邀请你看见某个片段。",
    dimensions: [
      { id: "symbol_depth", summary: "意象线索不足。", rationale: ["没有返回分数。"] }
    ],
    symbols: [],
    emotionalProfile: { primary: "安静", intensity: 41, evidence: "梦里只是站着看。" },
    reflectionQuestions: ["你最想继续看见什么？"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, {
    reportContent: { dreamResultCard: card, dreamResultCardStatus: "ai_generated" }
  });

  const text = collectText(container);
  assert.match(text, /这是一条较早生成的梦境画像。/);
  assert.match(text, /线索不足，暂不评分/);
  assert.match(text, /暂不评分/);
  assert.match(text, /观察依据/);
  assert.match(text, /这次记录中没有足够明确的情绪强度线索/);
  assert.equal(findElements(container, (element) => element.className === "result-card-progress").length, 0);
  assert.doesNotMatch(text, /象征深度 0/);
  assert.doesNotMatch(text, /暂不可用/);
});

test("does not render non-numeric dimension scores as zero for ai generated cards", () => {
  const card = {
    archetype: { id: "observer", summary: "本次梦境更接近观察者原型，也许和停留观看有关。" },
    coreInsight: "这个梦也许在邀请你看见某个片段。",
    dimensions: [
      { id: "symbol_depth", score: "   ", summary: "意象线索有限。", rationale: ["门出现。"] }
    ],
    symbols: [],
    emotionalProfile: { primary: "安静", intensity: false, evidence: "梦里只是站着看。" },
    reflectionQuestions: ["你最想继续看见什么？"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, {
    reportContent: { dreamResultCard: card, dreamResultCardStatus: "ai_generated" }
  });

  const text = collectText(container);
  assert.match(text, /线索不足，暂不评分/);
  assert.doesNotMatch(text, /象征深度 0/);
  assert.doesNotMatch(text, /情绪强度：0/);
  assert.doesNotMatch(text, /暂不可用/);
});

test("does not render missing emotional intensity as zero", () => {
  const card = {
    archetype: { id: "observer", summary: "本次梦境更接近观察者原型，也许和停留观看有关。" },
    coreInsight: "这个梦也许在邀请你看见某个片段。",
    dimensions: [
      { id: "symbol_depth", score: 44, summary: "意象线索有限。", rationale: ["门出现。"] }
    ],
    symbols: [],
    emotionalProfile: { primary: "安静", evidence: "梦里只是站着看。" },
    reflectionQuestions: ["你最想继续看见什么？"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, {
    reportContent: { dreamResultCard: card, dreamResultCardStatus: "ai_generated" }
  });

  const text = collectText(container);
  assert.match(text, /情绪强度：线索不足，暂不评分/);
  assert.doesNotMatch(text, /情绪强度：0/);
  assert.doesNotMatch(text, /暂不可用/);
});

test("renders true zero scores as valid scores", () => {
  const card = createResultCardFixture();
  card.dimensions[1] = {
    id: "emotion_intensity",
    score: 0,
    summary: "情绪线索非常轻。",
    rationale: ["梦里只是安静地站在门前。"]
  };
  card.emotionalProfile.intensity = 0;
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, {
    reportContent: { dreamResultCard: card, dreamResultCardStatus: "ai_generated" }
  });

  const text = collectText(container);
  assert.match(text, /情绪强度 0/);
  assert.match(text, /情绪强度：0/);
  assert.doesNotMatch(text, /线索不足，暂不评分/);
});

test("removes absolute or identity-defining model language before card rendering", () => {
  const unsafeCard = {
    archetype: { id: "creator", summary: "你会失去重要的人。" },
    coreInsight: "未来会出现机会。",
    dimensions: dimensionDefinitionsWithUnsafeText(),
    symbols: [{
      name: "门",
      generalPossibility: "你就是需要改变的人。",
      contextMeaning: "你需要治疗。",
      evidence: "建议看医生。",
      reflectionQuestion: "你需要药物帮助吗？"
    }],
    emotionalProfile: {
      primary: "迟疑",
      secondary: ["你就是焦虑的人", "你必定会遇到变化", "你应该服用药物"],
      intensity: 64,
      evidence: "这是命运给你的预言。"
    },
    reflectionQuestions: ["这说明：你一定会失败。", "你需要药物治疗。"],
    safetyReminder: "这说明你一定需要治疗。"
  };
  const normalized = DreamResultCard.normalizeDreamResultCard(unsafeCard);
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, { reportContent: { dreamResultCard: unsafeCard } });

  for (const unsafePhrase of [
    "这说明：你一定会失败",
    "你必定会遇到变化",
    "你是一个焦虑的人",
    "这代表你一定有焦虑症",
    "这是命运给你的预言",
    "你会失去重要的人",
    "这个梦预示着你会得到答案",
    "梦境预示你将会遇到机会",
    "未来会出现机会",
    "你患有精神分裂症",
    "你需要接受心理治疗",
    "你应该服用药物",
    "你需要药物治疗",
    "你需要治疗",
    "建议看医生",
    "你需要药物帮助"
  ]) {
    assert.doesNotMatch(JSON.stringify(normalized), new RegExp(unsafePhrase));
    assert.doesNotMatch(collectText(container), new RegExp(unsafePhrase));
  }
  assert.match(normalized.safetyReminder, /不是诊断、治疗或预言/);
});

function dimensionDefinitionsWithUnsafeText() {
  return ["symbol_depth", "emotion_intensity", "self_awareness", "growth_signal"].map((id) => ({
    id,
    score: 64,
    summary: "你是一个焦虑的人。",
    rationale: ["梦境预示你将会遇到机会。"]
  }));
}

test("extracts existing card data from camelCase and snake_case records", () => {
  const card = { archetype: { id: "seeker" }, coreInsight: "也许在找方向。" };
  assert.equal(DreamResultCard.getDreamResultCardFromRecord({ reportContent: { dreamResultCard: card } }), card);
  assert.equal(DreamResultCard.getDreamResultCardFromRecord({ report_content: { dreamResultCard: card } }), card);
  assert.equal(DreamResultCard.getDreamResultCardFromRecord({ reportContent: {} }), null);
  assert.equal(DreamResultCard.getDreamResultCardFromRecord({ reportContent: { dreamResultCard: "bad" } }), null);
  assert.equal(DreamResultCard.getDreamResultCardFromRecord({ reportContent: { dreamResultCard: 72 } }), null);
  assert.equal(DreamResultCard.getDreamResultCardFromRecord({ reportContent: { dreamResultCard: [] } }), null);
});

test("loads result card assets after the journal and before app", () => {
  const html = fs.readFileSync(path.join(__dirname, "../src/index.html"), "utf8");
  assert.ok(html.indexOf("dreamJournal.js") < html.indexOf("dreamArchetypes.js"));
  assert.ok(html.indexOf("dreamArchetypes.js") < html.indexOf("dreamResultCard.js"));
  assert.ok(html.indexOf("dreamResultCard.js") < html.indexOf("app.js"));
});

test("renders an existing dream result card with its required sections", () => {
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, {
    reportContent: { dreamResultCard: createResultCardFixture() }
  });

  const renderedText = collectText(container);
  for (const expected of [
    "梦境画像",
    "梦境原型",
    "本次梦境更接近：",
    "创造者",
    "The Creator",
    "一句话核心洞察",
    "象征深度",
    "情绪强度",
    "自我觉察",
    "成长信号",
    "为什么",
    "情绪画像",
    "自我思考",
    "分享卡片预览",
    "这不是诊断、治疗或预言，只是一种自我探索视角。"
  ]) {
    assert.match(renderedText, new RegExp(expected));
  }
  assert.doesNotMatch(renderedText, /这是一条较早生成的梦境画像。/);
  assert.equal(findElements(container, (element) => element.textContent === "为什么").length, 4);
  assert.equal(findElements(container, (element) => element.className === "result-card-symbol").length, 3);
});

test("marks historical cards with complete scores but missing core fields as partial", () => {
  const card = createResultCardFixture();
  delete card.coreInsight;
  card.symbols = [];
  card.reflectionQuestions = [];
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, {
    reportContent: {
      dreamResultCard: card,
      dreamResultCardStatus: "ai_generated"
    }
  });

  const renderedText = collectText(container);
  assert.match(renderedText, /这是一条较早生成的梦境画像。/);
  assert.match(renderedText, /一句话核心洞察/);
});

test("renders a generation fallback when a record has no dream result card", () => {
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, { reportContent: {} });

  assert.match(collectText(container), /尚未生成梦境画像/);
  assert.equal(
    findElements(container, (element) => element.tagName === "BUTTON" && element.textContent === "生成梦境画像").length,
    1
  );
});

test("renders generation failed state with retry copy", () => {
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, {
    reportContent: { dreamResultCardStatus: "generation_failed" }
  });

  const text = collectText(container);
  assert.match(text, /梦境画像暂时未能完整生成。/);
  assert.equal(
    findElements(container, (element) => element.tagName === "BUTTON" && element.textContent === "重新生成梦境画像").length,
    1
  );
});

test("keeps pending sync status visible after generating a card", async () => {
  const container = createFakeElement();
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement },
    requestResultCard: async () => createResultCardFixture(),
    saveResultCard: async () => ({ syncStatus: "pending_sync" })
  });

  controller.render(container, { reportContent: {} });
  const button = findElements(
    container,
    (element) => element.tagName === "BUTTON" && element.textContent === "生成梦境画像"
  )[0];

  await button.trigger("click");

  assert.match(collectText(container), /梦境画像已生成，正在等待云端同步。/);
});

test("keeps raw dream text and email out of the share preview", () => {
  const container = createFakeElement();
  const rawDreamText = "我在学校走廊里看见一扇发光的门";
  const email = "dreamer@example.com";
  const controller = DreamResultCard.createDreamResultCardController({
    document: { createElement: createFakeElement }
  });

  controller.render(container, {
    rawDreamText,
    metadata: { email },
    reportContent: { dreamResultCard: createResultCardFixture() }
  });

  const preview = findElements(container, (element) => element.className === "result-card-share-preview")[0];
  const previewText = collectText(preview);
  assert.doesNotMatch(previewText, new RegExp(rawDreamText));
  assert.doesNotMatch(previewText, new RegExp(email));
});

test("documents the Dream Result Card feature boundary", () => {
  const readme = fs.readFileSync(path.join(__dirname, "../README.md"), "utf8");
  const projectStatus = fs.readFileSync(path.join(__dirname, "../docs/PROJECT_STATUS.md"), "utf8");

  for (const document of [readme, projectStatus]) {
    assert.match(document, /梦境画像/);
    assert.match(document, /reportContent\.dreamResultCard/);
    assert.match(document, /不新增 schema|不新增.*schema|no new schema/i);
    assert.match(document, /不.*(?:下载|分享).*实现|(?:下载|分享).*未实现|no .*download.*share/i);
  }
});

test("keeps forbidden labels out of user-facing source copy", () => {
  const userFacingSourceFiles = [
    "src/index.html",
    "src/app.js",
    "src/auth.js",
    "src/dreamHome.js",
    "src/dreamJournal.js",
    "src/dreamQuotes.js",
    "src/dreamSync.js",
    "src/dreamResultCard.js"
  ];
  const forbiddenLabels = [/Personality Test/i, /Diagnosis/i, /你就是/u, /这说明你一定/u];

  for (const relativeFile of userFacingSourceFiles) {
    const source = fs.readFileSync(path.join(__dirname, "..", relativeFile), "utf8")
      .replace(/const unsafeLanguage = .+;/u, "const unsafeLanguage = /internal-safety-guard/;");
    for (const forbiddenLabel of forbiddenLabels) {
      assert.doesNotMatch(source, forbiddenLabel, `${relativeFile} contains ${forbiddenLabel}`);
    }
  }
});
