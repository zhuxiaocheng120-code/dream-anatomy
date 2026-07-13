const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const DreamJournal = require("../src/dreamJournal");
const DreamResultCard = require("../src/dreamResultCard");

function createRecord(overrides = {}) {
  return {
    id: overrides.id || "record-1",
    createdAt: overrides.createdAt || "2026-07-12T08:00:00.000Z",
    rawDreamText: overrides.rawDreamText || "我梦见学校、雨和一座桥",
    dreamSummary: overrides.dreamSummary || "学校雨中的桥",
    emotions: overrides.emotions || "紧张、好奇",
    symbols: overrides.symbols || "学校、雨、桥、门",
    sleepQuality: overrides.sleepQuality || "未记录",
    analysisType: overrides.analysisType || "快速解析",
    reportContent: overrides.reportContent || { summary: "学校雨中的桥" },
    ...overrides
  };
}

function createFakeElement(tagName = "div") {
  const listeners = new Map();
  const element = {
    tagName: tagName.toUpperCase(),
    children: [],
    className: "",
    dataset: {},
    hidden: false,
    textContent: "",
    type: "",
    value: "",
    style: {},
    attributes: {},
    classList: {
      values: new Set(),
      add(value) {
        this.values.add(value);
      },
      remove(value) {
        this.values.delete(value);
      },
      toggle(value, force) {
        const shouldAdd = force === undefined ? !this.values.has(value) : Boolean(force);
        if (shouldAdd) {
          this.values.add(value);
        } else {
          this.values.delete(value);
        }
      },
      contains(value) {
        return this.values.has(value);
      }
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    trigger(type, event = {}) {
      const listener = listeners.get(type);
      if (listener) {
        return listener({ target: this, preventDefault() {}, ...event });
      }
    }
  };

  Object.defineProperty(element, "innerHTML", {
    set() {
      throw new Error("Dream Journal rendering must not assign innerHTML");
    }
  });

  return element;
}

function createFakeDocument() {
  return {
    createElement: createFakeElement
  };
}

function createDreamJournalElements() {
  return {
    list: createFakeElement("div"),
    empty: createFakeElement("div"),
    loading: createFakeElement("p"),
    searchInput: createFakeElement("input"),
    filters: [
      createFakeElement("button"),
      createFakeElement("button"),
      createFakeElement("button"),
      createFakeElement("button")
    ],
    newDreamButton: createFakeElement("button")
  };
}

function collectText(node) {
  return [
    node.textContent,
    ...node.children.flatMap((child) => collectText(child))
  ].filter(Boolean);
}

function findElements(node, predicate) {
  return [node, ...node.children.flatMap((child) => findElements(child, predicate))]
    .filter(predicate);
}

function createResultCardFixture() {
  return {
    archetype: {
      id: "creator",
      summary: "本次梦境更接近创造者原型，也许和表达有关。"
    },
    coreInsight: "这个梦也许在提醒你重新看见表达。",
    dimensions: [
      { id: "symbol_depth", score: 72, summary: "多个意象出现。", rationale: ["门出现。"] },
      { id: "emotion_intensity", score: 64, summary: "情绪清晰。", rationale: ["梦里感到迟疑。"] },
      { id: "self_awareness", score: 55, summary: "你注意到自己的停留。", rationale: ["记录了迟疑。"] },
      { id: "growth_signal", score: 72, summary: "也许出现新的方向。", rationale: ["发光的门。"] }
    ],
    symbols: [
      { name: "门", contextMeaning: "在这次梦里可能和选择有关。", evidence: "门发光。", reflectionQuestion: "门后是什么？" }
    ],
    emotionalProfile: { primary: "迟疑", secondary: ["好奇"], intensity: 64, evidence: "停在门前很久。" },
    reflectionQuestions: ["门后可能是什么？"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
}

function createQuickAnalysisFixture() {
  return {
    summary: "你在学校走廊里寻找教室，并停在一扇发光的门前。",
    coreInterpretation: "寻找教室的片段也许与近期的时间压力或被评价感有关。",
    emotions: [{ name: "紧张", evidence: "一直找不到教室。" }],
    symbols: [{ name: "门", contextMeaning: "在这次梦里可能和选择有关。" }],
    reflectionQuestions: ["最近有什么事情让你感觉一直在追赶？"],
    gentleReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
}

function createDeepAnalysisFixture() {
  return {
    summary: "你梦见自己在学校走廊寻找教室。",
    emotionClues: "你写下的紧张感与找不到教室的片段互相呼应。",
    coreImages: "教室、走廊和门是这次梦里较清晰的意象。",
    jungianView: "这也许是在靠近一个还没完全准备好的内在主题。",
    lifeConnection: "你提到最近有考试压力，这个回答可能与梦中的寻找互相呼应。",
    reflectionQuestions: "你可以思考：那扇门让你想靠近，还是想停下来？",
    smallAction: "今天可以写下一件想准备的小事。",
    gentleReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
}

function createAppIntegrationHarness(options = {}) {
  const selectors = new Map();
  const viewPanels = [
    Object.assign(createFakeElement("section"), { dataset: { view: "home" } }),
    Object.assign(createFakeElement("section"), { dataset: { view: "quick" } }),
    Object.assign(createFakeElement("section"), { dataset: { view: "guided" } }),
    Object.assign(createFakeElement("section"), { dataset: { view: "diary" } })
  ];
  const quickFormStatus = createFakeElement("p");
  const quickSubmitButton = Object.assign(createFakeElement("button"), { type: "submit" });
  const quickForm = Object.assign(createFakeElement("form"), {
    querySelector(selector) {
      if (selector === ".status") return quickFormStatus;
      if (selector === "button[type='submit']") return quickSubmitButton;
      return null;
    }
  });
  const quickDream = Object.assign(createFakeElement("textarea"), { value: "" });
  const quickResult = Object.assign(createFakeElement("section"), { hidden: true });
  const quickResultCard = createFakeElement("div");
  const resultFields = ["summary", "emotion", "symbols", "jungian", "question", "reminder"].map((field) =>
    Object.assign(createFakeElement("p"), { dataset: { resultField: field } })
  );
  const guidedForm = createFakeElement("form");
  const guidedDream = Object.assign(createFakeElement("textarea"), { value: "" });
  const guidedQuestions = Object.assign(createFakeElement("section"), { hidden: true });
  const guidedStatus = createFakeElement("p");
  const guidedActions = Object.assign(createFakeElement("div"), { hidden: true });
  const generateDeepReportButton = createFakeElement("button");
  const deepReport = Object.assign(createFakeElement("section"), { hidden: true });
  const guidedResultCard = createFakeElement("div");
  const saveDeepReportButton = createFakeElement("button");
  const deepSaveStatus = createFakeElement("p");
  const deepReportFields = [
    "summary",
    "emotionClues",
    "coreImages",
    "jungianView",
    "lifeConnection",
    "reflectionQuestions",
    "smallAction",
    "gentleReminder"
  ].map((field) => Object.assign(createFakeElement("p"), { dataset: { deepReportField: field } }));
  quickResult.append(...resultFields, quickResultCard);
  deepReport.append(...deepReportFields, guidedResultCard);
  const journalListShell = createFakeElement("div");
  const dreamDetail = createFakeElement("section");
  const dreamDetailContent = createFakeElement("div");
  const journalList = createFakeElement("div");
  const journalEmpty = createFakeElement("div");
  const journalStatus = createFakeElement("p");
  const journalSearch = createFakeElement("input");
  const journalNewDream = createFakeElement("button");
  const journalLoading = createFakeElement("p");
  const journalFilters = [
    Object.assign(createFakeElement("button"), { dataset: { journalFilter: "全部" } })
  ];
  const dreamJournalCalls = [];
  const windowRef = {
    addEventListener() {},
    confirm: () => false,
    scrollTo() {}
  };

  if (options.realDreamResultCard) {
    windowRef.DreamResultCard = DreamResultCard;
  }

  if (options.fakeDreamJournal !== false && !options.realDreamJournal && !options.noDreamJournal) {
    windowRef.DreamJournal = {
      createDreamJournalController(options) {
        dreamJournalCalls.push(["create", options.elements]);
        return {
          setRecords(records) {
            dreamJournalCalls.push(["setRecords", records.map((record) => record.id)]);
          }
        };
      }
    };
  }
  const documentRef = {
    createElement: createFakeElement,
    querySelector(selector) {
      return selectors.get(selector) || null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-view]") {
        return viewPanels;
      }

      if (selector === "[data-result-field]") {
        return resultFields;
      }

      if (selector === "[data-deep-report-field]") {
        return deepReportFields;
      }

      if (selector === "[data-journal-filter]") {
        return journalFilters;
      }

      return [];
    }
  };
  const storageItems = new Map();
  const localStorage = {
    getItem(key) {
      return storageItems.has(key) ? storageItems.get(key) : null;
    },
    removeItem(key) {
      storageItems.delete(key);
    },
    setItem(key, value) {
      storageItems.set(key, String(value));
    }
  };

  if (options.records) {
    localStorage.setItem("dreamAnatomy.quickDecodeRecords", JSON.stringify(options.records));
  }

  selectors.set("[data-journal-list-shell]", journalListShell);
  selectors.set("[data-quick-form]", quickForm);
  selectors.set("#quickDream", quickDream);
  selectors.set("#quickResult", quickResult);
  selectors.set("[data-quick-result-card]", quickResultCard);
  selectors.set("[data-guided-form]", guidedForm);
  selectors.set("#guidedDream", guidedDream);
  selectors.set("[data-guided-questions]", guidedQuestions);
  selectors.set("[data-guided-status]", guidedStatus);
  selectors.set("[data-guided-actions]", guidedActions);
  selectors.set("[data-generate-deep-report]", generateDeepReportButton);
  selectors.set("[data-deep-report]", deepReport);
  selectors.set("[data-guided-result-card]", guidedResultCard);
  selectors.set("[data-save-deep-report]", saveDeepReportButton);
  selectors.set("[data-deep-save-status]", deepSaveStatus);
  selectors.set("#dreamJournalList", journalList);
  selectors.set("#dreamJournalEmpty", journalEmpty);
  selectors.set("[data-dream-detail]", dreamDetail);
  selectors.set("[data-dream-detail-content]", dreamDetailContent);
  selectors.set("[data-journal-sync-status]", journalStatus);
  selectors.set("[data-journal-search]", journalSearch);
  selectors.set("[data-journal-new-dream]", journalNewDream);
  selectors.set("[data-journal-loading]", journalLoading);

  windowRef.document = documentRef;
  windowRef.localStorage = localStorage;

  const context = {
    document: documentRef,
    fetch: options.fetch || (async () => {
      throw new Error("Unexpected fetch request");
    }),
    localStorage,
    window: windowRef,
    Intl
  };

  if (options.realDreamJournal) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/dreamJournal.js"), "utf8"), context);
  }

  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8"), context);

  return {
    deepReport,
    deepReportFields,
    deepSaveStatus,
    dreamDetail,
    dreamDetailContent,
    dreamJournalCalls,
    generateDeepReportButton,
    guidedActions,
    guidedDream,
    guidedForm,
    guidedQuestions,
    guidedResultCard,
    guidedStatus,
    journalEmpty,
    journalList,
    journalListShell,
    journalNewDream,
    quickDream,
    quickForm,
    quickFormStatus,
    quickResult,
    quickResultCard,
    resultFields,
    saveDeepReportButton,
    viewPanels,
    windowRef,
    getSavedRecords() {
      const savedRecords = localStorage.getItem("dreamAnatomy.quickDecodeRecords");
      return savedRecords ? JSON.parse(savedRecords) : [];
    }
  };
}

test("generates display titles from title, summary, raw text, then fallback", () => {
  assert.equal(DreamJournal.getDisplayTitle(createRecord({ title: "  月光里的门  " })), "月光里的门");
  assert.equal(DreamJournal.getDisplayTitle(createRecord({ dreamSummary: "  森林   与 门  " })), "森林 与 门");
  assert.equal(
    DreamJournal.getDisplayTitle(createRecord({ dreamSummary: "", rawDreamText: "  我在海边  看到灯塔  " })),
    "我在海边 看到灯塔"
  );
  assert.equal(DreamJournal.getDisplayTitle(createRecord({ dreamSummary: "", rawDreamText: "" })), "未命名的梦");
});

test("truncates display titles after whitespace normalization", () => {
  assert.equal(
    DreamJournal.getDisplayTitle(createRecord({ dreamSummary: "一 二 三 四 五 六 七 八" }), 7),
    "一 二 三 四..."
  );
});

test("maps analysis type to Quick and Deep labels", () => {
  assert.equal(DreamJournal.getAnalysisKind(createRecord({ analysisType: "快速解析" })), "Quick");
  assert.equal(DreamJournal.getAnalysisKind(createRecord({ analysisType: "深度引导" })), "Deep");
  assert.equal(DreamJournal.getAnalysisKind(createRecord({ analysis_type: "快速解析" })), "Quick");
  assert.equal(DreamJournal.getAnalysisKind(createRecord({ analysis_type: "深度引导" })), "Deep");
  assert.equal(DreamJournal.getAnalysisKind(createRecord({ analysisType: "其他" })), "Dream");
});

test("extracts at most three symbols from string or array values", () => {
  assert.deepEqual(
    DreamJournal.getSymbolList(createRecord({ symbols: "学校、雨，桥,门" })),
    ["学校", "雨", "桥"]
  );
  assert.deepEqual(
    DreamJournal.getSymbolList(createRecord({ symbols: ["森林", "门", "河", "桥"] })),
    ["森林", "门", "河"]
  );
  assert.deepEqual(DreamJournal.getSymbolList(createRecord({ symbols: "" })), []);
});

test("groups records by local date buckets in descending order", () => {
  const now = new Date(2026, 6, 12, 10);
  const grouped = DreamJournal.groupRecordsByDate([
    createRecord({ id: "older", createdAt: "2026-05-30T08:00:00" }),
    createRecord({ id: "today", createdAt: "2026-07-12T08:00:00" }),
    createRecord({ id: "this-week", createdAt: "2026-07-09T08:00:00" }),
    createRecord({ id: "month", createdAt: "2026-07-01T08:00:00" }),
    createRecord({ id: "yesterday", createdAt: "2026-07-11T08:00:00" })
  ], now);

  assert.deepEqual(grouped.map((group) => group.label), [
    "今天",
    "昨天",
    "本周更早",
    "本月更早",
    "更早记录"
  ]);
  assert.deepEqual(grouped.flatMap((group) => group.records.map((record) => record.id)), [
    "today",
    "yesterday",
    "this-week",
    "month",
    "older"
  ]);
});

test("builds searchable text from title, raw text, summary, emotions, and symbols", () => {
  const text = DreamJournal.getSearchText(createRecord({
    title: "门后的海",
    rawDreamText: "我走进一条蓝色走廊",
    dreamSummary: "梦境整理",
    emotions: "平静",
    symbols: ["海", "走廊"]
  }));

  assert.match(text, /门后的海/);
  assert.match(text, /蓝色走廊/);
  assert.match(text, /梦境整理/);
  assert.match(text, /平静/);
  assert.match(text, /走廊/);
});

test("filters records by live search query and selected type", () => {
  const records = [
    createRecord({ id: "quick-school", analysisType: "快速解析", rawDreamText: "学校考试", syncStatus: "synced" }),
    createRecord({ id: "deep-sea", analysisType: "深度引导", rawDreamText: "海边灯塔", syncStatus: "synced" }),
    createRecord({ id: "pending-rain", analysisType: "快速解析", rawDreamText: "雨夜", syncStatus: "pending_sync" })
  ];

  assert.deepEqual(
    DreamJournal.filterRecords(records, { query: "灯塔", filter: "全部" }).map((record) => record.id),
    ["deep-sea"]
  );
  assert.deepEqual(
    DreamJournal.filterRecords(records, { query: "", filter: "快速解析" }).map((record) => record.id),
    ["quick-school", "pending-rain"]
  );
  assert.deepEqual(
    DreamJournal.filterRecords(records, { query: "", filter: "深度解析" }).map((record) => record.id),
    ["deep-sea"]
  );
  assert.deepEqual(
    DreamJournal.filterRecords(records, { query: "", filter: "待同步" }).map((record) => record.id),
    ["pending-rain"]
  );
});

test("renders loading and empty states with required gentle copy", () => {
  const elements = createDreamJournalElements();
  const controller = DreamJournal.createDreamJournalController({
    document: createFakeDocument(),
    elements,
    now: () => new Date(2026, 6, 12, 10)
  });

  controller.setLoading(true);
  assert.equal(elements.loading.textContent, "正在整理你的梦境档案……");

  controller.setLoading(false);
  controller.setRecords([]);

  const emptyText = collectText(elements.empty).join("\n");
  assert.equal(elements.empty.hidden, false);
  assert.match(emptyText, /🌙/);
  assert.match(emptyText, /你还没有记录任何梦。/);
  assert.match(emptyText, /今天开始，/);
  assert.match(emptyText, /把梦轻轻放进梦境档案。/);
  assert.match(emptyText, /记录第一个梦/);
});

test("renders grouped Dream Journal cards without assigning innerHTML", () => {
  const elements = createDreamJournalElements();
  const controller = DreamJournal.createDreamJournalController({
    document: createFakeDocument(),
    elements,
    now: () => new Date(2026, 6, 12, 10)
  });

  controller.setRecords([
    createRecord({
      id: "today",
      createdAt: "2026-07-12T08:00:00",
      dreamSummary: "<script>alert('dream')</script>",
      analysisType: "快速解析",
      syncStatus: "pending_sync"
    }),
    createRecord({
      id: "older",
      createdAt: "2026-06-01T08:00:00",
      dreamSummary: "旧梦",
      analysisType: "深度引导",
      symbols: ["森林", "门", "河", "桥"]
    })
  ]);

  const text = collectText(elements.list).join("\n");

  assert.equal(elements.empty.hidden, true);
  assert.match(text, /今天/);
  assert.match(text, /更早记录/);
  assert.match(text, /<script>alert\('dream'\)<\/script>/);
  assert.match(text, /快速解析/);
  assert.match(text, /深度解析/);
  assert.match(text, /待同步/);
  assert.match(text, /情绪：/);
  assert.match(text, /意象：/);
  assert.match(text, /森林/);
  assert.match(text, /门/);
  assert.match(text, /河/);
  assert.doesNotMatch(text, /Symbols: 森林、门、河、桥/);
  assert.doesNotMatch(text, /Today|Older|Quick|Deep|Pending Sync|Emotion:|Symbols:/);
});

test("updates rendered records for live search and selected filters", () => {
  const elements = createDreamJournalElements();
  elements.filters[0].dataset.journalFilter = "全部";
  elements.filters[1].dataset.journalFilter = "快速解析";
  elements.filters[2].dataset.journalFilter = "深度解析";
  elements.filters[3].dataset.journalFilter = "待同步";
  const controller = DreamJournal.createDreamJournalController({
    document: createFakeDocument(),
    elements,
    now: () => new Date(2026, 6, 12, 10)
  });

  controller.setRecords([
    createRecord({ id: "quick-school", rawDreamText: "学校考试", analysisType: "快速解析" }),
    createRecord({ id: "deep-sea", rawDreamText: "海边灯塔", analysisType: "深度引导" }),
    createRecord({ id: "pending-rain", rawDreamText: "雨夜", analysisType: "快速解析", syncStatus: "pending_sync" })
  ]);

  elements.searchInput.value = "灯塔";
  elements.searchInput.trigger("input");
  assert.match(collectText(elements.list).join("\n"), /海边灯塔/);
  assert.doesNotMatch(collectText(elements.list).join("\n"), /学校考试/);

  elements.searchInput.value = "";
  elements.searchInput.trigger("input");
  elements.filters[2].trigger("click");
  assert.match(collectText(elements.list).join("\n"), /海边灯塔/);
  assert.doesNotMatch(collectText(elements.list).join("\n"), /学校考试/);

  elements.filters[3].trigger("click");
  assert.match(collectText(elements.list).join("\n"), /雨夜/);
  assert.doesNotMatch(collectText(elements.list).join("\n"), /海边灯塔/);
});

test("opens existing detail flow and New Dream quick entry", () => {
  const elements = createDreamJournalElements();
  const calls = [];
  const controller = DreamJournal.createDreamJournalController({
    app: {
      openDreamDetail(recordId, record) {
        calls.push(["openDreamDetail", recordId, record.id]);
      },
      showView(viewName) {
        calls.push(["showView", viewName]);
      }
    },
    document: createFakeDocument(),
    elements,
    now: () => new Date(2026, 6, 12, 10)
  });

  controller.setRecords([createRecord({ id: "detail-record", localRecordId: "local-detail" })]);
  const card = elements.list.children[0].children[1].children[0];
  assert.equal(card.tagName, "ARTICLE");
  const cardButton = card.children[0];
  cardButton.trigger("click");
  elements.newDreamButton.trigger("click");

  assert.deepEqual(calls, [
    ["openDreamDetail", "local-detail", "detail-record"],
    ["showView", "quick"]
  ]);
});

test("empty-state action opens quick entry and clear resets visible controls", () => {
  const elements = createDreamJournalElements();
  elements.filters[0].dataset.journalFilter = "全部";
  elements.filters[1].dataset.journalFilter = "快速解析";
  const calls = [];
  const controller = DreamJournal.createDreamJournalController({
    app: {
      showView(viewName) {
        calls.push(["showView", viewName]);
      }
    },
    document: createFakeDocument(),
    elements,
    now: () => new Date(2026, 6, 12, 10)
  });

  elements.searchInput.value = "海";
  elements.searchInput.trigger("input");
  elements.filters[1].trigger("click");
  assert.equal(elements.filters[1].classList.contains("is-current"), true);

  controller.clear();
  const emptyAction = elements.empty.children[0].children[4];
  emptyAction.trigger("click");

  assert.equal(elements.searchInput.value, "");
  assert.equal(elements.filters[0].classList.contains("is-current"), true);
  assert.equal(elements.filters[1].classList.contains("is-current"), false);
  assert.deepEqual(calls, [["showView", "quick"]]);
});

test("app.js creates and feeds the Dream Journal controller when available", () => {
  const harness = createAppIntegrationHarness();

  assert.equal(harness.dreamJournalCalls[0][0], "create");
  harness.windowRef.DreamAnatomyApp.renderDreamJournal([
    createRecord({ id: "record-one" }),
    createRecord({ id: "record-two" })
  ]);

  assert.deepEqual(harness.dreamJournalCalls.at(-1), ["setRecords", ["record-one", "record-two"]]);
});

test("browser integration executes real dreamJournal.js before app.js", () => {
  const harness = createAppIntegrationHarness({ realDreamJournal: true, fakeDreamJournal: false });

  harness.windowRef.DreamAnatomyApp.renderDreamJournal([
    createRecord({ id: "record-one", dreamSummary: "真实脚本里的梦" })
  ]);

  assert.match(collectText(harness.journalList).join("\n"), /真实脚本里的梦/);
});

test("app.js fallback keeps New Dream and empty state usable without DreamJournal", () => {
  const harness = createAppIntegrationHarness({ noDreamJournal: true, fakeDreamJournal: false });

  harness.windowRef.DreamAnatomyApp.renderDreamJournal([]);
  assert.match(collectText(harness.journalEmpty).join("\n"), /你还没有记录任何梦。/);
  assert.match(collectText(harness.journalEmpty).join("\n"), /记录第一个梦/);

  harness.journalNewDream.trigger("click");
  assert.equal(harness.viewPanels[0].hidden, true);
  assert.equal(harness.viewPanels[1].hidden, false);
  assert.equal(harness.viewPanels[2].hidden, true);
  assert.equal(harness.viewPanels[3].hidden, true);
});

test("quick decode renders Dream Result Card on the current result page and saves it", async () => {
  const fetchCalls = [];
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async (url, options) => {
      fetchCalls.push([url, options]);
      return {
        ok: true,
        json: async () => ({
          analysis: createQuickAnalysisFixture(),
          dreamResultCard: createResultCardFixture(),
          dreamResultCardStatus: "ai_generated"
        })
      };
    }
  });

  harness.quickDream.value = "我在学校走廊里一直找不到教室，门发着光。";
  await harness.quickForm.trigger("submit");

  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), {
    dreamText: harness.quickDream.value,
    analysisType: "quick"
  });
  assert.equal(harness.quickResult.hidden, false);
  assert.match(collectText(harness.quickResult).join("\n"), /寻找教室/);
  assert.match(collectText(harness.quickResultCard).join("\n"), /梦境画像/);
  assert.match(collectText(harness.quickResultCard).join("\n"), /创造者/);

  const savedRecords = harness.getSavedRecords();
  assert.equal(savedRecords.length, 1);
  assert.equal(savedRecords[0].analysisType, "快速解析");
  assert.equal(savedRecords[0].reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);
  assert.equal(savedRecords[0].reportContent.dreamResultCardStatus, "ai_generated");
});

