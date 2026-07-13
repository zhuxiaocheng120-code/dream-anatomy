const viewPanels = document.querySelectorAll("[data-view]");
const viewButtons = document.querySelectorAll("[data-view-target]");
const quickForm = document.querySelector("[data-quick-form]");
const quickDream = document.querySelector("#quickDream");
const quickResult = document.querySelector("#quickResult");
const quickResultCard = document.querySelector("[data-quick-result-card]");
const resultFields = document.querySelectorAll("[data-result-field]");
const journalListShell = document.querySelector("[data-journal-list-shell]");
const dreamJournalList = document.querySelector("#dreamJournalList");
const dreamJournalEmpty = document.querySelector("#dreamJournalEmpty");
const clearJournalButton = document.querySelector("[data-clear-journal]");
const dreamJournalSearch = document.querySelector("[data-journal-search]");
const dreamJournalFilters = Array.from(document.querySelectorAll("[data-journal-filter]"));
const dreamJournalNewDreamButton = document.querySelector("[data-journal-new-dream]");
const dreamJournalLoading = document.querySelector("[data-journal-loading]");
const dreamDetail = document.querySelector("[data-dream-detail]");
const dreamDetailContent = document.querySelector("[data-dream-detail-content]");
const backToJournalButton = document.querySelector("[data-back-to-journal]");
const journalSyncStatus = document.querySelector("[data-journal-sync-status]");
const guidedForm = document.querySelector("[data-guided-form]");
const guidedDream = document.querySelector("#guidedDream");
const guidedQuestionsContainer = document.querySelector("[data-guided-questions]");
const guidedStatus = document.querySelector("[data-guided-status]");
const guidedActions = document.querySelector("[data-guided-actions]");
const generateDeepReportButton = document.querySelector("[data-generate-deep-report]");
const deepReport = document.querySelector("[data-deep-report]");
const deepReportFields = document.querySelectorAll("[data-deep-report-field]");
const guidedResultCard = document.querySelector("[data-guided-result-card]");
const saveDeepReportButton = document.querySelector("[data-save-deep-report]");
const deepSaveStatus = document.querySelector("[data-deep-save-status]");
const dreamJournalStorageKey = "dreamAnatomy.quickDecodeRecords";
const maxDreamTextLength = 5000;
const canUseDreamJournal = window.DreamJournal
  && typeof window.DreamJournal.createDreamJournalController === "function";
const canUseDreamResultCard = window.DreamResultCard
  && typeof window.DreamResultCard.createDreamResultCardController === "function";
const featureFlags = window.DreamAnatomyFeatureFlags || {};
const deepGuidanceEnabled = featureFlags.DEEP_GUIDANCE_ENABLED === true;
const dreamSyncController = window.DreamSync
  ? window.DreamSync.createDreamSyncController({
      client: window.DreamAnatomyAuth ? window.DreamAnatomyAuth.getClient() : null,
      storage: localStorage,
      storageKey: dreamJournalStorageKey,
      onRecordsChange: renderDreamJournal,
      onStatusChange: updateJournalSyncStatus
    })
  : null;
const guidedDraftState = {
  rawDreamText: "",
  questions: [],
  answers: {},
  currentReport: null,
  savedReportRecordId: ""
};
const dreamJournalController = canUseDreamJournal
  ? window.DreamJournal.createDreamJournalController({
      app: {
        openDreamDetail,
        showView
      },
      document,
      elements: {
        empty: dreamJournalEmpty,
        filters: dreamJournalFilters,
        list: dreamJournalList,
        loading: dreamJournalLoading,
        newDreamButton: dreamJournalNewDreamButton,
        searchInput: dreamJournalSearch
      }
    })
  : null;
const dreamResultCardController = canUseDreamResultCard
  ? window.DreamResultCard.createDreamResultCardController({
      document,
      requestResultCard(record) {
        return requestDreamResultCard(getRecordField(record, "raw_dream_text", "rawDreamText"));
      },
      saveResultCard: saveDreamResultCard
    })
  : null;

function updateJournalSyncStatus(message) {
  if (journalSyncStatus) {
    journalSyncStatus.textContent = message || "";
  }
}

if (dreamSyncController) {
  window.addEventListener("dream-anatomy-auth-session", (event) => {
    const detail = event.detail || {};
    const userSession = detail.user ? { user: detail.user } : null;
    dreamSyncController.setSession(userSession, detail.client || null);
  });

  window.addEventListener("online", async () => {
    const result = await dreamSyncController.retryPendingRecords();

    if (result.syncedCount > 0) {
      updateJournalSyncStatus(`已同步 ${result.syncedCount} 条本地梦境。`);
    }
  });
}

