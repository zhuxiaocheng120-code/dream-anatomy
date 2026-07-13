const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const DreamJournal = require("../src/dreamJournal");

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

function createAppIntegrationHarness(options = {}) {
  const selectors = new Map();
  const viewPanels = [
    Object.assign(createFakeElement("section"), { dataset: { view: "home" } }),
    Object.assign(createFakeElement("section"), { dataset: { view: "diary" } })
  ];
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

      if (selector === "[data-journal-filter]") {
        return journalFilters;
      }

      return [];
    }
  };
  const localStorage = {
    getItem: () => null,
    removeItem() {},
    setItem() {}
  };

  selectors.set("[data-journal-list-shell]", journalListShell);
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
    localStorage,
    window: windowRef,
    Intl
  };

  if (options.realDreamJournal) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/dreamJournal.js"), "utf8"), context);
  }

  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8"), context);

  return {
    dreamDetail,
    dreamDetailContent,
    dreamJournalCalls,
    journalEmpty,
    journalList,
    journalListShell,
    journalNewDream,
    viewPanels,
    windowRef
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
    "Today",
    "Yesterday",
    "Earlier This Week",
    "Earlier This Month",
    "Older"
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
    DreamJournal.filterRecords(records, { query: "", filter: "Quick" }).map((record) => record.id),
    ["quick-school", "pending-rain"]
  );
  assert.deepEqual(
    DreamJournal.filterRecords(records, { query: "", filter: "Deep" }).map((record) => record.id),
    ["deep-sea"]
  );
  assert.deepEqual(
    DreamJournal.filterRecords(records, { query: "", filter: "Pending Sync" }).map((record) => record.id),
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
  assert.match(text, /Today/);
  assert.match(text, /Older/);
  assert.match(text, /<script>alert\('dream'\)<\/script>/);
  assert.match(text, /Quick/);
  assert.match(text, /Deep/);
  assert.match(text, /Pending Sync/);
  assert.match(text, /森林/);
  assert.match(text, /门/);
  assert.match(text, /河/);
  assert.doesNotMatch(text, /Symbols: 森林、门、河、桥/);
});

test("updates rendered records for live search and selected filters", () => {
  const elements = createDreamJournalElements();
  elements.filters[0].dataset.journalFilter = "全部";
  elements.filters[1].dataset.journalFilter = "Quick";
  elements.filters[2].dataset.journalFilter = "Deep";
  elements.filters[3].dataset.journalFilter = "Pending Sync";
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
  elements.filters[1].dataset.journalFilter = "Quick";
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
  assert.equal(harness.viewPanels[1].hidden, true);
});

test("app bridge keeps opening existing Dream Detail from Dream Journal records", () => {
  const harness = createAppIntegrationHarness();

  harness.windowRef.DreamAnatomyApp.openDreamDetail("record-one", createRecord({
    id: "record-one",
    dreamSummary: "桥边的梦"
  }));

  assert.equal(harness.journalListShell.hidden, true);
  assert.equal(harness.dreamDetail.hidden, false);
  assert.match(collectText(harness.dreamDetailContent).join("\n"), /桥边的梦/);
});

test("static assets include Dream Journal copy, styles, and documentation", () => {
  const html = fs.readFileSync(path.join(__dirname, "../src/index.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../src/style.css"), "utf8");
  const readme = fs.readFileSync(path.join(__dirname, "../README.md"), "utf8");
  const projectStatus = fs.readFileSync(path.join(__dirname, "../docs/PROJECT_STATUS.md"), "utf8");

  assert.match(html, /Dream Journal/);
  assert.match(html, /你的每一个梦，都值得被温柔收藏。/);
  assert.match(html, /data-journal-loading/);
  assert.match(html, /data-journal-search/);
  assert.match(html, /data-journal-filter="Quick"/);
  assert.match(html, /data-journal-filter="Deep"/);
  assert.match(html, /data-journal-filter="Pending Sync"/);
  assert.ok(html.indexOf("dreamJournal.js") < html.indexOf("app.js"));

  assert.match(css, /\.dream-journal-page-heading/);
  assert.match(css, /\.dream-journal-toolbar/);
  assert.match(css, /\.dream-journal-filters/);
  assert.match(css, /\.dream-journal-group/);
  assert.match(css, /\.dream-journal-record-card/);
  assert.match(css, /\.dream-journal-kind-badge/);
  assert.match(css, /\.dream-journal-sync-badge/);
  assert.match(css, /\.dream-journal-empty/);
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