test("quick decode keeps analysis readable when result card generation failed", async () => {
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async () => ({
      ok: true,
      json: async () => ({
        analysis: createQuickAnalysisFixture(),
        dreamResultCardStatus: "generation_failed"
      })
    })
  });

  harness.quickDream.value = "我在学校走廊里一直找不到教室。";
  await harness.quickForm.trigger("submit");

  assert.equal(harness.quickResult.hidden, false);
  assert.match(collectText(harness.quickResult).join("\n"), /寻找教室/);
  assert.match(collectText(harness.quickResultCard).join("\n"), /梦境画像暂时未能完整生成。/);
});

test("quick current-page result card retry does not save a malformed synthetic record", async () => {
  const fetchCalls = [];
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async (url, options) => {
      fetchCalls.push([url, options]);
      const body = JSON.parse(options.body);
      if (body.analysisType === "quick") {
        return {
          ok: true,
          json: async () => ({
            analysis: createQuickAnalysisFixture(),
            dreamResultCardStatus: "generation_failed"
          })
        };
      }
      return {
        ok: true,
        json: async () => ({ analysis: createResultCardFixture() })
      };
    }
  });

  harness.quickDream.value = "我在学校走廊里一直找不到教室。";
  await harness.quickForm.trigger("submit");
  const retryButton = findElements(
    harness.quickResultCard,
    (element) => element.tagName === "BUTTON" && element.textContent === "重新生成梦境画像"
  )[0];

  await retryButton.trigger("click");

  const savedRecords = harness.getSavedRecords();
  assert.equal(savedRecords.length, 1);
  assert.ok(savedRecords[0].id);
  assert.ok(savedRecords[0].createdAt);
  assert.equal(savedRecords[0].analysisType, "快速解析");
  assert.equal(savedRecords[0].reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);
});