function showView(viewName) {
  if (viewName === "guided" && !deepGuidanceEnabled) {
    updateGuidedStatus("深度引导正在开发中。");
    return;
  }

  if (viewName === "diary") {
    showDreamJournalList();
  }

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

function applyDeepGuidanceFeatureState() {
  const guidedEntryControls = document.querySelectorAll("[data-feature-flag='deep-guidance']");

  guidedEntryControls.forEach((control) => {
    const status = control.querySelector("[data-feature-status]");
    const disabled = !deepGuidanceEnabled;

    control.disabled = disabled;
    control.setAttribute("aria-disabled", disabled ? "true" : "false");
    control.classList.toggle("is-feature-disabled", disabled);

    if (status) {
      status.hidden = !disabled;
    }
  });
}

applyDeepGuidanceFeatureState();

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.viewTarget === "guided" && !deepGuidanceEnabled) {
      updateGuidedStatus("深度引导正在开发中。");
      return;
    }

    showView(button.dataset.viewTarget);
  });
});

if (!dreamJournalController && dreamJournalNewDreamButton) {
  dreamJournalNewDreamButton.addEventListener("click", () => {
    showView("quick");
  });
}

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

function formatEmotionList(emotions) {
  if (Array.isArray(emotions)) {
    return emotions
      .map((emotion) => {
        if (emotion && typeof emotion === "object") {
          return [emotion.name, emotion.evidence].filter(Boolean).join("：");
        }

        return String(emotion || "").trim();
      })
      .filter(Boolean)
      .join("；");
  }

  return emotions || "";
}

function formatSymbolList(symbols) {
  if (Array.isArray(symbols)) {
    return symbols
      .map((symbol) => {
        if (symbol && typeof symbol === "object") {
          return [symbol.name, symbol.contextMeaning].filter(Boolean).join("：");
        }

        return String(symbol || "").trim();
      })
      .filter(Boolean)
      .join("；");
  }

  return symbols || "";
}

function formatQuestionList(questions) {
  return Array.isArray(questions) ? questions.filter(Boolean).join(" ") : (questions || "");
}

function mapApiQuickDecode(apiResult) {
  return {
    summary: apiResult.summary || apiResult.dreamSummary || "",
    emotion: formatEmotionList(apiResult.emotions || apiResult.coreEmotion),
    symbols: formatSymbolList(apiResult.symbols),
    jungian: apiResult.coreInterpretation || apiResult.jungianInterpretation || "",
    question: formatQuestionList(apiResult.reflectionQuestions),
    reminder: apiResult.gentleReminder || ""
  };
}

async function requestQuickDecode(rawDreamText) {
  const response = await fetch("/api/dream-analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dreamText: rawDreamText,
      analysisType: "quick"
    })
  });

  if (!response.ok) {
    const error = new Error("Dream analysis request failed.");
    error.isValidationError = response.status === 400;
    throw error;
  }

  const data = await response.json();

  if (!data || !data.analysis) {
    throw new Error("Dream analysis response is empty.");
  }

  return {
    ...mapApiQuickDecode(data.analysis),
    dreamResultCard: data.dreamResultCard || null,
    dreamResultCardStatus: data.dreamResultCardStatus || (data.dreamResultCard ? "ai_generated" : "generation_failed")
  };
}

async function requestGuidedQuestions(rawDreamText) {
  const response = await fetch("/api/dream-analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dreamText: rawDreamText,
      analysisType: "guided_questions"
    })
  });

  if (!response.ok) {
    const error = new Error("Guided questions request failed.");
    error.isValidationError = response.status === 400;
    throw error;
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.questions)) {
    throw new Error("Guided questions response is empty.");
  }

  return data.questions;
}

async function requestGuidedFinalReport(rawDreamText, guidedAnswers) {
  const response = await fetch("/api/dream-analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dreamText: rawDreamText,
      analysisType: "guided_final",
      guidedAnswers
    })
  });

  if (!response.ok) {
    const error = new Error("Guided final report request failed.");
    error.isValidationError = response.status === 400;
    throw error;
  }

  const data = await response.json();

  if (!data || !data.analysis) {
    throw new Error("Guided final report response is empty.");
  }

  return {
    ...data.analysis,
    dreamResultCard: data.dreamResultCard || null,
    dreamResultCardStatus: data.dreamResultCardStatus || (data.dreamResultCard ? "ai_generated" : "generation_failed")
  };
}

async function requestDreamResultCard(rawDreamText) {
  const response = await fetch("/api/dream-analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dreamText: rawDreamText,
      analysisType: "result_card"
    })
  });

  if (!response.ok) {
    throw new Error("Dream result card request failed.");
  }

  const data = await response.json();

  if (!data || !data.analysis || typeof data.analysis !== "object") {
    throw new Error("Dream result card response is empty.");
  }

  return data.analysis;
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
    reminder: "这不是诊断、治疗或预言，只是一种自我探索视角。如果梦境让你持续不安，可以考虑寻求可信任的人或专业支持。",
    dreamResultCard: null,
    dreamResultCardStatus: "mock_legacy"
  };
}

