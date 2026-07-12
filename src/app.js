const viewPanels = document.querySelectorAll("[data-view]");
const viewButtons = document.querySelectorAll("[data-view-target]");
const quickForm = document.querySelector("[data-quick-form]");
const quickDream = document.querySelector("#quickDream");
const quickResult = document.querySelector("#quickResult");
const resultFields = document.querySelectorAll("[data-result-field]");
const journalListShell = document.querySelector("[data-journal-list-shell]");
const dreamJournalList = document.querySelector("#dreamJournalList");
const dreamJournalEmpty = document.querySelector("#dreamJournalEmpty");
const clearJournalButton = document.querySelector("[data-clear-journal]");
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
const saveDeepReportButton = document.querySelector("[data-save-deep-report]");
const deepSaveStatus = document.querySelector("[data-deep-save-status]");
const dreamJournalStorageKey = "dreamAnatomy.quickDecodeRecords";
const maxDreamTextLength = 5000;
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

function mapApiQuickDecode(apiResult) {
  return {
    summary: apiResult.dreamSummary,
    emotion: apiResult.coreEmotion,
    symbols: Array.isArray(apiResult.symbols) ? apiResult.symbols.join("、") : "",
    jungian: apiResult.jungianInterpretation,
    question: Array.isArray(apiResult.reflectionQuestions) ? apiResult.reflectionQuestions.join(" ") : "",
    reminder: apiResult.gentleReminder
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

  return mapApiQuickDecode(data.analysis);
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
    gentleReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。你可以只保留对自己有帮助的部分；如果梦境让你持续不安，可以考虑和可信任的人或专业支持者谈谈。"
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

function saveDreamRecordLocally(record) {
  const records = [record, ...loadLocalDreamRecords()];
  localStorage.setItem(dreamJournalStorageKey, JSON.stringify(records));
  return records;
}

async function saveDreamRecord(record) {
  if (dreamSyncController) {
    return dreamSyncController.saveRecord(record);
  }

  return {
    records: saveDreamRecordLocally(record),
    syncStatus: "local"
  };
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

function createJournalMeta(label, value) {
  const item = document.createElement("div");
  const labelNode = document.createElement("span");
  const valueNode = document.createElement("strong");

  labelNode.textContent = label;
  valueNode.textContent = value;
  item.append(labelNode, valueNode);

  return item;
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

  const overview = document.createElement("div");
  const reportSection = document.createElement("section");
  const reportTitle = document.createElement("h4");
  const reportGrid = document.createElement("div");

  overview.className = "detail-overview";
  overview.append(
    createDetailBlock("日期", formatRecordDate(record.createdAt)),
    createDetailBlock("分析类型", record.analysisType),
    createDetailBlock("原始梦境文本", record.rawDreamText),
    createDetailBlock("梦境摘要", record.dreamSummary),
    createDetailBlock("主要情绪", record.emotions),
    createDetailBlock("主要意象", record.symbols),
    createDetailBlock("睡眠质量", record.sleepQuality)
  );

  reportSection.className = "detail-report";
  reportTitle.textContent = "分析内容";
  reportGrid.className = "detail-report-grid";

  getReportSections(record).forEach(([label, value]) => {
    reportGrid.append(createDetailBlock(label, value));
  });

  reportSection.append(reportTitle, reportGrid);
  dreamDetailContent.append(overview, reportSection);
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
  showView
};

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

      fillQuickResult(quickDecode);
      quickResult.hidden = false;
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
  guidedForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const rawDreamText = guidedDream.value.trim();

    if (!rawDreamText) {
      updateGuidedStatus("先写下一点梦境内容也可以：一个画面、一种情绪，或醒来后还记得的细节。");
      guidedDream.focus();
      return;
    }

    guidedDraftState.rawDreamText = rawDreamText;
    guidedDraftState.questions = generateGuidedQuestions(rawDreamText);
    guidedDraftState.answers = {};

    renderGuidedQuestions(guidedDraftState.questions);
    hideDeepReport();
    if (guidedActions) {
      guidedActions.hidden = false;
    }
    updateGuidedStatus("已生成 5 个温和问题。你可以简单回答，不需要写得很完整；不想回答的问题可以跳过。");
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
  generateDeepReportButton.addEventListener("click", () => {
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

    const deepReportResult = generateMockDeepReport(rawDreamText);
    guidedDraftState.currentReport = deepReportResult;
    guidedDraftState.savedReportRecordId = "";
    renderDeepReport(deepReportResult);

    if (guidedActions) {
      guidedActions.hidden = false;
    }
    updateGuidedStatus("已生成本地 mock 深度报告。当前不会发送到服务器。");
    updateDeepSaveStatus("可以点击“保存到梦境日记”，把这份深度引导记录保存在当前浏览器里。");
  });
}

if (saveDeepReportButton) {
  saveDeepReportButton.addEventListener("click", async () => {
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
      renderDreamJournal(saveResult.records);
      guidedDraftState.savedReportRecordId = deepDreamRecord.id;
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