test("guided questions come from the current dream through the backend", async () => {
  const fetchCalls = [];
  const harness = createAppIntegrationHarness({
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async (url, options) => {
      fetchCalls.push([url, options]);
      return {
        ok: true,
        json: async () => ({
          questions: [
            { id: "emotion", label: "情绪", question: "在寻找教室时，最明显的感受是什么？", placeholder: "可以写紧张或着急。" },
            { id: "association", label: "联想", question: "这间教室让你想到现实中的什么场景？", placeholder: "可以写一个最近想到的场景。" },
            { id: "lifeLink", label: "现实连接", question: "最近有没有让你觉得需要赶上的事情？", placeholder: "只写愿意记录的部分。" }
          ]
        })
      };
    }
  });

  harness.guidedDream.value = "我一直找不到教室。";
  await harness.guidedForm.trigger("submit");

  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), {
    dreamText: harness.guidedDream.value,
    analysisType: "guided_questions"
  });
  assert.match(collectText(harness.guidedQuestions).join("\n"), /寻找教室/);
  assert.equal(harness.guidedQuestions.hidden, false);
});

test("guided final sends all answers once and renders Dream Result Card", async () => {
  const fetchCalls = [];
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async (url, options) => {
      fetchCalls.push([url, options]);
      const body = JSON.parse(options.body);
      if (body.analysisType === "guided_questions") {
        return {
          ok: true,
          json: async () => ({
            questions: [
              { id: "emotion", label: "情绪", question: "在寻找教室时，最明显的感受是什么？", placeholder: "可以写紧张或着急。" },
              { id: "lifeLink", label: "现实连接", question: "最近有没有让你觉得需要赶上的事情？", placeholder: "只写愿意记录的部分。" },
              { id: "waking", label: "醒后感受", question: "醒来后这个梦留下什么感觉？", placeholder: "可以写一个词。" }
            ]
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          analysis: createDeepAnalysisFixture(),
          dreamResultCard: createResultCardFixture(),
          dreamResultCardStatus: "ai_generated"
        })
      };
    }
  });

  harness.guidedDream.value = "我一直找不到教室。";
  await harness.guidedForm.trigger("submit");
  const answers = findElements(harness.guidedQuestions, (element) => element.tagName === "TEXTAREA");
  answers[0].value = "紧张";
  answers[0].trigger("input");
  answers[1].value = "最近有考试压力";
  answers[1].trigger("input");

  await harness.generateDeepReportButton.trigger("click");

  const finalCalls = fetchCalls.filter(([, options]) => JSON.parse(options.body).analysisType === "guided_final");
  assert.equal(finalCalls.length, 1);
  assert.deepEqual(JSON.parse(finalCalls[0][1].body), {
    dreamText: harness.guidedDream.value,
    analysisType: "guided_final",
    guidedAnswers: {
      emotion: "紧张",
      lifeLink: "最近有考试压力"
    }
  });
  assert.equal(harness.deepReport.hidden, false);
  assert.match(collectText(harness.deepReport).join("\n"), /考试压力/);
  assert.match(collectText(harness.guidedResultCard).join("\n"), /梦境画像/);
});

