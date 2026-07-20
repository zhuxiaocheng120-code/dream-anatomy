const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const DreamJournal = require("../src/dreamJournal");
const DreamResultCard = require("../src/dreamResultCard");
const LegalDocuments = require("../src/legalDocuments");
const PrivacyData = require("../src/privacyData");
const ProductAnalytics = require("../src/productAnalytics");
const ServerProductAnalytics = require("../server/productAnalytics");

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
  const styleProperties = new Map();
  const element = {
    tagName: tagName.toUpperCase(),
    children: [],
    className: "",
    dataset: {},
    hidden: false,
    textContent: "",
    type: "",
    value: "",
    parentElement: null,
    style: {
      setProperty(name, value) {
        styleProperties.set(name, String(value));
      },
      getPropertyValue(name) {
        return styleProperties.get(name) || "";
      }
    },
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
      nodes.forEach((node) => {
        if (node && typeof node === "object") {
          node.parentElement = this;
        }
      });
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      nodes.forEach((node) => {
        if (node && typeof node === "object") {
          node.parentElement = this;
        }
      });
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
    dreamSummary: "你梦见自己在学校走廊里寻找教室，最后停在一扇发光的门前。",
    coreTheme: "这个梦更像是在围绕寻找方向、准备不足和靠近选择的感受展开。",
    coreInterpretation: "寻找教室的片段也许与近期的时间压力或被评价感有关；发光的门则可能像一个已经出现、但你还没有真正进入的入口。",
    evidence: [
      {
        dreamFragment: "寻找教室",
        interpretation: "这个片段支持追赶、准备或被评价感的分析。"
      },
      {
        dreamFragment: "发光的门",
        interpretation: "这个片段支持靠近选择或新方向的分析。"
      }
    ],
    emotionalReading: {
      primaryEmotion: "紧张",
      secondaryEmotions: ["迟疑"],
      intensity: 68,
      evidence: "紧张主要来自一直找不到教室。"
    },
    symbolReading: [
      {
        symbol: "门",
        context: "门出现在寻找教室之后。",
        possibleMeaning: "在这次梦里可能和选择有关。",
        evidence: "门发着光。",
        reflectionQuestion: "如果门可以打开，你希望门后是什么？"
      }
    ],
    reflectionQuestions: [
      "最近有什么事情让你感觉一直在追赶？",
      "梦里的教室让你想到哪一种准备？",
      "发光的门让你更想靠近还是观察？"
    ],
    gentleAction: "你可以用两分钟写下：梦里最让你着急的寻找片段，以及现实中是否有类似感受。",
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
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
  const quickSleepShell = createFakeElement("div");
  quickSleepShell.className = "sleep-quality-slider-shell";
  quickSleepShell.classList.add("sleep-quality-slider-shell");
  const quickSleepRange = Object.assign(createFakeElement("input"), {
    id: "quickSleepQualityRange",
    type: "range",
    value: "50"
  });
  const quickSleepCloud = createFakeElement("span");
  quickSleepCloud.className = "sleep-quality-cloud-visual";
  quickSleepCloud.classList.add("sleep-quality-cloud-visual");
  quickSleepShell.append(quickSleepRange, quickSleepCloud);
  const quickSleepDisplay = createFakeElement("p");
  const quickSleepClear = Object.assign(createFakeElement("button"), { type: "button" });
  const quickResult = Object.assign(createFakeElement("section"), { hidden: true });
  const quickResultCard = createFakeElement("div");
  const resultFields = ["summary", "theme", "emotion", "symbols", "jungian", "evidence", "question", "action", "reminder"].map((field) =>
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
  const eventListeners = new Map();
  const windowRef = {
    addEventListener(type, listener) {
      const listeners = eventListeners.get(type) || [];
      listeners.push(listener);
      eventListeners.set(type, listeners);
    },
    confirm: () => false,
    scrollTo() {}
  };
  const analyticsCalls = [];
  let lastAnalyticsView = "";
  const sessionStorageItems = new Map();
  const sessionStorage = {
    getItem(key) {
      return sessionStorageItems.has(key) ? sessionStorageItems.get(key) : null;
    },
    removeItem(key) {
      sessionStorageItems.delete(key);
    },
    setItem(key, value) {
      sessionStorageItems.set(key, String(value));
    }
  };
  const productAnalytics = options.productAnalytics || {
    flushEvents() {},
    trackEvent(name, properties) {
      analyticsCalls.push({ name, properties });
    },
    trackView(viewName) {
      if (viewName === lastAnalyticsView) return false;
      lastAnalyticsView = viewName;
      analyticsCalls.push({ name: "view_opened", properties: { view_name: viewName } });
      return true;
    }
  };
  windowRef.DreamProductAnalytics = options.realProductAnalytics
    ? ProductAnalytics
    : {
        createProductAnalyticsController() {
          return productAnalytics;
        }
      };
  windowRef.DreamAnatomyFeatureFlags = {
    DEEP_GUIDANCE_ENABLED: options.deepGuidanceEnabled !== false
  };

  if (options.realDreamResultCard) {
    windowRef.DreamResultCard = DreamResultCard;
  }

  if (options.privacyData) {
    windowRef.DreamPrivacyData = options.privacyData;
    windowRef.DreamLegalDocuments = LegalDocuments;
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
      if (selector === "[data-view].is-active") {
        return viewPanels.find((panel) => panel.classList.contains("is-active")) || null;
      }

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
  const storageItems = new Map(Object.entries(options.localStorage || {}));
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
  selectors.set("#quickSleepQualityRange", quickSleepRange);
  selectors.set("[data-quick-sleep-quality-display]", quickSleepDisplay);
  selectors.set("[data-quick-sleep-quality-clear]", quickSleepClear);
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
  windowRef.sessionStorage = sessionStorage;

  if (options.authSession !== undefined) {
    windowRef.DreamAnatomyAuth = {
      getClient() {
        return {
          auth: {
            async getSession() {
              return { data: { session: options.authSession }, error: null };
            }
          }
        };
      }
    };
  }

  if (options.dreamSyncController) {
    windowRef.DreamSync = {
      createDreamSyncController() {
        return options.dreamSyncController;
      },
      mapSupabaseRowToLocalRecord(row) {
        return row;
      }
    };
  }

  const context = {
    document: documentRef,
    fetch: options.fetch || (async () => {
      throw new Error("Unexpected fetch request");
    }),
    localStorage,
    sessionStorage,
    window: windowRef,
    Intl
  };

  if (options.realDreamJournal) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/dreamJournal.js"), "utf8"), context);
  }

  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/sleepQuality.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8"), context);

  return {
    deepReport,
    deepReportFields,
    deepSaveStatus,
    dreamDetail,
    dreamDetailContent,
    analyticsCalls,
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
    quickSleepCloud,
    quickSleepClear,
    quickSleepDisplay,
    quickSleepRange,
    quickSleepShell,
    quickResult,
    quickResultCard,
    resultFields,
    saveDeepReportButton,
    viewPanels,
    windowRef,
    async dispatchAuthSession(detail) {
      const listeners = eventListeners.get("dream-anatomy-auth-session") || [];
      await Promise.all(listeners.map((listener) => listener({ detail })));
    },
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

test("tracks opt-in quick, journal, and detail behavior without dream content", async () => {
  const harness = createAppIntegrationHarness({
    records: [createRecord({ id: "detail-record" })],
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async () => ({
      ok: true,
      json: async () => ({
        analysis: createQuickAnalysisFixture(),
        dreamResultCard: createResultCardFixture(),
        dreamResultCardStatus: "ai_generated"
      })
    })
  });

  harness.windowRef.DreamAnatomyApp.showView("quick");
  harness.windowRef.DreamAnatomyApp.showView("quick");
  harness.windowRef.DreamAnatomyApp.showView("diary");
  harness.windowRef.DreamAnatomyApp.showView("admin");
  harness.windowRef.DreamAnatomyApp.openDreamDetail("detail-record");
  harness.windowRef.DreamAnatomyApp.showView("quick");

  harness.quickDream.value = "我在学校走廊里一直找不到教室，门发着光。";
  harness.quickDream.trigger("input");
  harness.quickDream.trigger("input");
  harness.quickDream.trigger("blur");
  await harness.quickForm.trigger("submit");

  const names = harness.analyticsCalls.map((call) => call.name);
  assert.equal(names.filter((name) => name === "app_opened").length, 1);
  assert.equal(names.filter((name) => name === "view_opened").length, 3);
  assert.equal(names.includes("journal_opened"), true);
  assert.equal(names.includes("dream_detail_opened"), true);
  assert.equal(names.filter((name) => name === "dream_input_started").length, 1);
  assert.equal(names.includes("dream_input_abandoned"), false);
  assert.equal(names.filter((name) => name === "analysis_requested").length, 1);
  assert.equal(names.includes("analysis_completed"), true);
  assert.equal(names.includes("result_viewed"), true);
  assert.equal(names.filter((name) => name === "dream_saved").length, 1);
  assert.doesNotMatch(JSON.stringify(harness.analyticsCalls), /学校走廊|梦见/);
});

test("tracks quick input abandonment only when leaving without submitting analysis", () => {
  const harness = createAppIntegrationHarness({ noDreamJournal: true, fakeDreamJournal: false });

  harness.windowRef.DreamAnatomyApp.showView("quick");
  harness.quickDream.value = "我在学校走廊里一直找不到教室，门发着光。";
  harness.quickDream.trigger("input");
  harness.windowRef.DreamAnatomyApp.showView("home");

  const abandonment = harness.analyticsCalls.find((call) => call.name === "dream_input_abandoned");
  assert.ok(abandonment);
  assert.deepEqual(
    JSON.parse(JSON.stringify(abandonment.properties)),
    { length_bucket: "1-50", view_name: "quick" }
  );
});

test("tracks a failed quick analysis without completion", async () => {
  const harness = createAppIntegrationHarness({
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: "AUTH_INVALID", message: "登录状态已失效，请重新登录。" } })
    })
  });

  harness.quickDream.value = "我梦见自己在雨里迷路。";
  await harness.quickForm.trigger("submit");

  const names = harness.analyticsCalls.map((call) => call.name);
  assert.equal(names.includes("analysis_failed"), true);
  assert.equal(names.includes("analysis_completed"), false);
});

