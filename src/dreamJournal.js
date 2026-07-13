(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(root);
  } else {
    root.DreamJournal = factory(root);
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const defaultTitleLength = 36;
  const groupLabels = [
    "Today",
    "Yesterday",
    "Earlier This Week",
    "Earlier This Month",
    "Older"
  ];

  function getRecordValue(record, snakeCaseKey, camelCaseKey) {
    if (!record || typeof record !== "object") {
      return undefined;
    }

    return record[snakeCaseKey] || record[camelCaseKey];
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  }

  function getDisplayTitle(record, maxLength = defaultTitleLength) {
    const title = normalizeText(record && record.title)
      || normalizeText(getRecordValue(record, "dream_summary", "dreamSummary"))
      || normalizeText(getRecordValue(record, "raw_dream_text", "rawDreamText"))
      || "未命名的梦";
    const length = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : defaultTitleLength;

    return title.length > length ? `${title.slice(0, length)}...` : title;
  }

  function getAnalysisType(record) {
    return getRecordValue(record, "analysis_type", "analysisType") || "";
  }

  function getAnalysisKind(record) {
    const analysisType = getAnalysisType(record);

    if (analysisType === "快速解析" || analysisType === "Quick") {
      return "Quick";
    }

    if (analysisType === "深度引导" || analysisType === "Deep") {
      return "Deep";
    }

    return "Dream";
  }

  function toTextArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    const text = value == null ? "" : String(value).trim();

    if (!text || text === "未记录") {
      return [];
    }

    return text.split(/[、,，]/).map((item) => item.trim()).filter(Boolean);
  }

  function getSymbolList(record, limit = 3) {
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 3;
    return toTextArray(getRecordValue(record, "symbols", "symbols")).slice(0, safeLimit);
  }

  function getEmotionText(record) {
    const value = getRecordValue(record, "emotions", "emotions");

    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean).join("、");
    }

    return normalizeText(value) || "未记录";
  }

  function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
  }

  function getRecordDate(record) {
    const value = getRecordValue(record, "created_at", "createdAt");

    if (!value) {
      return null;
    }

    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }

  function toLocalDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function getLocalDateKey(date) {
    const localDate = toLocalDate(date);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function startOfWeek(date) {
    const localDate = toLocalDate(date);
    const day = localDate.getDay();
    const offset = day === 0 ? 6 : day - 1;
    localDate.setDate(localDate.getDate() - offset);
    return localDate;
  }

  function getDateGroupLabel(date, now) {
    const recordDay = toLocalDate(date);
    const today = toLocalDate(now);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (getLocalDateKey(recordDay) === getLocalDateKey(today)) {
      return "Today";
    }

    if (getLocalDateKey(recordDay) === getLocalDateKey(yesterday)) {
      return "Yesterday";
    }

    if (recordDay >= startOfWeek(today) && recordDay < yesterday) {
      return "Earlier This Week";
    }

    if (
      recordDay.getFullYear() === today.getFullYear()
      && recordDay.getMonth() === today.getMonth()
      && recordDay < startOfWeek(today)
    ) {
      return "Earlier This Month";
    }

    return "Older";
  }

  function sortRecords(records) {
    return (Array.isArray(records) ? records : []).slice().sort((left, right) => {
      const leftDate = getRecordDate(left);
      const rightDate = getRecordDate(right);
      const leftTime = leftDate ? leftDate.getTime() : Number.NEGATIVE_INFINITY;
      const rightTime = rightDate ? rightDate.getTime() : Number.NEGATIVE_INFINITY;

      return rightTime - leftTime;
    });
  }

  function groupRecordsByDate(records, now = new Date()) {
    const groups = new Map(groupLabels.map((label) => [label, []]));

    sortRecords(records).forEach((record) => {
      const recordDate = getRecordDate(record);
      const label = recordDate && isValidDate(now) ? getDateGroupLabel(recordDate, now) : "Older";
      groups.get(label).push(record);
    });

    return groupLabels
      .map((label) => ({ label, records: groups.get(label) }))
      .filter((group) => group.records.length > 0);
  }

  function getSearchText(record) {
    return [
      getDisplayTitle(record, Number.MAX_SAFE_INTEGER),
      getRecordValue(record, "raw_dream_text", "rawDreamText"),
      getRecordValue(record, "dream_summary", "dreamSummary"),
      getEmotionText(record),
      getSymbolList(record, Number.MAX_SAFE_INTEGER).join(" ")
    ].map((value) => String(value || "").toLowerCase()).join(" ");
  }

  function matchesFilter(record, filter) {
    const normalizedFilter = normalizeText(filter).toLowerCase();

    if (!normalizedFilter || normalizedFilter === "all" || normalizedFilter === "全部") {
      return true;
    }

    if (normalizedFilter === "quick") {
      return getAnalysisKind(record) === "Quick";
    }

    if (normalizedFilter === "deep") {
      return getAnalysisKind(record) === "Deep";
    }

    if (normalizedFilter === "pending" || normalizedFilter === "pending sync") {
      return getRecordValue(record, "sync_status", "syncStatus") === "pending_sync";
    }

    return true;
  }

  function filterRecords(records, state = {}) {
    const query = normalizeText(state.query || "").toLowerCase();
    const filter = state.filter || "all";

    return sortRecords(records).filter((record) => {
      return matchesFilter(record, filter)
        && (!query || getSearchText(record).includes(query));
    });
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value == null ? "" : String(value);
    }
  }

  function setHidden(element, hidden) {
    if (element) {
      element.hidden = Boolean(hidden);
    }
  }

  function replaceChildren(element, ...children) {
    if (element && typeof element.replaceChildren === "function") {
      element.replaceChildren(...children);
    }
  }

  function createElement(documentRef, tagName, className, text) {
    const element = documentRef.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function getRecordId(record) {
    return String(record.localRecordId || record.local_record_id || record.id || "");
  }

  function formatRecordDate(record) {
    const date = getRecordDate(record);

    if (!date) {
      return "日期未记录";
    }

    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function createEmptyState(documentRef, onNewDream) {
    const empty = createElement(documentRef, "div", "dream-journal-empty-content");
    const moon = createElement(documentRef, "p", "dream-journal-empty-mark", "🌙");
    const title = createElement(documentRef, "h3", "", "你还没有记录任何梦。");
    const lineOne = createElement(documentRef, "p", "", "今天开始，");
    const lineTwo = createElement(documentRef, "p", "", "把梦轻轻放进梦境档案。");
    const button = createElement(documentRef, "button", "secondary-button", "记录第一个梦");

    button.type = "button";
    button.addEventListener("click", onNewDream);
    empty.append(moon, title, lineOne, lineTwo, button);

    return empty;
  }

  function createBadge(documentRef, text, className) {
    const badge = createElement(documentRef, "span", className || "dream-journal-badge", text);
    return badge;
  }

  function createRecordCard(documentRef, record, onOpenDetail) {
    const card = createElement(documentRef, "article", "dream-journal-record-card");
    const action = createElement(documentRef, "button", "dream-journal-record-action");
    const heading = createElement(documentRef, "div", "dream-journal-record-heading");
    const title = createElement(documentRef, "h3", "", getDisplayTitle(record));
    const date = createElement(documentRef, "time", "", formatRecordDate(record));
    const badges = createElement(documentRef, "div", "dream-journal-card-badges");
    const summary = createElement(
      documentRef,
      "p",
      "dream-journal-record-summary",
      normalizeText(getRecordValue(record, "raw_dream_text", "rawDreamText"))
        || normalizeText(getRecordValue(record, "dream_summary", "dreamSummary"))
        || "梦境内容未记录"
    );
    const meta = createElement(documentRef, "div", "dream-journal-record-meta");
    const emotion = createElement(documentRef, "span", "", `Emotion: ${getEmotionText(record)}`);
    const symbols = getSymbolList(record);
    const symbolText = symbols.length > 0 ? symbols.join("、") : "未记录";
    const symbolNode = createElement(documentRef, "span", "", `Symbols: ${symbolText}`);

    action.type = "button";
    action.addEventListener("click", () => {
      onOpenDetail(record);
    });

    badges.append(createBadge(documentRef, getAnalysisKind(record), "dream-journal-kind-badge"));

    if (getRecordValue(record, "sync_status", "syncStatus") === "pending_sync") {
      badges.append(createBadge(documentRef, "Pending Sync", "dream-journal-sync-badge"));
    }

    heading.append(title, date);
    meta.append(emotion, symbolNode);
    action.append(heading, badges, summary, meta);
    card.append(action);

    return card;
  }

  function createGroupSection(documentRef, group, onOpenDetail) {
    const section = createElement(documentRef, "section", "dream-journal-group");
    const title = createElement(documentRef, "h3", "dream-journal-group-title", group.label);
    const records = createElement(documentRef, "div", "dream-journal-group-list");

    group.records.forEach((record) => {
      records.append(createRecordCard(documentRef, record, onOpenDetail));
    });

    section.append(title, records);
    return section;
  }

  function createDreamJournalController(options = {}) {
    const documentRef = options.document;
    const elements = options.elements || {};
    const app = options.app || {};
    const now = options.now || (() => new Date());
    const state = {
      filter: "全部",
      isLoading: false,
      query: "",
      records: []
    };

    function openNewDream() {
      if (typeof app.showView === "function") {
        app.showView("quick");
      }
    }

    function openDetail(record) {
      if (typeof app.openDreamDetail === "function") {
        app.openDreamDetail(getRecordId(record), record);
      }
    }

    function renderEmptyState() {
      if (!elements.empty || !documentRef) {
        return;
      }

      replaceChildren(elements.empty, createEmptyState(documentRef, openNewDream));
    }

    function render() {
      if (!documentRef) {
        return [];
      }

      setText(elements.loading, state.isLoading ? "正在整理你的梦境档案……" : "");

      if (state.isLoading) {
        setHidden(elements.empty, true);
        replaceChildren(elements.list);
        return [];
      }

      const visibleRecords = filterRecords(state.records, state);
      const groupedRecords = groupRecordsByDate(visibleRecords, now());
      const sections = groupedRecords.map((group) => createGroupSection(documentRef, group, openDetail));

      replaceChildren(elements.list, ...sections);
      renderEmptyState();
      setHidden(elements.empty, visibleRecords.length > 0);

      return visibleRecords;
    }

    function setRecords(records) {
      state.records = Array.isArray(records) ? records : [];
      state.isLoading = false;
      return render();
    }

    function setLoading(isLoading) {
      state.isLoading = Boolean(isLoading);
      return render();
    }

    function setQuery(query) {
      state.query = query || "";
      return render();
    }

    function setFilter(filter) {
      state.filter = filter || "全部";
      if (Array.isArray(elements.filters)) {
        elements.filters.forEach((button) => {
          const value = button.dataset ? button.dataset.journalFilter : "";
          button.classList.toggle("is-current", value === state.filter);
        });
      }
      return render();
    }

    function clear() {
      state.records = [];
      state.query = "";
      state.filter = "全部";
      state.isLoading = false;
      if (elements.searchInput) {
        elements.searchInput.value = "";
      }
      if (Array.isArray(elements.filters)) {
        elements.filters.forEach((button) => {
          const value = button.dataset ? button.dataset.journalFilter : "";
          button.classList.toggle("is-current", value === state.filter);
        });
      }
      return render();
    }

    if (elements.searchInput && typeof elements.searchInput.addEventListener === "function") {
      elements.searchInput.addEventListener("input", () => {
        setQuery(elements.searchInput.value);
      });
    }

    if (Array.isArray(elements.filters)) {
      elements.filters.forEach((button) => {
        if (button && typeof button.addEventListener === "function") {
          button.addEventListener("click", () => {
            setFilter(button.dataset ? button.dataset.journalFilter : "全部");
          });
        }
      });
    }

    if (elements.newDreamButton && typeof elements.newDreamButton.addEventListener === "function") {
      elements.newDreamButton.addEventListener("click", openNewDream);
    }

    render();

    return {
      clear,
      render,
      setFilter,
      setLoading,
      setQuery,
      setRecords
    };
  }

  return {
    createDreamJournalController,
    filterRecords,
    getAnalysisKind,
    getDisplayTitle,
    getEmotionText,
    getSearchText,
    getSymbolList,
    groupRecordsByDate
  };
});