test("guided final failure does not fall back to a mock report", async () => {
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      if (body.analysisType === "guided_questions") {
        return {
          ok: true,
          json: async () => ({
            questions: [
              { id: "emotion", label: "情绪", question: "在寻找教室时，最明显的感受是什么？", placeholder: "可以写紧张或着急。" },
              { id: "lifeLink", label: "现实连接", question: "最近有没有让你觉得需要赶上的事情？", placeholder: "只写愿意记录的部分。" },
              { id: "waking", label: "醒后感受", question: "醒来后这个梦留下什么感觉？", placeholder: "可以写一个词。" }
            ]
          })
        };
      }

      return {
        ok: false,
        status: 502,
        json: async () => ({ error: "Dream analysis service is temporarily unavailable." })
      };
    }
  });

  harness.guidedDream.value = "我一直找不到教室。";
  await harness.guidedForm.trigger("submit");
  await harness.generateDeepReportButton.trigger("click");

  assert.equal(harness.deepReport.hidden, true);
  assert.doesNotMatch(collectText(harness.deepReport).join("\n"), /本地示例|本地 mock|今天可以写下一件想准备的小事/);
  assert.match(harness.guidedStatus.textContent, /暂时无法生成深度报告/);
  assert.match(collectText(harness.guidedResultCard).join("\n"), /梦境画像暂时未能完整生成/);

  await harness.saveDeepReportButton.trigger("click");
  assert.equal(harness.getSavedRecords().length, 0);
});

