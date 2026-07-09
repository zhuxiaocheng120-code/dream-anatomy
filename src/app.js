const viewPanels = document.querySelectorAll("[data-view]");
const viewButtons = document.querySelectorAll("[data-view-target]");
const quickForm = document.querySelector("[data-quick-form]");
const quickDream = document.querySelector("#quickDream");
const quickResult = document.querySelector("#quickResult");
const resultFields = document.querySelectorAll("[data-result-field]");
const dreamJournalList = document.querySelector("#dreamJournalList");
const dreamJournalEmpty = document.querySelector("#dreamJournalEmpty");
const clearJournalButton = document.querySelector("[data-clear-journal]");
const dreamJournalStorageKey = "dreamAnatomy.quickDecodeRecords";

function showView(viewName) {
  viewPanels.forEach((panel) => {
    const isCurrentView = panel.dataset.view === viewName;
    panel.hidden = !isCurrentView;
    panel.classList.toggle("is-active", isCurrentView);
  });

  viewButtons.forEach((button) => {
    button.classList.toggle("is-current", button.dataset.viewTarget === viewName);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.viewTarget);
  });
});

function getShortDreamText(rawDreamText) {
  return rawDreamText.length > 72
    ? `${rawDreamText.slice(0, 72)}...`
    : rawDreamText;
}

function getPossibleSymbols(rawDreamText) {
  const symbolHints = ["学校", "考试", "路", "雨", "妈妈", "黑狗", "森林", "门", "河", "桥", "房子", "水"];
  const matchedSymbols = symbolHints.filter((symbol) => rawDreamText.includes(symbol));

  if (matchedSymbols.length > 0) {
    return matchedSymbols.slice(0, 4).join("、");
  }

  return "梦中的地点、人物、物件或反复出现的画面";
}

function fillQuickResult(result) {
  resultFields.forEach((field) => {
    field.textContent = result[field.dataset.resultField];
  });
}

function generateMockQuickDecode(rawDreamText) {
  // TODO: replace this mock output with OpenAI or DeepSeek API response through a backend proxy.
  const shortDreamText = getShortDreamText(rawDreamText);
  const possibleSymbols = getPossibleSymbols(rawDreamText);

  return {
    summary: `你记录的梦境碎片可以先整理为：“${shortDreamText}”。这可以作为后续自我探索的入口。`,
    emotion: "这个梦里可能包含紧张、困惑、好奇或迟疑等情绪。你可以先观察哪一种感受最靠近醒来后的状态。",
    symbols: `主要象征也许包括：${possibleSymbols}。这些意象不需要被固定解释，可以先看它们让你联想到什么。`,
    jungian: "从温和的荣格视角看，这个梦可以理解为内在经验的一次呈现，也许正在邀请你靠近某个还没有被充分表达的部分。",
    question: "你可以思考：梦里哪个画面最吸引你，或让你最想避开？它和你最近的情绪、选择或关系有什么轻微连接吗？",
    reminder: "这不是诊断、治疗或预言，只是一种自我探索视角。如果梦境让你持续不安，可以考虑寻求可信任的人或专业支持。"
  };
}

function loadDreamRecords() {
  try {
    const savedRecords = localStorage.getItem(dreamJournalStorageKey);
    return savedRecords ? JSON.parse(savedRecords) : [];
  } catch (error) {
    return [];
  }
}

function saveDreamRecord(record) {
  const records = [record, ...loadDreamRecords()];
  localStorage.setItem(dreamJournalStorageKey, JSON.stringify(records));
  return records;
}

function createDreamRecord(rawDreamText, quickDecode) {
  return {
    id: `dream-${Date.now()}`,
    createdAt: new Date().toISOString(),
    rawDreamText,
    dreamSummary: quickDecode.summary,
    emotions: quickDecode.emotion,
    symbols: quickDecode.symbols,
    sleepQuality: "未记录",
    analysisType: "快速解析",
    reportContent: quickDecode
  };
}

function formatRecordDate(createdAt) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(createdAt));
}

function createJournalMeta(label, value) {
  const item = document.createElement("div");
  const labelNode = document.createElement("span");
  const valueNode = document.createElement("strong");

  labelNode.textContent = label;
  valueNode.textContent = value;
  item.append(labelNode, valueNode);

  return item;
}

function renderDreamJournal(records = loadDreamRecords()) {
  if (!dreamJournalList || !dreamJournalEmpty) {
    return;
  }

  dreamJournalList.textContent = "";
  dreamJournalEmpty.hidden = records.length > 0;

  if (clearJournalButton) {
    clearJournalButton.hidden = records.length === 0;
  }

  records.forEach((record) => {
    const card = document.createElement("article");
    const title = document.createElement("h3");
    const rawDream = document.createElement("p");
    const meta = document.createElement("div");

    card.className = "journal-card";
    title.textContent = "快速解析记录";
    rawDream.textContent = record.rawDreamText;
    meta.className = "journal-meta";
    meta.append(
      createJournalMeta("日期", formatRecordDate(record.createdAt)),
      createJournalMeta("梦境摘要", record.dreamSummary),
      createJournalMeta("主要情绪", record.emotions),
      createJournalMeta("主要意象", record.symbols),
      createJournalMeta("睡眠质量", record.sleepQuality),
      createJournalMeta("分析类型", record.analysisType)
    );

    card.append(title, rawDream, meta);
    dreamJournalList.append(card);
  });
}

if (quickForm) {
  quickForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const rawDreamText = quickDream.value.trim();
    const status = quickForm.querySelector(".status");

    if (!rawDreamText) {
      if (status) {
        status.textContent = "先写下一点梦境碎片也可以：一个画面、一种情绪，或醒来后还记得的细节。";
      }
      quickDream.focus();
      return;
    }

    const quickDecode = generateMockQuickDecode(rawDreamText);
    const dreamRecord = createDreamRecord(rawDreamText, quickDecode);

    fillQuickResult(quickDecode);
    quickResult.hidden = false;

    try {
      renderDreamJournal(saveDreamRecord(dreamRecord));
      if (status) {
        status.textContent = "已生成本地 mock 快速解析结果，并保存到本地梦境日记。当前不会发送到服务器。";
      }
    } catch (error) {
      if (status) {
        status.textContent = "已生成快速解析结果，但浏览器暂时无法保存本地记录。";
      }
    }
  });

  quickForm.addEventListener("reset", () => {
    quickResult.hidden = true;
    resultFields.forEach((field) => {
      field.textContent = "";
    });

    const status = quickForm.querySelector(".status");
    if (status) {
      status.textContent = "写下一段梦境碎片后，可以先生成一份本地 mock 的快速解析结果。";
    }
  });
}

if (clearJournalButton) {
  clearJournalButton.addEventListener("click", () => {
    const shouldClear = window.confirm("确定要清空保存在这个浏览器里的梦境记录吗？");

    if (!shouldClear) {
      return;
    }

    localStorage.removeItem(dreamJournalStorageKey);
    renderDreamJournal([]);
  });
}

renderDreamJournal();