function generateGuidedQuestions(rawDreamText) {
  const shortDreamText = getShortDreamText(rawDreamText);

  return [
    {
      id: "emotion",
      label: "情绪",
      question: `回看“${shortDreamText}”时，梦里最强烈的感受是什么？`,
      placeholder: "例如：紧张、平静、困惑、好奇，或一时说不清。"
    },
    {
      id: "association",
      label: "个人联想",
      question: "这个场景、人物或物体让你想到现实中的什么？",
      placeholder: "可以写一个人、地方、颜色、关系，或任何自然冒出的联想。"
    },
    {
      id: "lifeLink",
      label: "现实连接",
      question: "最近有没有类似的压力、关系、变化或选择？",
      placeholder: "只写你愿意记录的部分即可，不需要解释得很完整。"
    },
    {
      id: "agency",
      label: "梦中主动性",
      question: "你在梦里是主动行动，还是被动承受？",
      placeholder: "也可以写：我不确定，或我只是旁观。"
    },
    {
      id: "waking",
      label: "醒后感受",
      question: "醒来后这个梦给你留下什么感觉？",
      placeholder: "例如：胸口紧、松了一口气、还想继续想，或已经淡了。"
    }
  ];
}

function getGuidedAnswer(questionId) {
  return (guidedDraftState.answers[questionId] || "").trim();
}

function formatOptionalAnswer(questionId, fallback) {
  const answer = getGuidedAnswer(questionId);
  return answer || fallback;
}

function generateMockDeepReport(rawDreamText) {
  // TODO: replace this mock deep report with OpenAI or DeepSeek API response through a backend proxy.
  const shortDreamText = getShortDreamText(rawDreamText);
  const possibleSymbols = getPossibleSymbols(rawDreamText);
  const emotionAnswer = formatOptionalAnswer("emotion", "你还没有特别标记某一种情绪，可以先把醒来后的整体身体感受当作线索。");
  const associationAnswer = formatOptionalAnswer("association", "暂时没有写下个人联想时，可以先停留在梦里最清晰的画面上。");
  const lifeLinkAnswer = formatOptionalAnswer("lifeLink", "如果现实连接还不明显，也许可以先观察最近是否有轻微的变化、等待或选择。");
  const agencyAnswer = formatOptionalAnswer("agency", "你还没有记录梦中的主动性，可以回想自己是靠近、躲开、停住，还是旁观。");
  const wakingAnswer = formatOptionalAnswer("waking", "醒后的感受可以稍后再补充，哪怕只是一个词也足够。");

  return {
    summary: `这段梦可以先整理为：“${shortDreamText}”。它不需要被解释成单一答案，更像是一组值得慢慢靠近的画面和感受。`,
    emotionClues: `你记录的情绪线索是：${emotionAnswer} 这可能提示你先关注梦醒后仍残留的感受，而不是急着判断梦的意义。`,
    coreImages: `目前较突出的核心意象也许包括：${possibleSymbols}。你对它们的个人联想是：${associationAnswer} 这些意象可以理解为内在经验的入口。`,
    jungianView: `从温和的荣格视角看，这个梦可能呈现了某个还没有被充分看见的内在部分。这里的“阴影”并不等于坏东西，而是指那些平时较少被表达、但也许正在等待被理解的感受或需求。`,
    lifeConnection: `你写下的现实连接是：${lifeLinkAnswer} 梦中主动性的线索是：${agencyAnswer} 你可以思考它们是否和最近的节奏、关系、压力或选择有轻微呼应。`,
    reflectionQuestions: `你可以带着这些问题再看一遍梦：哪个画面最想被你记住？如果梦里的某个意象会说话，它也许会提醒你什么？醒后感受“${wakingAnswer}”和你最近的生活状态有怎样的细小连接？`,
    smallAction: "今天可以做一个很小的记录动作：用一句话写下梦里最清晰的画面，再写下它带给你的一个感受。这个动作只是帮助你温和地整理自己，不需要得出结论。",
    gentleReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。你可以只保留对自己有帮助的部分；如果梦境让你持续不安，可以考虑和可信任的人或专业支持者谈谈。",
    dreamResultCard: null,
    dreamResultCardStatus: "mock_legacy"
  };
}

function updateGuidedStatus(message) {
  if (guidedStatus) {
    guidedStatus.textContent = message;
  }
}

function updateDeepSaveStatus(message) {
  if (deepSaveStatus) {
    deepSaveStatus.textContent = message;
  }
}