test("saving guided report stores Dream Result Card in reportContent", async () => {
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      if (body.analysisType === "guided_questions") {
        return {
          ok: true,
          json: async () => ({
            questions: [
              { id: "emotion", label: "情绪", question: "在寻找教室时，最明显的感受是什么？", placeholder: "可以写紧张或着急。" },
              { id: "lifeLink", label: "现实连接", question: "最近有没有让你觉得需要赶上的事情？", placeholder: "只写愿意记录的部分。" },
              { id: "waking", label: "醒后感受", question: "醒来后这个梦留下什么感觉？", placeholder: "可以写一个词。" }
            ]
          })
        };
      }
      return {
        ok: true,
        json: async () => ({
          analysis: createDeepAnalysisFixture(),
          dreamResultCard: createResultCardFixture(),
          dreamResultCardStatus: "ai_generated"
        })
      };
    }
  });

  harness.guidedDream.value = "我一直找不到教室。";
  await harness.guidedForm.trigger("submit");
  await harness.generateDeepReportButton.trigger("click");
  await harness.saveDeepReportButton.trigger("click");

  const savedRecords = harness.getSavedRecords();
  assert.equal(savedRecords.length, 1);
  assert.equal(savedRecords[0].analysisType, "深度引导");
  assert.equal(savedRecords[0].reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);
  assert.equal(savedRecords[0].reportContent.dreamResultCardStatus, "ai_generated");
});

