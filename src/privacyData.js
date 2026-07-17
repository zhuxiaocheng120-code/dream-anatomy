(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamPrivacyData = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const guestConsentKey = "dreamAnatomy.legalConsent.guest";
  const clearAllConfirmation = "清空全部梦境";
  const deleteAccountConfirmation = "注销账户";

  function createElement(documentRef, tagName, className, textContent) {
    const element = documentRef.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (textContent !== undefined) {
      element.textContent = textContent;
    }
    return element;
  }

  function getRecordValue(record, camelKey, snakeKey, fallback = "") {
    return record && (record[camelKey] !== undefined ? record[camelKey] : record[snakeKey]) || fallback;
  }

  function getRecordId(record) {
    return String(
      getRecordValue(record, "id", "id")
        || getRecordValue(record, "localRecordId", "local_record_id")
        || getRecordValue(record, "cloudId", "cloud_id")
        || ""
    );
  }

  function getTodayString() {
    return new Date().toISOString().slice(0, 10);
  }

  function safeParseJson(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function versionsMatch(savedVersions, currentVersions) {
    return Boolean(
      savedVersions
        && savedVersions.privacyPolicyVersion === currentVersions.privacyPolicyVersion
        && savedVersions.termsVersion === currentVersions.termsVersion
        && savedVersions.aiDisclaimerVersion === currentVersions.aiDisclaimerVersion
    );
  }

  function sanitizeExportRecord(record) {
    const recordId = getRecordId(record);
    return {
      recordIdHint: recordId ? recordId.slice(-8) : "",
      createdAt: getRecordValue(record, "createdAt", "created_at"),
      rawDreamText: getRecordValue(record, "rawDreamText", "raw_dream_text"),
      dreamSummary: getRecordValue(record, "dreamSummary", "dream_summary"),
      sleepQuality: getRecordValue(record, "sleepQuality", "sleep_quality", "未记录"),
      emotions: getRecordValue(record, "emotions", "emotions", []),
      symbols: getRecordValue(record, "symbols", "symbols", []),
      analysisType: getRecordValue(record, "analysisType", "analysis_type"),
      reportContent: getRecordValue(record, "reportContent", "report_content", {})
    };
  }

  function defaultConfirmAction() {
    return Promise.resolve(false);
  }

  function createElementConfirmAction(elements) {
    if (!elements.confirmShell || !elements.confirmSubmit || !elements.confirmCancel) {
      return defaultConfirmAction;
    }

    return function confirmWithElements(request) {
      return new Promise((resolve) => {
        const hasRequiredText = Boolean(request.requiredText);

        if (elements.confirmTitle) {
          elements.confirmTitle.textContent = request.title || "请确认";
        }
        if (elements.confirmBody) {
          elements.confirmBody.textContent = request.body || "";
        }
        if (elements.confirmInput) {
          elements.confirmInput.value = "";
          elements.confirmInput.hidden = !hasRequiredText;
          elements.confirmInput.placeholder = hasRequiredText ? request.requiredText : "";
        }

        elements.confirmShell.hidden = false;

        const cleanup = (value) => {
          elements.confirmShell.hidden = true;
          elements.confirmSubmit.onclick = null;
          elements.confirmCancel.onclick = null;
          resolve(value);
        };

        elements.confirmCancel.onclick = () => cleanup(false);
        elements.confirmSubmit.onclick = () => {
          if (hasRequiredText) {
            cleanup(elements.confirmInput ? elements.confirmInput.value.trim() : "");
            return;
          }

          cleanup(true);
        };
      });
    };
  }

  async function defaultFetchJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data && data.error && data.error.message ? data.error.message : "请求没有完成。");
      error.status = response.status;
      error.code = data && data.error ? data.error.code : "";
      throw error;
    }

    return data;
  }

  function defaultDownloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function createPrivacyDataController(options) {
    const documentRef = options.document || document;
    const elements = options.elements || {};
    const legalDocuments = options.legalDocuments;
    const runtimeEnv = options.runtimeEnv || {};
    const storage = options.storage || localStorage;
    const dreamSync = options.dreamSync;
    const auth = options.auth || {};
    const app = options.app || {};
    const confirmAction = options.confirmAction || createElementConfirmAction(elements);
    const downloadJson = options.downloadJson || defaultDownloadJson;
    const fetchJson = options.fetchJson || defaultFetchJson;
    let currentUser = dreamSync && typeof dreamSync.getCurrentUser === "function"
      ? dreamSync.getCurrentUser()
      : null;
    let currentClient = null;
    let currentConsent = null;
    let lastConsentCheckUserId = "";
    let guestCleanupCard = null;

    function setStatus(message) {
      if (elements.status) {
        elements.status.textContent = message || "";
      }
    }

    function getCurrentVersions() {
      return legalDocuments.getLegalVersions();
    }

    function hasAcceptedCurrentVersions(consentRow) {
      return legalDocuments.hasAcceptedVersions(consentRow);
    }

    async function loadCurrentConsent(user, client) {
      if (!user || !client || typeof client.from !== "function") {
        currentConsent = null;
        return null;
      }

      const response = await client
        .from("legal_consents")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (response.error) {
        throw response.error;
      }

      currentConsent = response.data || null;
      lastConsentCheckUserId = user.id;

      if (!hasAcceptedCurrentVersions(currentConsent)) {
        setStatus("请确认最新版本的用户协议、隐私政策和 AI 使用说明。");
      }

      return currentConsent;
    }

    function renderLegalLinkList(parent) {
      const list = createElement(documentRef, "div", "privacy-legal-links");
      [
        ["privacy", "隐私政策"],
        ["terms", "用户协议"],
        ["ai", "AI 使用说明"]
      ].forEach(([type, label]) => {
        const button = createElement(documentRef, "button", "text-button", label);
        button.type = "button";
        button.dataset.legalDocument = type;
        button.addEventListener("click", () => openLegalDocument(type));
        list.append(button);
      });
      parent.append(list);
    }

    function renderAction(parent, title, body, buttonText, actionName, danger) {
      const card = createElement(documentRef, "article", danger ? "privacy-action-card danger-zone" : "privacy-action-card");
      const heading = createElement(documentRef, "h3", "", title);
      const copy = createElement(documentRef, "p", "", body);
      const button = createElement(documentRef, "button", danger ? "danger-button" : "secondary-button", buttonText);
      button.type = "button";
      button.dataset.privacyAction = actionName;
      card.append(heading, copy, button);
      parent.append(card);
      return button;
    }

    function updateGuestCleanupVisibility() {
      if (guestCleanupCard) {
        guestCleanupCard.hidden = Boolean(currentUser);
      }
    }

    function render() {
      if (!elements.view) {
        return;
      }

      const heading = createElement(documentRef, "div", "panel-copy");
      const eyebrow = createElement(documentRef, "p", "eyebrow", "Privacy & Data");
      const title = createElement(documentRef, "h2", "", "隐私与数据");
      const summary = createElement(documentRef, "p", "summary", "管理法律文件确认、梦境导出、梦境删除和账户数据。");
      heading.append(eyebrow, title, summary);
      if (elements.status) {
        heading.append(elements.status);
      }
      renderLegalLinkList(heading);

      const actions = createElement(documentRef, "div", "privacy-action-grid");
      const acceptButton = renderAction(actions, "确认当前法律文件", "确认你已阅读当前版本的用户协议、隐私政策和 AI 使用说明。", "确认当前版本", "accept-legal", false);
      const exportButton = renderAction(actions, "导出我的数据", "导出当前账户或本机游客的梦境记录，不包含 token、邮箱或管理员统计。", "导出我的数据", "export", false);
      const clearButton = renderAction(actions, "清空全部梦境", "删除当前账户的全部梦境记录；游客状态下只清理本机游客记录。", "清空全部梦境", "clear", true);
      const guestButton = renderAction(actions, "清除本机梦境数据", "游客可以清除当前浏览器中的本机梦境数据。", "清除本机梦境数据", "clear-guest", true);
      const accountButton = renderAction(actions, "注销账户", "注销会删除当前账户的云端梦境、法律同意记录和可关联的 authenticated AI 使用统计。", "注销账户", "delete-account", true);

      acceptButton.addEventListener("click", () => {
        acceptCurrentLegalVersions().catch(() => {
          setStatus("确认暂时没有保存成功，请稍后再试。");
        });
      });
      exportButton.addEventListener("click", () => exportData());
      clearButton.addEventListener("click", () => clearAllDreams());
      guestButton.addEventListener("click", () => clearAllDreams());
      accountButton.addEventListener("click", () => deleteAccount());
      guestCleanupCard = guestButton.parentNode || actions.children[3] || null;
      updateGuestCleanupVisibility();

      const documentShell = elements.documentShell || createElement(documentRef, "div", "legal-document-shell");
      elements.view.replaceChildren(heading, actions, documentShell);
    }

    function openLegalDocument(type) {
      if (!elements.documentShell || !legalDocuments) {
        return;
      }

      const documentData = legalDocuments.getLegalDocument(type, runtimeEnv);
      const container = createElement(documentRef, "article", "legal-document");
      const title = createElement(documentRef, "h3", "", documentData.title);
      const version = createElement(documentRef, "p", "legal-version", `版本：${documentData.version}`);
      const note = createElement(documentRef, "p", "legal-note", documentData.note);
      container.append(title, version, note);

      documentData.sections.forEach((section) => {
        const sectionElement = createElement(documentRef, "section", "legal-section");
        const heading = createElement(documentRef, "h4", "", section.heading);
        sectionElement.append(heading);
        section.body.forEach((paragraph) => {
          sectionElement.append(createElement(documentRef, "p", "", paragraph));
        });
        container.append(sectionElement);
      });

      elements.documentShell.replaceChildren(container);
    }

    async function ensureGuestAiConsent() {
      if (currentUser) {
        return true;
      }

      const versions = getCurrentVersions();
      const saved = safeParseJson(storage.getItem(guestConsentKey), null);
      if (versionsMatch(saved, versions)) {
        return true;
      }

      const confirmed = await confirmAction({
        title: "AI 使用说明",
        body: "第一次使用 AI 解析前，请确认你已阅读并理解用户协议、隐私政策和 AI 使用说明。",
        confirmText: "我已阅读并同意"
      });

      if (!confirmed) {
        setStatus("请先确认用户协议、隐私政策和 AI 使用说明。");
        return false;
      }

      storage.setItem(guestConsentKey, JSON.stringify(versions));
      return true;
    }

    function validateRegistrationConsent() {
      if (!elements.registerConsent || elements.registerConsent.checked) {
        return true;
      }

      setStatus("请先阅读并勾选同意用户协议、隐私政策和 AI 使用说明。");
      return false;
    }

    async function exportData() {
      const records = dreamSync && typeof dreamSync.getVisibleRecords === "function"
        ? dreamSync.getVisibleRecords()
        : [];
      const user = dreamSync && typeof dreamSync.getCurrentUser === "function"
        ? dreamSync.getCurrentUser()
        : currentUser;
      const exportDataPayload = {
        exportVersion: "2026-07-17",
        exportedAt: new Date().toISOString(),
        account: user
          ? { type: "authenticated", userIdHint: String(user.id || "").slice(-8) }
          : { type: "guest" },
        legalVersions: getCurrentVersions(),
        legalConsent: currentConsent ? {
          privacyPolicyVersion: currentConsent.privacy_policy_version,
          termsVersion: currentConsent.terms_version,
          aiDisclaimerVersion: currentConsent.ai_disclaimer_version,
          acceptedAt: currentConsent.accepted_at || ""
        } : null,
        dreams: records.map(sanitizeExportRecord)
      };

      downloadJson(`dream-anatomy-export-${getTodayString()}.json`, exportDataPayload);
      setStatus("数据导出已准备好。");
      return exportDataPayload;
    }

    async function deleteDreamRecord(record) {
      const recordId = getRecordId(record);
      const confirmed = await confirmAction({
        title: "删除这条梦境",
        body: "删除后不可恢复。请确认是否继续。",
        confirmText: "删除这条梦境"
      });

      if (!confirmed) {
        return { cancelled: true };
      }

      try {
        const result = await dreamSync.deleteRecord(recordId);
        if (app.renderDreamJournal) {
          app.renderDreamJournal(result.records || []);
        }
        if (app.showDreamJournalList) {
          app.showDreamJournalList();
        }
        setStatus("这条梦境已删除。");
        return result;
      } catch (error) {
        setStatus("删除失败，请稍后再试。");
        throw error;
      }
    }

    async function clearAllDreams() {
      const records = dreamSync && typeof dreamSync.getVisibleRecords === "function"
        ? dreamSync.getVisibleRecords()
        : [];
      const confirmation = await confirmAction({
        title: "清空全部梦境",
        body: `将删除 ${records.length} 条梦境记录。操作不可恢复。`,
        requiredText: clearAllConfirmation
      });

      if (confirmation !== clearAllConfirmation) {
        setStatus("需要完整输入确认文字后才能清空全部梦境。");
        return { cancelled: true };
      }

      const result = await dreamSync.clearCurrentRecords();
      if (app.renderDreamJournal) {
        app.renderDreamJournal(result.records || []);
      }
      if (app.showDreamJournalList) {
        app.showDreamJournalList();
      }
      setStatus(`已清空 ${result.deletedCount || 0} 条梦境。`);
      return result;
    }

    async function getAuthClient() {
      if (!auth) {
        return null;
      }

      if (typeof auth.getClient === "function") {
        return auth.getClient();
      }

      return auth;
    }

    async function deleteAccount() {
      const confirmation = await confirmAction({
        title: "注销账户",
        body: "注销会删除当前账户数据，操作不可恢复。请输入“注销账户”继续。",
        requiredText: deleteAccountConfirmation
      });

      if (confirmation !== deleteAccountConfirmation) {
        setStatus("需要完整输入确认文字后才能注销账户。");
        return { cancelled: true };
      }

      const client = await getAuthClient();
      const sessionResult = client && client.auth && typeof client.auth.getSession === "function"
        ? await client.auth.getSession()
        : { data: { session: null } };
      const token = sessionResult && sessionResult.data && sessionResult.data.session
        ? sessionResult.data.session.access_token
        : "";

      if (!token) {
        throw new Error("请先登录后再注销账户。");
      }

      const result = await fetchJson("/api/v1/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ confirmation: deleteAccountConfirmation })
      });

      if (dreamSync && typeof dreamSync.clearCurrentLocalCache === "function") {
        dreamSync.clearCurrentLocalCache();
      }

      if (client && client.auth && typeof client.auth.signOut === "function") {
        await client.auth.signOut();
      }

      currentUser = null;
      currentConsent = null;
      if (app.showView) {
        app.showView("home");
      }
      setStatus("账户已注销。");
      return result;
    }

    async function acceptCurrentLegalVersions() {
      if (!currentUser || !currentClient || typeof currentClient.from !== "function") {
        throw new Error("请先登录后再确认法律文件。");
      }

      const versions = getCurrentVersions();
      const row = {
        user_id: currentUser.id,
        privacy_policy_version: versions.privacyPolicyVersion,
        terms_version: versions.termsVersion,
        ai_disclaimer_version: versions.aiDisclaimerVersion
      };
      const response = await currentClient
        .from("legal_consents")
        .upsert(row, { onConflict: "user_id" })
        .select()
        .maybeSingle();

      if (response.error) {
        throw response.error;
      }

      currentConsent = response.data || row;
      lastConsentCheckUserId = currentUser.id;
      setStatus("已记录你的确认。");
      return currentConsent;
    }

    async function handleSession(detail = {}) {
      const nextUser = detail.user || null;
      const nextClient = detail.client || currentClient;
      if (!nextUser || (currentUser && currentUser.id !== nextUser.id)) {
        currentConsent = null;
        lastConsentCheckUserId = "";
        if (elements.documentShell) {
          elements.documentShell.replaceChildren();
        }
        setStatus("");
      }

      currentUser = nextUser;
      currentClient = nextUser ? nextClient : null;
      updateGuestCleanupVisibility();

      if (!nextUser) {
        return null;
      }

      if (detail.authEvent === "TOKEN_REFRESHED" && lastConsentCheckUserId === nextUser.id) {
        return currentConsent;
      }

      return loadCurrentConsent(nextUser, currentClient);
    }

    return {
      acceptCurrentLegalVersions,
      clearAllDreams,
      deleteAccount,
      deleteDreamRecord,
      ensureGuestAiConsent,
      exportData,
      handleSession,
      openLegalDocument,
      render,
      validateRegistrationConsent
    };
  }

  function validateRegistrationConsent() {
    const checkbox = typeof document !== "undefined"
      ? document.querySelector("[data-legal-consent-checkbox]")
      : null;
    return !checkbox || Boolean(checkbox.checked);
  }

  return {
    createPrivacyDataController,
    validateRegistrationConsent
  };
});