function hideDeepReport() {
  if (deepReport) {
    deepReport.hidden = true;
  }

  deepReportFields.forEach((field) => {
    field.textContent = "";
  });

  if (guidedResultCard) {
    guidedResultCard.textContent = "";
  }

  guidedDraftState.currentReport = null;
  guidedDraftState.savedReportRecordId = "";
  updateDeepSaveStatus("生成报告后，可以把这份深度引导记录保存到本地梦境日记。");
}

function renderGuidedQuestions(questions) {
  if (!guidedQuestionsContainer) {
    return;
  }

  guidedQuestionsContainer.textContent = "";
  guidedQuestionsContainer.hidden = questions.length === 0;

  questions.forEach((question, index) => {
    const card = document.createElement("article");
    const label = document.createElement("span");
    const prompt = document.createElement("p");
    const answerLabel = document.createElement("label");
    const answer = document.createElement("textarea");

    card.className = "guided-question-card";
    label.textContent = `${index + 1}. ${question.label}`;
    prompt.textContent = question.question;
    answerLabel.setAttribute("for", `guidedAnswer-${question.id}`);
    answerLabel.textContent = "你的回答";
    answer.id = `guidedAnswer-${question.id}`;
    answer.rows = 4;
    answer.placeholder = question.placeholder;
    answer.value = guidedDraftState.answers[question.id] || "";
    answer.dataset.guidedAnswer = question.id;

    answer.addEventListener("input", () => {
      guidedDraftState.answers[question.id] = answer.value;
      hideDeepReport();
      updateGuidedStatus("回答已暂存。你可以继续回答，也可以直接生成深度报告；不想回答的问题可以跳过。");
    });

    card.append(label, prompt, answerLabel, answer);
    guidedQuestionsContainer.append(card);
  });
}

function renderDeepReport(report) {
  if (!deepReport) {
    return;
  }

  deepReportFields.forEach((field) => {
    field.textContent = report[field.dataset.deepReportField] || "";
  });

  deepReport.hidden = false;
}

function renderDreamResultCardMount(container, rawDreamText, result, record, options = {}) {
  if (!container || !canUseDreamResultCard || !result) {
    return;
  }

  const controller = options.disableRetrySave
      ? window.DreamResultCard.createDreamResultCardController({
        document,
        generationErrorMessage: "请先保存这份深度报告，再从梦境详情中重新生成画像。",
        requestResultCard: async () => {
          throw new Error("Save the report before retrying result card generation.");
        }
      })
    : dreamResultCardController;

  controller.render(container, {
    ...(record || {}),
    rawDreamText,
    reportContent: {
      ...((record && getReportContent(record)) || {}),
      dreamResultCard: result.dreamResultCard,
      dreamResultCardStatus: result.dreamResultCardStatus
    }
  });
}

function loadLocalDreamRecords() {
  try {
    const savedRecords = localStorage.getItem(dreamJournalStorageKey);
    return savedRecords ? JSON.parse(savedRecords) : [];
  } catch (error) {
    return [];
  }
}

function loadDreamRecords() {
  if (dreamSyncController) {
    return dreamSyncController.getVisibleRecords();
  }

  return loadLocalDreamRecords();
}

function upsertDreamRecordLocally(record) {
  const recordId = String(record.localRecordId || record.local_record_id || record.id || "");
  const records = loadLocalDreamRecords();
  const existingIndex = records.findIndex((item) => {
    const itemId = String(item.localRecordId || item.local_record_id || item.id || "");
    return itemId === recordId;
  });

  if (existingIndex >= 0) {
    records[existingIndex] = {
      ...records[existingIndex],
      ...record
    };
  } else {
    records.unshift(record);
  }

  localStorage.setItem(dreamJournalStorageKey, JSON.stringify(records));
  return records;
}

async function saveDreamRecord(record) {
  if (dreamSyncController) {
    return dreamSyncController.saveRecord(record);
  }

  return {
    records: upsertDreamRecordLocally(record),
    syncStatus: "local"
  };
}

async function saveDreamResultCard(record, card) {
  const updatedRecord = {
    ...record,
    reportContent: {
      ...getReportContent(record),
      dreamResultCard: card
    }
  };
  const saveResult = await saveDreamRecord(updatedRecord);

  renderDreamJournal(saveResult.records);
  return saveResult;
}