test("guided current-page result card retry before save does not create a malformed synthetic record", async () => {
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      if (body.analysisType === "guided_questions") {
        return {
          ok: true,
          json: async () => ({
            questions: [
              { id: "emotion", label: "情绪", question: "在寻找教室时，最明显的感受是什么？", placeholder: "可以写紧张或着急。" },
              { id: "lifeLink", label: "现实连接", question: "最近有没有让你觉得需要赶上的事情？", placeholder: "只写愿意记录的部分。" },
              { id: "waking", label: "醒后感受", question: "醒来后这个梦留下什么感觉？", placeholder: "可以写一个词。" }
            ]
          })
        };
      }

      if (body.analysisType === "guided_final") {
        return {
          ok: true,
          json: async () => ({
            analysis: createDeepAnalysisFixture(),
            dreamResultCardStatus: "generation_failed"
          })
        };
      }

      return {
        ok: true,
        json: async () => ({ analysis: createResultCardFixture() })
      };
    }
  });

  harness.guidedDream.value = "我一直找不到教室。";
  await harness.guidedForm.trigger("submit");
  await harness.generateDeepReportButton.trigger("click");
  const retryButton = findElements(
    harness.guidedResultCard,
    (element) => element.tagName === "BUTTON" && element.textContent === "重新生成梦境画像"
  )[0];

  await retryButton.trigger("click");

  assert.equal(harness.getSavedRecords().length, 0);
  assert.match(collectText(harness.guidedResultCard).join("\n"), /请先保存这份深度报告，再从梦境详情中重新生成画像。/);
});

