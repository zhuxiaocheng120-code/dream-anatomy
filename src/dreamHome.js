(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(root);
  } else {
    root.DreamHome = factory(root);
  }
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  const defaultTitleLength = 36;

  function getGreeting(date) {
    const hour = date.getHours();

    if (hour >= 5 && hour < 12) {
      return "早上好";
    }

    if (hour >= 12 && hour < 18) {
      return "下午好";
    }

    return "晚上好";
  }

  function getRecordValue(record, snakeCaseKey, camelCaseKey) {
    if (!record || typeof record !== "object") {
      return undefined;
    }

    return record[snakeCaseKey] || record[camelCaseKey];
  }

  function normalizeTitle(value) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  }

  function getDisplayTitle(record, maxLength = defaultTitleLength) {
    const title = normalizeTitle(record && record.title)
      || normalizeTitle(getRecordValue(record, "dream_summary", "dreamSummary"))
      || normalizeTitle(getRecordValue(record, "raw_dream_text", "rawDreamText"))
      || "未命名的梦";
    const length = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : defaultTitleLength;

    return title.length > length ? `${title.slice(0, length)}...` : title;
  }

  function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
  }

  function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getRecordDate(record) {
    const value = getRecordValue(record, "created_at", "createdAt");

    if (!value) {
      return null;
    }

    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }

  function calculateDreamStreak(records, now) {
    if (!Array.isArray(records) || !isValidDate(now)) {
      return 0;
    }

    const recordDates = new Set();

    records.forEach((record) => {
      const recordDate = getRecordDate(record);

      if (recordDate) {
        recordDates.add(toLocalDateKey(recordDate));
      }
    });

    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (!recordDates.has(toLocalDateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    let streak = 0;

    while (recordDates.has(toLocalDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }

  function calculateDreamStats(records, now) {
    const safeRecords = Array.isArray(records) ? records : [];
    const aiOrganized = safeRecords.filter((record) => {
      const analysisType = getRecordValue(record, "analysis_type", "analysisType");
      return analysisType === "快速解析" || analysisType === "深度引导";
    }).length;

    return {
      total: safeRecords.length,
      important: 0,
      streak: calculateDreamStreak(safeRecords, now),
      aiOrganized
    };
  }

  function getRecentDreams(records, limit = 5) {
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 5;

    return (Array.isArray(records) ? records : [])
      .slice()
      .sort((left, right) => {
        const leftDate = getRecordDate(left);
        const rightDate = getRecordDate(right);
        const leftTime = leftDate ? leftDate.getTime() : Number.NEGATIVE_INFINITY;
        const rightTime = rightDate ? rightDate.getTime() : Number.NEGATIVE_INFINITY;

        return rightTime - leftTime;
      })
      .slice(0, safeLimit);
  }

  async function fetchDreamRecords(client, user) {
    if (!client || !user || !user.id) {
      return [];
    }

    const response = await client
      .from("dream_records")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (response.error) {
      throw new Error("Dream Home records unavailable");
    }

    return Array.isArray(response.data) ? response.data : [];
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value == null ? "" : String(value);
    }
  }

  function setHidden(element, hidden) {
    if (element) {
      element.hidden = hidden;
    }
  }

  function replaceChildren(element, ...children) {
    if (element && typeof element.replaceChildren === "function") {
      element.replaceChildren(...children);
    }
  }

  function getElement(elements, name) {
    return elements[name] || (elements.stats && elements.stats[name]) || null;
  }

  function createDreamHomeController(options = {}) {
    const elements = options.elements || {};
    const app = options.app || {};
    const documentRef = options.document || (root && root.document);
    const fetchRecords = options.fetchRecords || fetchDreamRecords;
    const now = options.now || (() => new Date());
    const quotes = options.quotes || (root && root.DreamQuotes);
    let activeUser = null;
    let activeClient = null;
    let records = [];
    let requestGeneration = 0;

    function clearRecordData() {
      records = [];
      setText(elements.greeting, "");
      setText(elements.email, "");
      setText(elements.quoteText, "");
      setText(elements.quoteAuthor, "");
      setText(getElement(elements, "total"), "");
      setText(getElement(elements, "important"), "");
      setText(getElement(elements, "streak"), "");
      setText(getElement(elements, "aiOrganized"), "");
      setText(elements.status, "");
      replaceChildren(elements.recent);
      setHidden(elements.retry, true);
    }

    function showHome(isAuthenticated) {
      setHidden(elements.publicHome, isAuthenticated);
      setHidden(elements.dreamHome, !isAuthenticated);

      if (typeof app.showView === "function") {
        app.showView("home");
      }
    }

    function renderQuote(date) {
      const quote = quotes && typeof quotes.getQuoteForDate === "function"
        ? quotes.getQuoteForDate(date)
        : null;

      setText(elements.quoteText, quote && quote.text);
      setText(elements.quoteAuthor, quote && quote.author);
    }

    function openRecentDream(recordId) {
      if (typeof app.showView === "function") {
        app.showView("diary");
      }

      if (typeof app.openDreamDetail === "function") {
        app.openDreamDetail(recordId);
      }
    }

    function renderRecentDreams() {
      if (!elements.recent || !documentRef || typeof documentRef.createElement !== "function") {
        return;
      }

      const recentRows = getRecentDreams(records).map((record) => {
        const row = documentRef.createElement("button");
        row.type = "button";
        row.textContent = getDisplayTitle(record);
        row.addEventListener("click", () => openRecentDream(
          record.local_record_id || record.localRecordId || record.id
        ));
        return row;
      });

      replaceChildren(elements.recent, ...recentRows);
    }

    function renderRecordData() {
      const stats = calculateDreamStats(records, now());
      setText(getElement(elements, "total"), stats.total);
      setText(getElement(elements, "important"), stats.important);
      setText(getElement(elements, "streak"), stats.streak);
      setText(getElement(elements, "aiOrganized"), stats.aiOrganized);
      renderRecentDreams();
      setText(elements.status, records.length === 0 ? "第一条被保存的梦会在这里出现。" : "");
      setHidden(elements.retry, true);
    }

    async function handleSession(session = {}) {
      requestGeneration += 1;
      const generation = requestGeneration;
      clearRecordData();
      activeUser = session.user && session.user.id ? session.user : null;
      activeClient = session.client || null;

      if (!activeUser) {
        showHome(false);
        return [];
      }

      const userId = activeUser.id;
      showHome(true);
      setText(elements.greeting, getGreeting(now()));
      setText(elements.email, activeUser.email || "");
      renderQuote(now());
      setText(elements.status, "正在整理你的梦境档案……");

      try {
        const loadedRecords = await fetchRecords(activeClient, activeUser);

        if (generation !== requestGeneration || !activeUser || activeUser.id !== userId) {
          return [];
        }

        records = Array.isArray(loadedRecords) ? loadedRecords : [];
        renderRecordData();
        return records;
      } catch (error) {
        if (generation !== requestGeneration || !activeUser || activeUser.id !== userId) {
          return [];
        }

        setText(elements.status, "暂时无法整理云端梦境，请稍后重试。");
        setHidden(elements.retry, false);
        return [];
      }
    }

    function clear() {
      return handleSession({ client: null, user: null });
    }

    function init(session) {
      return handleSession(session || { client: null, user: null });
    }

    function retry() {
      if (!activeUser) {
        return Promise.resolve([]);
      }

      return handleSession({ client: activeClient, user: activeUser });
    }

    if (elements.retry && typeof elements.retry.addEventListener === "function") {
      elements.retry.addEventListener("click", () => {
        retry();
      });
    }

    [
      [elements.quickAction, "quick"],
      [elements.guidedAction, "guided"],
      [elements.diaryAction, "diary"]
    ].forEach(([element, viewName]) => {
      if (element && typeof element.addEventListener === "function") {
        element.addEventListener("click", () => {
          if (typeof app.showView === "function") {
            app.showView(viewName);
          }
        });
      }
    });

    return { clear, handleSession, init, retry };
  }

  function collectBrowserElements(documentRef) {
    return {
      publicHome: documentRef.querySelector("[data-public-home]"),
      dreamHome: documentRef.querySelector("[data-dream-home]"),
      greeting: documentRef.querySelector("[data-dream-home-greeting]"),
      email: documentRef.querySelector("[data-dream-home-email]"),
      quoteText: documentRef.querySelector("[data-dream-home-quote-text]"),
      quoteAuthor: documentRef.querySelector("[data-dream-home-quote-author]"),
      total: documentRef.querySelector("[data-dream-home-stat='total']"),
      important: documentRef.querySelector("[data-dream-home-stat='important']"),
      streak: documentRef.querySelector("[data-dream-home-stat='streak']"),
      aiOrganized: documentRef.querySelector("[data-dream-home-stat='ai-organized']"),
      recent: documentRef.querySelector("[data-dream-home-recent]"),
      status: documentRef.querySelector("[data-dream-home-status]"),
      retry: documentRef.querySelector("[data-dream-home-retry]"),
      quickAction: documentRef.querySelector("[data-dream-home-action='quick']"),
      guidedAction: documentRef.querySelector("[data-dream-home-action='guided']"),
      diaryAction: documentRef.querySelector("[data-dream-home-action='diary']")
    };
  }

  function initializeBrowserDreamHome() {
    if (!root || !root.document || !root.addEventListener) {
      return;
    }

    const elements = collectBrowserElements(root.document);

    if (!elements.dreamHome) {
      return;
    }

    const controller = createDreamHomeController({
      app: root.DreamAnatomyApp,
      document: root.document,
      elements,
      quotes: root.DreamQuotes
    });

    api.controller = controller;
    controller.init();
    root.addEventListener("dream-anatomy-auth-session", (event) => {
      controller.handleSession({
        user: event.detail && event.detail.user ? event.detail.user : null,
        client: event.detail ? event.detail.client : null
      });
    });
  }

  const api = {
    calculateDreamStats,
    calculateDreamStreak,
    createDreamHomeController,
    fetchDreamRecords,
    getDisplayTitle,
    getGreeting,
    getRecentDreams
  };

  if (root && root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", initializeBrowserDreamHome);
    } else {
      initializeBrowserDreamHome();
    }
  }

  return api;
});