function getSaveStatusMessage(syncStatus, prefix) {
  if (syncStatus === "synced") {
    return `${prefix}，并同步到云端梦境日记。`;
  }

  if (syncStatus === "pending_sync") {
    return `${prefix}，已保存在此浏览器；云端同步稍后重试。`;
  }

  return `${prefix}，已保存到本地梦境日记。`;
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

function createDeepDreamRecord(rawDreamText, report) {
  return {
    id: `deep-dream-${Date.now()}`,
    createdAt: new Date().toISOString(),
    rawDreamText,
    dreamSummary: report.summary,
    emotions: report.emotionClues,
    symbols: report.coreImages,
    sleepQuality: "未记录",
    analysisType: "深度引导",
    reportContent: report
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

function normalizeDetailText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function formatDetailValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join("、") || "未记录";
  }

  return normalizeDetailText(value) || "未记录";
}

function getRecordField(record, snakeCaseKey, camelCaseKey) {
  if (!record || typeof record !== "object") {
    return "";
  }

  return record[camelCaseKey] || record[snakeCaseKey] || "";
}

function getReportContent(record) {
  const report = getRecordField(record, "report_content", "reportContent");
  return report && typeof report === "object" ? report : {};
}

function getDreamTitle(record) {
  const rawDreamText = normalizeDetailText(getRecordField(record, "raw_dream_text", "rawDreamText"));

  return normalizeDetailText(record && record.title)
    || normalizeDetailText(getRecordField(record, "dream_summary", "dreamSummary"))
    || (rawDreamText ? getShortDreamText(rawDreamText) : "")
    || "未命名的梦";
}

function formatRecordDateParts(createdAt) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return {
      date: "日期未记录",
      time: "时间未记录"
    };
  }

  return {
    date: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date),
    time: new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date)
  };
}

function createDetailMetaItem(label, value) {
  const item = document.createElement("div");
  const labelNode = document.createElement("span");
  const valueNode = document.createElement("strong");

  labelNode.textContent = label;
  valueNode.textContent = value || "未记录";
  item.append(labelNode, valueNode);

  return item;
}

function createDetailSection(label, value, options = {}) {
  const section = document.createElement("section");
  const title = document.createElement("h4");
  const text = document.createElement("p");

  section.className = "detail-section";
  title.textContent = label;
  text.textContent = options.preserveWhitespace ? (value || "未记录") : formatDetailValue(value);
  section.append(title, text);

  return section;
}

function createAnalysisCard(title, text) {
  const card = document.createElement("details");
  const summary = document.createElement("summary");
  const content = document.createElement("p");

  card.className = "detail-analysis-card";
  summary.textContent = title;
  content.textContent = formatDetailValue(text);
  card.append(summary, content);

  return card;
}