test("app bridge keeps opening existing Dream Detail from Dream Journal records", () => {
  const harness = createAppIntegrationHarness();

  harness.windowRef.DreamAnatomyApp.openDreamDetail("record-one", createRecord({
    id: "record-one",
    createdAt: "2026-07-12T22:35:00.000Z",
    rawDreamText: "我梦见自己走在一条很长的走廊里。\n尽头有一扇发光的门。\n我停在门前很久。",
    dreamSummary: "走廊尽头的门",
    emotions: "安静、迟疑",
    symbols: "走廊、门、光",
    sleepQuality: "浅睡",
    analysisType: "深度引导",
    reportContent: {
      summary: "梦境整理",
      jungianView: "可能是在靠近一个还没有完全展开的内在部分。",
      lifeConnection: "也许和最近的选择感有关。",
      reflectionQuestions: "你可以思考那扇门带来的感受。",
      smallAction: "写下一句话。",
      gentleReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
    }
  }));

  const detailText = collectText(harness.dreamDetailContent).join("\n");
  const analysisCards = [];
  function collectByTag(node, tagName) {
    if (node.tagName === tagName) {
      analysisCards.push(node);
    }
    node.children.forEach((child) => collectByTag(child, tagName));
  }
  collectByTag(harness.dreamDetailContent, "DETAILS");

  assert.equal(harness.journalListShell.hidden, true);
  assert.equal(harness.dreamDetail.hidden, false);
  assert.match(detailText, /走廊尽头的门/);
  assert.match(detailText, /日期/);
  assert.match(detailText, /时间/);
  assert.match(detailText, /我梦见自己走在一条很长的走廊里。\n尽头有一扇发光的门。\n我停在门前很久。/);
  assert.match(detailText, /梦境摘要/);
  assert.match(detailText, /情绪标签/);
  assert.match(detailText, /梦境意象/);
  assert.match(detailText, /AI 分析/);
  assert.match(detailText, /荣格/);
  assert.match(detailText, /弗洛伊德/);
  assert.match(detailText, /现代心理学/);
  assert.match(detailText, /温和提醒/);
  assert.match(detailText, /这不是诊断、治疗或预言，只是一种自我探索视角。/);
  assert.match(detailText, /自我思考/);
  assert.match(detailText, /这里先留给之后的自我思考记录。/);
  assert.equal(analysisCards.length, 3);
  analysisCards.forEach((card) => {
    assert.notEqual(card.open, true);
  });
});

test("Dream Detail renders a saved dream result card without replacing existing sections", () => {
  const record = createRecord({
    id: "saved-result-card",
    reportContent: {
      summary: "走廊尽头的门",
      jungian: "也许和最近的选择感有关。",
      reminder: "这不是诊断、治疗或预言，只是一种自我探索视角。",
      dreamResultCard: createResultCardFixture()
    }
  });
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    records: [record]
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);

  const detailText = collectText(harness.dreamDetailContent).join("\n");
  assert.match(detailText, /梦境原文/);
  assert.match(detailText, /梦境摘要/);
  assert.match(detailText, /情绪标签/);
  assert.match(detailText, /梦境意象/);
  assert.match(detailText, /AI 分析/);
  assert.match(detailText, /自我思考/);
  assert.match(detailText, /梦境画像/);
  assert.match(detailText, /创造者/);
  assert.match(detailText, /一句话核心洞察/);
});

test("Dream Detail generates, saves, and re-renders a missing dream result card", async () => {
  const record = createRecord({
    id: "generate-result-card",
    localRecordId: "local-generate-result-card",
    cloudId: "cloud-generate-result-card",
    userId: "user-generate-result-card",
    syncStatus: "pending_sync",
    reportContent: { summary: "保留已有报告内容" }
  });
  const fetchCalls = [];
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    records: [record],
    fetch: async (url, options) => {
      fetchCalls.push([url, options]);
      return {
        ok: true,
        json: async () => ({ analysis: createResultCardFixture() })
      };
    }
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  const generationButton = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "BUTTON" && element.textContent === "生成梦境画像"
  )[0];

  assert.match(collectText(harness.dreamDetailContent).join("\n"), /尚未生成梦境画像/);
  assert.ok(generationButton);
  await generationButton.trigger("click");

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0][0], "/api/dream-analysis");
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), {
    dreamText: record.rawDreamText,
    analysisType: "result_card"
  });

  const savedRecords = harness.getSavedRecords();
  assert.equal(savedRecords.length, 1);
  assert.equal(savedRecords[0].id, record.id);
  assert.equal(savedRecords[0].localRecordId, record.localRecordId);
  assert.equal(savedRecords[0].cloudId, record.cloudId);
  assert.equal(savedRecords[0].userId, record.userId);
  assert.equal(savedRecords[0].syncStatus, record.syncStatus);
  assert.equal(savedRecords[0].reportContent.summary, "保留已有报告内容");
  assert.equal(savedRecords[0].reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);
  assert.match(collectText(harness.dreamDetailContent).join("\n"), /一句话核心洞察/);
});

test("Dream Detail keeps the missing-card fallback and shows a safe error when generation fails", async () => {
  const record = createRecord({ id: "failed-result-card", reportContent: { summary: "旧记录" } });
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    records: [record],
    fetch: async () => {
      throw new Error("Network unavailable");
    }
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  const generationButton = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "BUTTON" && element.textContent === "生成梦境画像"
  )[0];

  assert.match(collectText(harness.dreamDetailContent).join("\n"), /尚未生成梦境画像/);
  await generationButton.trigger("click");
  assert.match(collectText(harness.dreamDetailContent).join("\n"), /暂时无法生成梦境画像，请稍后再试。/);
});