test("deployed app analytics waits for account preference and sends a server-valid authenticated app_opened", async () => {
  const requests = [];
  const accessToken = "member-token";
  const user = { id: "00000000-0000-4000-8000-000000000104" };
  const harness = createAppIntegrationHarness({
    fakeDreamJournal: false,
    noDreamJournal: true,
    privacyData: PrivacyData,
    realProductAnalytics: true,
    authSession: { access_token: accessToken, user },
    localStorage: { "dreamAnatomy.productAnalytics.guestPreference": "true" },
    fetch: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({}) };
    }
  });
  assert.equal(typeof harness.windowRef.DreamProductAnalytics.controller.trackEvent, "function");
  assert.equal(requests.length, 0);
  const client = {
    from(tableName) {
      if (tableName === "product_analytics_preferences") {
        return {
          select() { return this; },
          eq() { return { maybeSingle: async () => ({ data: { enabled: true }, error: null }) }; }
        };
      }

      return {
        select() { return this; },
        eq() { return { maybeSingle: async () => ({ data: null, error: null }) }; }
      };
    }
  };

  await harness.dispatchAuthSession({
    authEvent: "INITIAL_SESSION",
    client,
    user
  });
  await harness.dispatchAuthSession({ authEvent: "TOKEN_REFRESHED", client, user });

  assert.equal(requests.filter((request) => request.url === "/api/v1/product-events").length, 1);
  assert.deepEqual(requests[0].body.events.map((event) => event.eventName), ["app_opened"]);
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${accessToken}`);

  const identity = requests[0].options.headers.Authorization === `Bearer ${accessToken}`
    ? { type: "authenticated", userId: user.id }
    : { type: "guest" };
  const normalized = ServerProductAnalytics.normalizeProductEventBatch(requests[0].body, {
    appVersion: "test",
    identity,
    secret: "analytics-secret"
  });
  assert.equal(normalized.events.length, 1);
  assert.equal(normalized.rejected.length, 0);
});

test("authenticated app startup does not inherit an enabled guest analytics preference", async () => {
  const requests = [];
  const harness = createAppIntegrationHarness({
    fakeDreamJournal: false,
    noDreamJournal: true,
    privacyData: PrivacyData,
    realProductAnalytics: true,
    authSession: { access_token: "member-token", user: { id: "00000000-0000-4000-8000-000000000104" } },
    localStorage: { "dreamAnatomy.productAnalytics.guestPreference": "true" },
    fetch: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({}) };
    }
  });
  const user = { id: "00000000-0000-4000-8000-000000000104" };
  const client = {
    from(tableName) {
      if (tableName === "product_analytics_preferences") {
        return {
          select() { return this; },
          eq() { return { maybeSingle: async () => ({ data: { enabled: false }, error: null }) }; }
        };
      }

      return {
        select() { return this; },
        eq() { return { maybeSingle: async () => ({ data: null, error: null }) }; }
      };
    }
  };

  assert.equal(requests.length, 0);
  await harness.dispatchAuthSession({ authEvent: "INITIAL_SESSION", client, user });
  assert.equal(requests.length, 0);
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
  assert.equal(fetchCalls[0][0], "/api/v1/dream-analysis");
  assert.equal(fetchCalls[0][1].headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), {
    dreamText: harness.quickDream.value,
    analysisType: "quick"
  });
  assert.equal(harness.quickResult.hidden, false);
  assert.match(collectText(harness.quickResult).join("\n"), /寻找教室/);
  assert.match(collectText(harness.quickResult).join("\n"), /寻找方向、准备不足/);
  assert.match(collectText(harness.quickResult).join("\n"), /梦境片段：寻找教室/);
  assert.match(collectText(harness.quickResult).join("\n"), /两分钟写下/);
  assert.match(collectText(harness.quickResultCard).join("\n"), /梦境画像/);
  assert.match(collectText(harness.quickResultCard).join("\n"), /创造者/);

  const savedRecords = harness.getSavedRecords();
  assert.equal(savedRecords.length, 1);
  assert.equal(savedRecords[0].analysisType, "快速解析");
  assert.equal(savedRecords[0].reportContent.coreTheme, createQuickAnalysisFixture().coreTheme);
  assert.equal(savedRecords[0].reportContent.evidence.length, 2);
  assert.equal(savedRecords[0].reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);
  assert.equal(savedRecords[0].reportContent.dreamResultCardStatus, "ai_generated");
});

test("quick decode does not save an untouched sleep quality slider as 50", async () => {
  const fetchCalls = [];
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async (url, options) => {
      fetchCalls.push({ url, body: JSON.parse(options.body) });
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

  assert.match(harness.quickSleepDisplay.textContent, /未填写|滑动记录/);

  harness.quickDream.value = "我梦见自己站在一扇门前。";
  await harness.quickForm.trigger("submit");

  assert.deepEqual(fetchCalls[0].body, {
    dreamText: harness.quickDream.value,
    analysisType: "quick"
  });

  const savedRecords = harness.getSavedRecords();
  assert.equal(savedRecords.length, 1);
  assert.equal(savedRecords[0].sleepQuality, undefined);
  assert.equal(savedRecords[0].sleep_quality, undefined);
  assert.equal(savedRecords[0].reportContent.sleepQualityScore, undefined);
  assert.equal(savedRecords[0].reportContent.sleepQualityLabel, undefined);
  assert.equal(savedRecords[0].reportContent.sleepQualityUpdatedAt, undefined);
});

test("quick decode saves selected sleep quality score label and metadata", async () => {
  const fetchBodies = [];
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async (url, options) => {
      fetchBodies.push(JSON.parse(options.body));
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

  harness.quickSleepRange.value = "65";
  harness.quickSleepRange.trigger("input");
  assert.match(harness.quickSleepDisplay.textContent, /65% · 比较安稳/);

  harness.quickSleepClear.trigger("click");
  assert.match(harness.quickSleepDisplay.textContent, /未填写|滑动记录/);

  harness.quickSleepRange.value = "63";
  harness.quickSleepRange.trigger("input");
  assert.equal(harness.quickSleepRange.value, "65");

  harness.quickDream.value = "我梦见自己在雨里迷路。";
  await harness.quickForm.trigger("submit");

  assert.deepEqual(fetchBodies[0], {
    dreamText: harness.quickDream.value,
    analysisType: "quick"
  });

  const savedRecord = harness.getSavedRecords()[0];
  assert.equal(savedRecord.sleepQuality, "比较安稳");
  assert.equal(savedRecord.reportContent.sleepQualityScore, 65);
  assert.equal(savedRecord.reportContent.sleepQualityLabel, "比较安稳");
  assert.match(savedRecord.reportContent.sleepQualityUpdatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("quick sleep quality cloud visual follows the native range without changing save behavior", () => {
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false
  });

  assert.equal(harness.quickSleepShell.style.getPropertyValue("--sleep-quality-progress"), "50%");
  assert.equal(harness.quickSleepShell.style.getPropertyValue("--sleep-quality-cloud-position"), "50%");
  assert.equal(harness.quickSleepRange.classList.contains("is-empty"), true);

  harness.quickSleepRange.value = "25";
  harness.quickSleepRange.trigger("input");
  assert.equal(harness.quickSleepShell.style.getPropertyValue("--sleep-quality-progress"), "25%");
  assert.equal(harness.quickSleepShell.style.getPropertyValue("--sleep-quality-cloud-position"), "25%");
  assert.equal(harness.quickSleepDisplay.textContent, "25% · 偏疲惫");

  harness.quickSleepRange.value = "100";
  harness.quickSleepRange.trigger("input");
  assert.equal(harness.quickSleepShell.style.getPropertyValue("--sleep-quality-cloud-position"), "100%");
  assert.equal(harness.quickSleepDisplay.textContent, "100% · 很安稳");

  harness.quickSleepClear.trigger("click");
  assert.equal(harness.quickSleepShell.style.getPropertyValue("--sleep-quality-cloud-position"), "50%");
  assert.equal(harness.quickSleepRange.classList.contains("is-empty"), true);
});

test("quick decode sends Bearer token for logged-in users", async () => {
  const fetchCalls = [];
  const harness = createAppIntegrationHarness({
    authSession: { access_token: "session-token", user: { id: "user-one" } },
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
          dreamResultCardStatus: "ai_generated",
          usage: { authenticated: true, limit: 10, remaining: 9, resetAt: "2026-07-15T00:00:00.000Z" }
        })
      };
    }
  });

  harness.quickDream.value = "我在学校走廊里一直找不到教室，门发着光。";
  await harness.quickForm.trigger("submit");

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0][0], "/api/v1/dream-analysis");
  assert.equal(fetchCalls[0][1].headers.Authorization, "Bearer session-token");
});

test("quick decode shows stable API auth and quota errors without saving fallback records", async () => {
  const authHarness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: "AUTH_INVALID", message: "登录状态已失效，请重新登录。" },
        usage: { authenticated: false, limit: null, remaining: null, resetAt: null }
      })
    })
  });

  authHarness.quickDream.value = "我梦见一条黑狗被困住。";
  await authHarness.quickForm.trigger("submit");

  assert.equal(authHarness.quickResult.hidden, true);
  assert.match(authHarness.quickFormStatus.textContent, /登录状态已失效/);
  assert.equal(authHarness.getSavedRecords().length, 0);

  const quotaHarness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async () => ({
      ok: false,
      status: 429,
      json: async () => ({
        error: { code: "DAILY_LIMIT_REACHED", message: "今天的免费解析次数已经用完，稍后再来继续记录梦境。" },
        usage: { authenticated: false, limit: 3, remaining: 0, resetAt: "2026-07-15T00:00:00.000Z" }
      })
    })
  });

  quotaHarness.quickDream.value = "我梦见自己在雨里迷路。";
  await quotaHarness.quickForm.trigger("submit");

  assert.equal(quotaHarness.quickResult.hidden, true);
  assert.match(quotaHarness.quickFormStatus.textContent, /今天的免费解析次数已经用完/);
  assert.match(quotaHarness.quickFormStatus.textContent, /登录后可获得更多免费解析次数/);
  assert.equal(quotaHarness.getSavedRecords().length, 0);
});

test("quick decode shows an incomplete generation message without mock fallback", async () => {
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async () => ({
      ok: false,
      status: 422,
      json: async () => ({
        error: "Dream analysis result was incomplete.",
        generationMeta: { source: "generation_failed", qualityStatus: "incomplete" }
      })
    })
  });

  harness.quickDream.value = "我梦见一条黑狗被困住。";
  harness.quickSleepRange.value = "65";
  harness.quickSleepRange.trigger("input");
  await harness.quickForm.trigger("submit");

  assert.equal(harness.quickResult.hidden, true);
  assert.match(harness.quickFormStatus.textContent, /梦境画像结构连续不完整，已保留你的梦境内容。请稍后重新提交。/);
  assert.doesNotMatch(harness.quickFormStatus.textContent, /本地示例结果/);
  assert.equal(harness.quickDream.value, "我梦见一条黑狗被困住。");
  assert.match(harness.quickSleepDisplay.textContent, /65% · 比较安稳/);
  assert.equal(harness.getSavedRecords().length, 0);
});

test("disabled deep guidance entries do not navigate or request analysis", async () => {
  const fetchCalls = [];
  const harness = createAppIntegrationHarness({
    deepGuidanceEnabled: false,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async (url, options) => {
      fetchCalls.push([url, options]);
      throw new Error("Deep guidance should not request analysis while disabled.");
    }
  });

  harness.windowRef.DreamAnatomyApp.showView("home");
  harness.windowRef.DreamAnatomyApp.showView("guided");

  assert.equal(harness.viewPanels.find((panel) => panel.dataset.view === "home").hidden, false);
  assert.equal(harness.viewPanels.find((panel) => panel.dataset.view === "guided").hidden, true);

  harness.guidedDream.value = "我梦见一条长走廊。";
  await harness.guidedForm.trigger("submit");
  await harness.generateDeepReportButton.trigger("click");
  await harness.saveDeepReportButton.trigger("click");

  assert.equal(fetchCalls.length, 0);
  assert.equal(harness.guidedQuestions.hidden, true);
  assert.equal(harness.deepReport.hidden, true);
  assert.equal(harness.getSavedRecords().length, 0);
  assert.match(harness.guidedStatus.textContent, /深度引导正在开发中/);
});

test("deep guidance entry can navigate when feature flag is enabled", () => {
  const html = fs.readFileSync(path.join(__dirname, "../src/index.html"), "utf8");
  const harness = createAppIntegrationHarness({
    deepGuidanceEnabled: true,
    noDreamJournal: true,
    fakeDreamJournal: false
  });

  harness.windowRef.DreamAnatomyApp.showView("guided");

  assert.equal(harness.viewPanels.find((panel) => panel.dataset.view === "guided").hidden, false);
  assert.doesNotMatch(html, /data-feature-flag="deep-guidance"[^>]*disabled/);
});

test("server-disabled guided questions do not fall back to local mock questions", async () => {
  const harness = createAppIntegrationHarness({
    deepGuidanceEnabled: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: "FEATURE_DISABLED", message: "深度引导正在开发中。" },
        usage: { authenticated: false, limit: 3, remaining: 3, resetAt: null }
      })
    })
  });

  harness.guidedDream.value = "我梦见一条长走廊。";
  await harness.guidedForm.trigger("submit");

  assert.equal(harness.guidedQuestions.hidden, true);
  assert.equal(harness.guidedActions.hidden, true);
  assert.match(harness.guidedStatus.textContent, /深度引导正在开发中/);
  assert.doesNotMatch(harness.guidedStatus.textContent, /本地示例问题/);
});

test("quick decode rejects successful payloads that do not include a complete result card", async () => {
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

  assert.equal(harness.quickResult.hidden, true);
  assert.match(harness.quickFormStatus.textContent, /梦境画像结构连续不完整，已保留你的梦境内容。请稍后重新提交。/);
  assert.equal(harness.quickDream.value, "我在学校走廊里一直找不到教室。");
  assert.equal(harness.getSavedRecords().length, 0);
});

test("quick decode does not fall back to local mock when AI service is unavailable", async () => {
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async () => ({
      ok: false,
      status: 502,
      json: async () => ({
        error: { code: "UPSTREAM_UNAVAILABLE", message: "梦境解析服务暂时不可用，请稍后再试。" }
      })
    })
  });

  harness.quickDream.value = "我在学校走廊里一直找不到教室。";
  await harness.quickForm.trigger("submit");

  assert.equal(harness.quickResult.hidden, true);
  assert.match(harness.quickFormStatus.textContent, /梦境解析服务暂时不可用/);
  assert.doesNotMatch(harness.quickFormStatus.textContent, /本地示例结果/);
  assert.equal(harness.getSavedRecords().length, 0);
});

test("quick decode shows a limited-evidence notice when the result card is complete but tentative", async () => {
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    noDreamJournal: true,
    fakeDreamJournal: false,
    fetch: async () => ({
      ok: true,
      json: async () => ({
        analysis: createQuickAnalysisFixture(),
        dreamResultCard: createResultCardFixture(),
        dreamResultCardStatus: "ai_generated",
        generationMeta: {
          source: "ai_generated",
          promptVersion: "quick-analysis-v2",
          qualityStatus: "passed",
          limitedEvidence: true,
          evidenceConfidence: "low"
        }
      })
    })
  });

  harness.quickDream.value = "梦见门。很亮。";
  await harness.quickForm.trigger("submit");

  const cardText = collectText(harness.quickResultCard).join("\n");
  assert.equal(harness.quickResult.hidden, false);
  assert.match(cardText, /基于有限线索的暂定画像/);
  assert.match(cardText, /这张画像依据的是本次记录中呈现的线索/);
  assert.equal(harness.getSavedRecords()[0].reportContent.generationMeta.limitedEvidence, true);
});

test("guided questions come from the current dream through the backend", async () => {
  const fetchCalls = [];
  const harness = createAppIntegrationHarness({
    deepGuidanceEnabled: true,
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
    deepGuidanceEnabled: true,
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
    deepGuidanceEnabled: true,
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
    deepGuidanceEnabled: true,
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
    deepGuidanceEnabled: true,
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
  assert.match(detailText, /写下你对这个梦的联想、理解，或醒来后仍留下的感受。/);
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

test("Dream Detail displays and updates saved sleep quality without overwriting report content", async () => {
  const record = createRecord({
    id: "sleep-detail-record",
    sleepQuality: "比较安稳",
    reportContent: {
      summary: "保留已有报告内容",
      dreamResultCard: createResultCardFixture(),
      userReflection: "这扇门让我想到一个选择。",
      sleepQualityScore: 65,
      sleepQualityLabel: "比较安稳",
      sleepQualityUpdatedAt: "2026-07-20T08:00:00.000Z"
    }
  });
  let fetchCount = 0;
  const harness = createAppIntegrationHarness({
    records: [record],
    fetch: async () => {
      fetchCount += 1;
      throw new Error("Sleep quality save must not call AI");
    }
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  assert.match(collectText(harness.dreamDetailContent).join("\n"), /睡眠感受：65% · 比较安稳/);

  const editButton = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "BUTTON" && element.textContent === "修改"
  )[0];
  assert.ok(editButton);
  editButton.trigger("click");

  const range = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "INPUT" && element.type === "range"
  )[0];
  const saveButton = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "BUTTON" && element.textContent === "保存睡眠感受"
  )[0];
  assert.ok(range);
  assert.ok(saveButton);

  range.value = "81";
  range.trigger("input");
  assert.equal(range.value, "80");
  await saveButton.trigger("click");

  const saved = harness.getSavedRecords()[0];
  assert.equal(saved.sleepQuality, "比较安稳");
  assert.equal(saved.reportContent.sleepQualityScore, 80);
  assert.equal(saved.reportContent.sleepQualityLabel, "比较安稳");
  assert.equal(saved.reportContent.summary, "保留已有报告内容");
  assert.equal(saved.reportContent.userReflection, "这扇门让我想到一个选择。");
  assert.equal(saved.reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);
  assert.equal(fetchCount, 0);
  assert.doesNotMatch(JSON.stringify(harness.analyticsCalls), /睡眠感受|65|80/);
});

test("Dream Detail sleep quality editor renders a real cloud visual that follows the range", () => {
  const record = createRecord({
    id: "sleep-detail-cloud-record",
    sleepQuality: "比较安稳",
    reportContent: {
      summary: "保留已有报告内容",
      sleepQualityScore: 65,
      sleepQualityLabel: "比较安稳",
      sleepQualityUpdatedAt: "2026-07-20T08:00:00.000Z"
    }
  });
  const harness = createAppIntegrationHarness({ records: [record] });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  const editButton = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "BUTTON" && element.textContent === "修改"
  )[0];
  editButton.trigger("click");

  const shell = findElements(
    harness.dreamDetailContent,
    (element) => element.classList.contains("sleep-quality-slider-shell")
  )[0];
  const cloud = findElements(
    harness.dreamDetailContent,
    (element) => element.classList.contains("sleep-quality-cloud-visual")
  )[0];
  const range = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "INPUT" && element.type === "range"
  )[0];

  assert.ok(shell);
  assert.ok(cloud);
  assert.equal(cloud.attributes["aria-hidden"], "true");
  assert.equal(shell.style.getPropertyValue("--sleep-quality-cloud-position"), "65%");

  range.value = "75";
  range.trigger("input");
  assert.equal(shell.style.getPropertyValue("--sleep-quality-progress"), "75%");
  assert.equal(shell.style.getPropertyValue("--sleep-quality-cloud-position"), "75%");
});

test("Dream Detail uses a low-distraction entry for missing sleep quality", () => {
  const record = createRecord({
    id: "missing-sleep-detail",
    sleepQuality: null,
    reportContent: { summary: "没有睡眠感受的记录" }
  });
  const harness = createAppIntegrationHarness({ records: [record] });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);

  const detailText = collectText(harness.dreamDetailContent).join("\n");
  assert.doesNotMatch(detailText, /睡眠质量/);
  assert.doesNotMatch(detailText, /睡眠感受：未记录/);
  assert.match(detailText, /补充睡眠感受/);
});

test("Dream Detail saves and restores user reflection without overwriting report content", async () => {
  const record = createRecord({
    id: "reflection-record",
    reportContent: {
      summary: "保留已有报告内容",
      dreamResultCard: createResultCardFixture(),
      dreamResultCardStatus: "ai_generated"
    }
  });
  let fetchCount = 0;
  const harness = createAppIntegrationHarness({
    records: [record],
    fetch: async () => {
      fetchCount += 1;
      throw new Error("Reflection save must not call AI");
    }
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  const textarea = findElements(harness.dreamDetailContent, (element) => element.tagName === "TEXTAREA")[0];
  const saveButton = findElements(harness.dreamDetailContent, (element) => element.tagName === "BUTTON" && element.textContent === "保存自我思考")[0];

  assert.ok(textarea);
  assert.ok(saveButton);
  assert.match(collectText(harness.dreamDetailContent).join("\n"), /写下你对这个梦的联想、理解，或醒来后仍留下的感受。它只属于你的梦境记录。/);

  textarea.value = "这个场景让我想到正在学习如何停下来。";
  await saveButton.trigger("click");

  const saved = harness.getSavedRecords()[0];
  assert.equal(saved.reportContent.summary, "保留已有报告内容");
  assert.equal(saved.reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);
  assert.equal(saved.reportContent.userReflection, "这个场景让我想到正在学习如何停下来。");
  assert.match(saved.reportContent.userReflectionUpdatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(fetchCount, 0);
  assert.doesNotMatch(JSON.stringify(harness.analyticsCalls), /正在学习如何停下来/);

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  const restoredTextarea = findElements(harness.dreamDetailContent, (element) => element.tagName === "TEXTAREA")[0];
  assert.equal(restoredTextarea.value, "这个场景让我想到正在学习如何停下来。");
});

test("Dream Detail updates and clears user reflection explicitly", async () => {
  const record = createRecord({
    id: "clear-reflection-record",
    reportContent: {
      summary: "梦境整理",
      userReflection: "旧的自我思考",
      userReflectionUpdatedAt: "2026-07-01T00:00:00.000Z"
    }
  });
  const harness = createAppIntegrationHarness({ records: [record] });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  let textarea = findElements(harness.dreamDetailContent, (element) => element.tagName === "TEXTAREA")[0];
  let saveButton = findElements(harness.dreamDetailContent, (element) => element.tagName === "BUTTON" && element.textContent === "保存自我思考")[0];
  const clearButton = findElements(harness.dreamDetailContent, (element) => element.tagName === "BUTTON" && element.textContent === "清空")[0];

  assert.equal(textarea.value, "旧的自我思考");

  textarea.value = "新的理解。";
  await saveButton.trigger("click");
  assert.equal(harness.getSavedRecords()[0].reportContent.userReflection, "新的理解。");
  assert.notEqual(harness.getSavedRecords()[0].reportContent.userReflectionUpdatedAt, "2026-07-01T00:00:00.000Z");

  await clearButton.trigger("click");
  assert.equal(textarea.value, "");
  assert.match(collectText(harness.dreamDetailContent).join("\n"), /已清空输入，点击保存后更新记录。/);

  await saveButton.trigger("click");
  const saved = harness.getSavedRecords()[0];
  assert.equal(saved.reportContent.userReflection, undefined);
  assert.equal(saved.reportContent.userReflectionUpdatedAt, undefined);

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  textarea = findElements(harness.dreamDetailContent, (element) => element.tagName === "TEXTAREA")[0];
  assert.equal(textarea.value, "");
});

test("Dream Detail reflection save failure and concurrent clicks stay safe", async () => {
  const record = createRecord({
    id: "cloud-reflection-record",
    reportContent: { summary: "云端报告" }
  });
  let saveCalls = 0;
  let rejectSave;
  const pending = new Promise((resolve, reject) => {
    rejectSave = reject;
  });
  const harness = createAppIntegrationHarness({
    dreamSyncController: {
      getCurrentUser() {
        return { id: "user-one" };
      },
      getVisibleRecords() {
        return [record];
      },
      saveRecord() {
        saveCalls += 1;
        return pending;
      }
    }
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  const textarea = findElements(harness.dreamDetailContent, (element) => element.tagName === "TEXTAREA")[0];
  const saveButton = findElements(harness.dreamDetailContent, (element) => element.tagName === "BUTTON" && element.textContent === "保存自我思考")[0];
  textarea.value = "云端暂时保存失败。";
  const firstSave = saveButton.trigger("click");
  await saveButton.trigger("click");

  assert.equal(saveCalls, 1);
  assert.equal(saveButton.disabled, true);

  rejectSave(new Error("cloud failed"));
  await firstSave;

  assert.equal(saveButton.disabled, false);
  assert.match(collectText(harness.dreamDetailContent).join("\n"), /保存失败，请稍后再试。/);
});

test("stale Dream Detail reflection save cannot overwrite a newly opened record", async () => {
  const recordOne = createRecord({ id: "record-one", dreamSummary: "第一条梦", reportContent: { summary: "第一条" } });
  const recordTwo = createRecord({ id: "record-two", dreamSummary: "第二条梦", reportContent: { summary: "第二条" } });
  let resolveSave;
  const pending = new Promise((resolve) => {
    resolveSave = resolve;
  });
  const harness = createAppIntegrationHarness({
    dreamSyncController: {
      getCurrentUser() {
        return { id: "user-one" };
      },
      getVisibleRecords() {
        return [recordOne, recordTwo];
      },
      saveRecord(recordToSave) {
        return pending.then(() => ({ records: [recordToSave, recordTwo], syncStatus: "synced" }));
      }
    }
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail("record-one");
  const textarea = findElements(harness.dreamDetailContent, (element) => element.tagName === "TEXTAREA")[0];
  const saveButton = findElements(harness.dreamDetailContent, (element) => element.tagName === "BUTTON" && element.textContent === "保存自我思考")[0];
  textarea.value = "第一条的自我思考。";
  const savePromise = saveButton.trigger("click");

  harness.windowRef.DreamAnatomyApp.openDreamDetail("record-two");
  assert.match(collectText(harness.dreamDetailContent).join("\n"), /第二条梦/);

  resolveSave();
  await savePromise;

  assert.match(collectText(harness.dreamDetailContent).join("\n"), /第二条梦/);
  assert.doesNotMatch(collectText(harness.dreamDetailContent).join("\n"), /第一条的自我思考/);
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
    authSession: { access_token: "detail-token", user: { id: "user-one" } },
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
  assert.equal(fetchCalls[0][0], "/api/v1/dream-analysis");
  assert.equal(fetchCalls[0][1].headers.Authorization, "Bearer detail-token");
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

test("Dream Detail reflection save preserves a card generated after the detail opened", async () => {
  const record = createRecord({
    id: "generate-then-reflect",
    reportContent: { summary: "旧记录报告" }
  });
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    records: [record],
    fetch: async () => ({
      ok: true,
      json: async () => ({ analysis: createResultCardFixture() })
    })
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  const generationButton = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "BUTTON" && element.textContent === "生成梦境画像"
  )[0];
  await generationButton.trigger("click");

  const textarea = findElements(harness.dreamDetailContent, (element) => element.tagName === "TEXTAREA")[0];
  const saveButton = findElements(harness.dreamDetailContent, (element) => element.tagName === "BUTTON" && element.textContent === "保存自我思考")[0];
  textarea.value = "生成画像之后补充的自我思考。";
  await saveButton.trigger("click");

  const saved = harness.getSavedRecords()[0];
  assert.equal(saved.reportContent.summary, "旧记录报告");
  assert.equal(saved.reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);
  assert.equal(saved.reportContent.dreamResultCardStatus, "ai_generated");
  assert.equal(saved.reportContent.userReflection, "生成画像之后补充的自我思考。");
});

test("Dream Detail queues concurrent card and reflection saves for the same cloud record", async () => {
  const record = createRecord({
    id: "concurrent-cloud-record",
    reportContent: { summary: "云端旧记录" }
  });
  let visibleRecords = [record];
  const saveCalls = [];
  const saveResolvers = [];
  let firstSaveStarted;
  let secondSaveStarted;
  const firstSaveStartedPromise = new Promise((resolve) => {
    firstSaveStarted = resolve;
  });
  const secondSaveStartedPromise = new Promise((resolve) => {
    secondSaveStarted = resolve;
  });
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    authSession: { access_token: "cloud-token", user: { id: "user-one" } },
    fetch: async () => ({
      ok: true,
      json: async () => ({ analysis: createResultCardFixture() })
    }),
    dreamSyncController: {
      getCurrentUser() {
        return { id: "user-one" };
      },
      getVisibleRecords() {
        return visibleRecords;
      },
      saveRecord(recordToSave) {
        saveCalls.push(recordToSave);
        if (saveCalls.length === 1) {
          firstSaveStarted();
        }
        if (saveCalls.length === 2) {
          secondSaveStarted();
        }
        return new Promise((resolve) => {
          saveResolvers.push(() => {
            visibleRecords = [recordToSave];
            resolve({ records: visibleRecords, syncStatus: "synced" });
          });
        });
      }
    }
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  const generationButton = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "BUTTON" && element.textContent === "生成梦境画像"
  )[0];
  const generationSave = generationButton.trigger("click");
  await firstSaveStartedPromise;

  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);

  const textarea = findElements(harness.dreamDetailContent, (element) => element.tagName === "TEXTAREA")[0];
  const saveButton = findElements(harness.dreamDetailContent, (element) => element.tagName === "BUTTON" && element.textContent === "保存自我思考")[0];
  textarea.value = "和画像同时保存的自我思考。";
  const reflectionSave = saveButton.trigger("click");

  assert.equal(saveCalls.length, 1);
  saveResolvers.shift()();
  await secondSaveStartedPromise;

  assert.equal(saveCalls.length, 2);
  assert.equal(saveCalls[1].reportContent.summary, "云端旧记录");
  assert.equal(saveCalls[1].reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);
  assert.equal(saveCalls[1].reportContent.userReflection, "和画像同时保存的自我思考。");

  saveResolvers.shift()();
  await generationSave;
  await reflectionSave;

  assert.equal(visibleRecords[0].reportContent.dreamResultCard.coreInsight, createResultCardFixture().coreInsight);
  assert.equal(visibleRecords[0].reportContent.userReflection, "和画像同时保存的自我思考。");
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

test("Dream Detail maps result-card regeneration API errors to specific user messages", async () => {
  const cases = [
    {
      code: "GENERATION_INCOMPLETE",
      status: 422,
      expected: "这次画像仍未能完整生成，可以稍后再试。"
    },
    {
      code: "UPSTREAM_TIMEOUT",
      status: 504,
      expected: "AI 回应时间较长，请稍后重新生成。"
    },
    {
      code: "RATE_LIMITED",
      status: 429,
      expected: "操作太快了，请稍等后再试。"
    },
    {
      code: "DAILY_LIMIT_REACHED",
      status: 429,
      expected: "今天的免费生成次数已经用完。"
    },
    {
      code: "UPSTREAM_UNAVAILABLE",
      status: 502,
      expected: "梦境画像服务暂时不可用。"
    }
  ];

  for (const item of cases) {
    const record = createRecord({
      id: `failed-${item.code}`,
      reportContent: {
        summary: "旧记录",
        dreamResultCardStatus: "generation_failed"
      }
    });
    const harness = createAppIntegrationHarness({
      realDreamResultCard: true,
      records: [record],
      fetch: async () => ({
        ok: false,
        status: item.status,
        json: async () => ({
          error: {
            code: item.code,
            message: "服务器提示"
          }
        })
      })
    });

    harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
    const generationButton = findElements(
      harness.dreamDetailContent,
      (element) => element.tagName === "BUTTON" && element.textContent === "重新生成梦境画像"
    )[0];

    await generationButton.trigger("click");

    const text = collectText(harness.dreamDetailContent).join("\n");
    assert.match(text, new RegExp(item.expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Dream Detail prevents duplicate result-card regeneration requests while one is running", async () => {
  const record = createRecord({
    id: "duplicate-result-card-generation",
    reportContent: {
      summary: "旧记录",
      dreamResultCardStatus: "generation_failed"
    }
  });
  let fetchCount = 0;
  let resolveFetch;
  const fetchPromise = new Promise((resolve) => {
    resolveFetch = resolve;
  });
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    records: [record],
    fetch: async () => {
      fetchCount += 1;
      return fetchPromise;
    }
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  const generationButton = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "BUTTON" && element.textContent === "重新生成梦境画像"
  )[0];

  const firstClick = generationButton.trigger("click");
  const secondClick = generationButton.trigger("click");
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(fetchCount, 1);
  assert.match(collectText(harness.dreamDetailContent).join("\n"), /正在重新整理梦境画像……/);

  resolveFetch({
    ok: true,
    json: async () => ({ analysis: createResultCardFixture() })
  });
  await firstClick;
  await secondClick;
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

test("guest manual Dream Result Card generation requires legal consent before API request", async () => {
  let fetchCount = 0;
  const record = createRecord({
    id: "guest-old-record-without-card",
    reportContent: { summary: "旧记录" }
  });
  const harness = createAppIntegrationHarness({
    realDreamResultCard: true,
    records: [record],
    fetch: async () => {
      fetchCount += 1;
      throw new Error("AI request should be gated");
    },
    privacyData: {
      createPrivacyDataController: () => ({
        deleteDreamRecord: async () => ({}),
        ensureGuestAiConsent: async () => false,
        handleSession() {},
        openLegalDocument() {},
        render() {}
      })
    }
  });

  harness.windowRef.DreamAnatomyApp.openDreamDetail(record.id);
  const generationButton = findElements(
    harness.dreamDetailContent,
    (element) => element.tagName === "BUTTON" && element.textContent === "生成梦境画像"
  )[0];

  await generationButton.trigger("click");

  assert.equal(fetchCount, 0);
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