function buildDetailAnalysis(record) {
  const report = getReportContent(record);
  const dreamSummary = formatDetailValue(getRecordField(record, "dream_summary", "dreamSummary"));
  const emotions = formatDetailValue(getRecordField(record, "emotions", "emotions"));
  const symbols = formatDetailValue(getRecordField(record, "symbols", "symbols"));
  const jungText = report.jungianView || report.jungian || report.summary || dreamSummary;
  const freudText = `从弗洛伊德视角，可以温和地留意梦里是否有愿望、担心或未说出口的感受。你可以把“${emotions}”当作线索，而不是结论。`;
  const modernText = `从现代心理学视角，可以先观察梦醒后的情绪和反复出现的意象。“${symbols}”也许和近期注意力、压力或休息状态有关。`;

  return [
    ["荣格", jungText],
    ["弗洛伊德", freudText],
    ["现代心理学", modernText]
  ];
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

function renderFallbackJournalEmptyState() {
  if (!dreamJournalEmpty) {
    return;
  }

  const emptyContent = document.createElement("div");
  const moon = document.createElement("p");
  const title = document.createElement("h3");
  const lineOne = document.createElement("p");
  const lineTwo = document.createElement("p");
  const button = document.createElement("button");

  emptyContent.className = "dream-journal-empty-content";
  moon.className = "dream-journal-empty-mark";
  moon.textContent = "🌙";
  title.textContent = "你还没有记录任何梦。";
  lineOne.textContent = "今天开始，";
  lineTwo.textContent = "把梦轻轻放进梦境档案。";
  button.className = "secondary-button";
  button.type = "button";
  button.textContent = "记录第一个梦";
  button.addEventListener("click", () => {
    showView("quick");
  });

  emptyContent.append(moon, title, lineOne, lineTwo, button);
  dreamJournalEmpty.replaceChildren(emptyContent);
}

function showDreamJournalList() {
  if (journalListShell) {
    journalListShell.hidden = false;
  }

  if (dreamDetail) {
    dreamDetail.hidden = true;
  }
}

function getReportSections(record) {
  const report = record.reportContent || {};

  if (record.analysisType === "深度引导") {
    return [
      ["梦境整理", report.summary],
      ["情绪线索", report.emotionClues],
      ["核心意象", report.coreImages],
      ["荣格式初步解读", report.jungianView],
      ["现实连接", report.lifeConnection],
      ["自我反思问题", report.reflectionQuestions],
      ["温和提醒", report.gentleReminder]
    ];
  }

  return [
    ["梦境整理", report.summary],
    ["核心情绪", report.emotion],
    ["主要象征", report.symbols],
    ["初步荣格解读", report.jungian],
    ["反思问题", report.question],
    ["温和提醒", report.reminder]
  ];
}

function createDetailBlock(label, value) {
  const block = document.createElement("article");
  const title = document.createElement("span");
  const text = document.createElement("p");

  title.textContent = label;
  text.textContent = value || "未记录";
  block.append(title, text);

  return block;
}

function renderDreamDetail(recordId, fallbackRow) {
  if (!dreamDetailContent) {
    return;
  }

  let record = loadDreamRecords().find((item) => item.id === recordId);

  if (!record && fallbackRow) {
    record = window.DreamSync
      && typeof window.DreamSync.mapSupabaseRowToLocalRecord === "function"
      ? window.DreamSync.mapSupabaseRowToLocalRecord(fallbackRow)
      : fallbackRow;
  }
  dreamDetailContent.textContent = "";

  if (!record) {
    const message = document.createElement("div");
    const title = document.createElement("h4");
    const copy = document.createElement("p");

    message.className = "detail-empty-state";
    title.textContent = "没有找到这条梦境记录";
    copy.textContent = "它可能已经被清空，或只保存在另一个浏览器里。你可以返回梦境日记列表继续查看其他记录。";
    message.append(title, copy);
    dreamDetailContent.append(message);
    return;
  }

  const createdAt = getRecordField(record, "created_at", "createdAt");
  const dateParts = formatRecordDateParts(createdAt);
  const rawDreamText = getRecordField(record, "raw_dream_text", "rawDreamText");
  const dreamSummary = getRecordField(record, "dream_summary", "dreamSummary");
  const emotions = getRecordField(record, "emotions", "emotions");
  const symbols = getRecordField(record, "symbols", "symbols");
  const sleepQuality = getRecordField(record, "sleep_quality", "sleepQuality");
  const analysisType = getRecordField(record, "analysis_type", "analysisType");
  const report = getReportContent(record);
  const gentleReminder = report.gentleReminder || report.reminder;
  const hero = document.createElement("header");
  const heroTitle = document.createElement("h3");
  const heroMeta = document.createElement("div");
  const analysisSection = document.createElement("section");
  const analysisTitle = document.createElement("h4");
  const analysisCards = document.createElement("div");
  const reflection = document.createElement("section");
  const reflectionTitle = document.createElement("h4");
  const reflectionCopy = document.createElement("p");
  const dreamResultCard = document.createElement("div");

  hero.className = "detail-hero";
  heroTitle.textContent = getDreamTitle(record);
  heroMeta.className = "detail-hero-meta";
  heroMeta.append(
    createDetailMetaItem("日期", dateParts.date),
    createDetailMetaItem("时间", dateParts.time),
    createDetailMetaItem("分析类型", formatDetailValue(analysisType)),
    createDetailMetaItem("睡眠质量", formatDetailValue(sleepQuality))
  );
  hero.append(heroTitle, heroMeta);

  analysisSection.className = "detail-analysis";
  analysisTitle.textContent = "AI 分析";
  analysisCards.className = "detail-analysis-list";
  buildDetailAnalysis(record).forEach(([title, text]) => {
    analysisCards.append(createAnalysisCard(title, text));
  });
  analysisSection.append(analysisTitle, analysisCards);

  reflection.className = "detail-reflection";
  reflectionTitle.textContent = "自我思考";
  reflectionCopy.textContent = "这里先留给之后的自我思考记录。你可以在下一步功能里慢慢补充自己的理解。";
  reflection.append(reflectionTitle, reflectionCopy);

  dreamResultCard.className = "dream-result-card";
  if (dreamResultCardController) {
    dreamResultCardController.render(dreamResultCard, record);
  }

  dreamDetailContent.append(
    hero,
    createDetailSection("梦境原文", rawDreamText, { preserveWhitespace: true }),
    createDetailSection("梦境摘要", dreamSummary),
    createDetailSection("情绪标签", emotions),
    createDetailSection("梦境意象", symbols),
    createDetailSection("温和提醒", gentleReminder),
    dreamResultCard,
    analysisSection,
    reflection
  );
}

function openDreamDetail(recordId, fallbackRow) {
  if (journalListShell) {
    journalListShell.hidden = true;
  }

  if (dreamDetail) {
    dreamDetail.hidden = false;
  }

  renderDreamDetail(recordId, fallbackRow);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.DreamAnatomyApp = {
  openDreamDetail,
  renderDreamJournal,
  showView
};

function renderDreamJournal(records = loadDreamRecords()) {
  if (!dreamJournalList || !dreamJournalEmpty) {
    return;
  }

  if (dreamJournalController) {
    dreamJournalController.setRecords(records);
    return;
  }

  dreamJournalList.textContent = "";
  dreamJournalEmpty.hidden = records.length > 0;
  renderFallbackJournalEmptyState();

  if (clearJournalButton) {
    clearJournalButton.hidden = records.length === 0;
  }

  records.forEach((record) => {
    const card = document.createElement("article");
    const title = document.createElement("h3");
    const rawDream = document.createElement("p");
    const meta = document.createElement("div");
    const detailButton = document.createElement("button");

    card.className = "journal-card";
    title.textContent = `${record.analysisType || "梦境"}记录`;
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

    detailButton.className = "secondary-button journal-detail-button";
    detailButton.type = "button";
    detailButton.setAttribute("data-record-id", record.id);
    detailButton.textContent = "查看详情";
    detailButton.addEventListener("click", () => {
      openDreamDetail(record.id);
    });

    card.append(title, rawDream, meta, detailButton);
    dreamJournalList.append(card);
  });
}

if (quickForm) {
  quickForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const rawDreamText = quickDream.value.trim();
    const status = quickForm.querySelector(".status");
    const submitButton = quickForm.querySelector("button[type='submit']");

    if (!rawDreamText) {
      if (status) {
        status.textContent = "先写下一点梦境碎片也可以：一个画面、一种情绪，或醒来后还记得的细节。";
      }
      quickDream.focus();
      return;
    }

    if (rawDreamText.length > maxDreamTextLength) {
      if (status) {
        status.textContent = "梦境内容暂时最多 5000 个字符，可以先保留最想解析的片段。";
      }
      quickDream.focus();
      return;
    }

    if (submitButton && submitButton.disabled) {
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    if (status) {
      status.textContent = "正在整理梦境线索……";
    }

    let quickDecode;
    let statusPrefix = "已生成快速解析结果";

    try {
      quickDecode = await requestQuickDecode(rawDreamText);
    } catch (error) {
      if (error.isValidationError) {
        if (status) {
          status.textContent = "梦境内容暂时无法提交，可以检查文字长度后再试。";
        }
        if (submitButton) {
          submitButton.disabled = false;
        }
        return;
      }

      quickDecode = generateMockQuickDecode(rawDreamText);
      statusPrefix = "当前无法连接 AI，已为你展示本地示例结果";
    }

    try {
      const dreamRecord = createDreamRecord(rawDreamText, quickDecode);
      const saveResult = await saveDreamRecord(dreamRecord);
      const savedRecord = saveResult.records.find((record) => String(record.id) === String(dreamRecord.id)) || dreamRecord;

      fillQuickResult(quickDecode);
      quickResult.hidden = false;
      renderDreamResultCardMount(quickResultCard, rawDreamText, quickDecode, savedRecord);
      renderDreamJournal(saveResult.records);
      if (status) {
        status.textContent = getSaveStatusMessage(saveResult.syncStatus, statusPrefix);
      }
    } catch (error) {
      if (status) {
        status.textContent = "已生成快速解析结果，但浏览器暂时无法保存本地记录。";
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });

  quickForm.addEventListener("reset", () => {
    quickResult.hidden = true;
    if (quickResultCard) {
      quickResultCard.textContent = "";
    }
    resultFields.forEach((field) => {
      field.textContent = "";
    });

    const status = quickForm.querySelector(".status");
    if (status) {
      status.textContent = "写下一段梦境碎片后，可以先生成一份本地 mock 的快速解析结果。";
    }
  });
}

if (guidedForm) {
  guidedForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!deepGuidanceEnabled) {
      hideDeepReport();
      renderGuidedQuestions([]);
      if (guidedActions) {
        guidedActions.hidden = true;
      }
      updateGuidedStatus("深度引导正在开发中。");
      return;
    }

    const rawDreamText = guidedDream.value.trim();

    if (!rawDreamText) {
      updateGuidedStatus("先写下一点梦境内容也可以：一个画面、一种情绪，或醒来后还记得的细节。");
      guidedDream.focus();
      return;
    }

    guidedDraftState.rawDreamText = rawDreamText;
    guidedDraftState.answers = {};

    try {
      updateGuidedStatus("正在整理几个适合这次梦境的问题……");
      guidedDraftState.questions = await requestGuidedQuestions(rawDreamText);
    } catch (error) {
      if (error.isValidationError) {
        updateGuidedStatus("梦境内容暂时无法提交，可以检查文字长度后再试。");
        guidedDream.focus();
        return;
      }

      guidedDraftState.questions = generateGuidedQuestions(rawDreamText);
      updateGuidedStatus("当前无法连接 AI，已为你展示本地示例问题。");
    }

    renderGuidedQuestions(guidedDraftState.questions);
    hideDeepReport();
    if (guidedActions) {
      guidedActions.hidden = false;
    }
    if (!guidedStatus || !guidedStatus.textContent.includes("本地示例问题")) {
      updateGuidedStatus("已生成几个温和问题。你可以简单回答，不需要写得很完整；不想回答的问题可以跳过。");
    }
  });

  guidedForm.addEventListener("reset", () => {
    guidedDraftState.rawDreamText = "";
    guidedDraftState.questions = [];
    guidedDraftState.answers = {};
    guidedDraftState.currentReport = null;
    guidedDraftState.savedReportRecordId = "";
    renderGuidedQuestions([]);
    hideDeepReport();
    if (guidedActions) {
      guidedActions.hidden = true;
    }
    updateGuidedStatus("先写下一段梦境，页面会生成几个温和问题帮助你补充细节。");
  });
}