test("opening Dream Journal and Dream Detail does not automatically call AI", () => {
  let fetchCount = 0;
  const record = createRecord({
    id: "read-only-card",
    reportContent: {
      summary: "走廊尽头的门",
      dreamResultCard: createResultCardFixture(),
      dreamResultCardStatus: "ai_generated"
    }
  });
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    records: [record],
    fetch: async () => {
      fetchCount += 1;
      throw new Error("AI should not be called while opening journal or detail");
    }
  });

  harness.windowRef.DreamAnatomyApp.renderDreamJournal([record]);
  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);

  assert.equal(fetchCount, 0);
  assert.match(collectText(harness.dreamDetailContent).join("\n"), /梦境画像/);
});

test("old records without result cards still show manual generation fallback", () => {
  const record = createRecord({
    id: "old-record-without-card",
    reportContent: { summary: "旧记录" }
  });
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    records: [record]
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);

  const text = collectText(harness.dreamDetailContent).join("\n");
  assert.match(text, /尚未生成梦境画像/);
  assert.equal(
    findElements(harness.dreamDetailContent, (element) => element.tagName === "BUTTON" && element.textContent === "生成梦境画像").length,
    1
  );
});

test("documents unified result-card flow boundaries", () => {
  const readme = fs.readFileSync(path.join(__dirname, "../README.md"), "utf8");
  const projectStatus = fs.readFileSync(path.join(__dirname, "../docs/PROJECT_STATUS.md"), "utf8");
  const indexHtml = fs.readFileSync(path.join(__dirname, "../src/index.html"), "utf8");

  for (const document of [readme, projectStatus]) {
    assert.match(document, /一次最终请求/);
    assert.match(document, /当前结果页/);
    assert.match(document, /reportContent\.dreamResultCard/);
    assert.match(document, /Dream Journal.*Dream Detail|Dream Detail.*Dream Journal/s);
    assert.match(document, /不.*自动.*(?:重复|重新).*AI|不.*重复.*调用/s);
  }

  assert.doesNotMatch(indexHtml, /本地 mock 生成/);
});

test("static assets include Dream Journal copy, styles, and documentation", () => {
  const html = fs.readFileSync(path.join(__dirname, "../src/index.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../src/style.css"), "utf8");
  const readme = fs.readFileSync(path.join(__dirname, "../README.md"), "utf8");
  const projectStatus = fs.readFileSync(path.join(__dirname, "../docs/PROJECT_STATUS.md"), "utf8");

  assert.match(html, /Dream Archive/);
  assert.match(html, /梦境日记/);
  assert.match(html, /你的每一个梦，都值得被温柔收藏。/);
  assert.match(html, />记录新梦</);
  assert.match(html, />搜索</);
  assert.match(html, /data-journal-loading/);
  assert.match(html, /data-journal-search/);
  assert.match(html, /data-journal-filter="快速解析"/);
  assert.match(html, /data-journal-filter="深度解析"/);
  assert.match(html, /data-journal-filter="待同步"/);
  assert.doesNotMatch(html, />Dream Journal<|>New Dream<|>Search<|>Quick<|>Deep<|>Pending Sync</);
  assert.ok(html.indexOf("dreamJournal.js") < html.indexOf("app.js"));

  assert.match(css, /\.dream-journal-page-heading/);
  assert.match(css, /\.dream-journal-toolbar/);
  assert.match(css, /\.dream-journal-filters/);
  assert.match(css, /\.dream-journal-group/);
  assert.match(css, /\.dream-journal-record-card/);
  assert.match(css, /\.dream-journal-kind-badge/);
  assert.match(css, /\.dream-journal-sync-badge/);
  assert.match(css, /\.dream-journal-empty/);
  assert.match(css, /\.detail-hero/);
  assert.match(css, /\.detail-section/);
  assert.match(css, /\.detail-analysis-card/);
  assert.match(css, /\.detail-reflection/);
  assert.match(css, /@media \(min-width: 821px\)[\s\S]*\.dream-journal-page-heading/);
  assert.doesNotMatch(css, /@media \(max-width: 820px\)[\s\S]*\.dream-journal-page-heading,[\s\S]*\.dream-journal-record-heading/);

  assert.match(readme, /Dream Journal/);
  assert.match(readme, /实时搜索/);
  assert.match(readme, /Pending Sync/);
  assert.match(readme, /scripts\/\n│   └── writeRuntimeEnv\.js/);
  assert.match(readme, /runtime-env\.js/);
  assert.match(readme, /ACCEPTANCE\.md/);
  assert.match(readme, /MVP_SPEC\.md/);
  assert.match(readme, /PRD_ALIGNMENT\.md/);
  assert.match(readme, /PROJECT_STATUS\.md/);
  assert.match(readme, /vendor\/\n│       └── supabase\.js/);
  assert.match(readme, /supabase\/\n│   └── migrations\//);
  assert.doesNotMatch(readme, /占位区域/);
  assert.match(projectStatus, /Dream Journal/);
  assert.match(projectStatus, /dreamJournal\.js/);
  assert.match(projectStatus, /superpowers\//);
  assert.match(projectStatus, /scripts\/\n│   └── writeRuntimeEnv\.js/);
  assert.match(projectStatus, /runtime-env\.js/);
  assert.match(projectStatus, /vendor\/\n│       └── supabase\.js/);
  assert.match(projectStatus, /按日期自动分组/);
  assert.match(projectStatus, /tests\/：包含当前自动化测试/);
  assert.match(projectStatus, /本轮没有实现 Timeline/);
  assert.doesNotMatch(projectStatus, /编辑或删除能力/);
  assert.doesNotMatch(projectStatus, /只读详情入口/);
});