if (generateDeepReportButton) {
  generateDeepReportButton.addEventListener("click", async () => {
    if (!deepGuidanceEnabled) {
      hideDeepReport();
      updateGuidedStatus("深度引导正在开发中。");
      return;
    }

    const rawDreamText = guidedDream.value.trim();

    if (!rawDreamText) {
      hideDeepReport();
      updateGuidedStatus("先写下一点梦境内容，再生成深度报告。一个画面、一种情绪，或醒来后还记得的细节都可以。");
      guidedDream.focus();
      return;
    }

    guidedDraftState.rawDreamText = rawDreamText;

    if (guidedDraftState.questions.length === 0) {
      guidedDraftState.questions = generateGuidedQuestions(rawDreamText);
      renderGuidedQuestions(guidedDraftState.questions);
    }

    let deepReportResult;

    try {
      updateGuidedStatus("正在综合梦境和你的回答……");
      deepReportResult = await requestGuidedFinalReport(rawDreamText, guidedDraftState.answers);
    } catch (error) {
      if (error.isValidationError) {
        hideDeepReport();
        updateGuidedStatus("梦境内容暂时无法提交，可以检查文字长度后再试。");
        guidedDream.focus();
        return;
      }

      guidedDraftState.currentReport = null;
      guidedDraftState.savedReportRecordId = "";
      hideDeepReport();
      renderDreamResultCardMount(guidedResultCard, rawDreamText, {
        dreamResultCardStatus: "generation_failed"
      }, null, {
        disableRetrySave: true
      });
      updateGuidedStatus("当前暂时无法生成深度报告，请稍后重试。你的梦境和回答不会被伪装成本地结果。");
      updateDeepSaveStatus("深度报告生成成功后，才能保存到梦境日记。");
      return;
    }

    guidedDraftState.currentReport = deepReportResult;
    guidedDraftState.savedReportRecordId = "";
    renderDeepReport(deepReportResult);
    renderDreamResultCardMount(guidedResultCard, rawDreamText, deepReportResult, null, {
      disableRetrySave: true
    });

    if (guidedActions) {
      guidedActions.hidden = false;
    }
    updateGuidedStatus("已生成深度报告和梦境画像。");
    updateDeepSaveStatus("可以点击“保存到梦境日记”，把这份深度引导记录保存在当前浏览器里。");
  });
}

if (saveDeepReportButton) {
  saveDeepReportButton.addEventListener("click", async () => {
    if (!deepGuidanceEnabled) {
      updateDeepSaveStatus("深度引导正在开发中，暂时不能创建新的深度引导记录。");
      return;
    }

    if (!guidedDraftState.currentReport) {
      updateDeepSaveStatus("请先生成深度报告，再保存到梦境日记。");
      return;
    }

    if (guidedDraftState.savedReportRecordId) {
      updateDeepSaveStatus("已保存");
      return;
    }

    const rawDreamText = guidedDraftState.rawDreamText || guidedDream.value.trim();
    const deepDreamRecord = createDeepDreamRecord(rawDreamText, guidedDraftState.currentReport);

    try {
      const saveResult = await saveDreamRecord(deepDreamRecord);
      const savedRecord = saveResult.records.find((record) => String(record.id) === String(deepDreamRecord.id)) || deepDreamRecord;
      renderDreamJournal(saveResult.records);
      guidedDraftState.savedReportRecordId = deepDreamRecord.id;
      renderDreamResultCardMount(guidedResultCard, rawDreamText, guidedDraftState.currentReport, savedRecord);
      updateDeepSaveStatus(getSaveStatusMessage(saveResult.syncStatus, "深度报告已保存"));
    } catch (error) {
      updateDeepSaveStatus("这份深度报告已经生成，但浏览器暂时无法保存本地记录。");
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
    showDreamJournalList();
  });
}

if (backToJournalButton) {
  backToJournalButton.addEventListener("click", () => {
    renderDreamJournal();
    showDreamJournalList();
  });
}

renderDreamJournal();
