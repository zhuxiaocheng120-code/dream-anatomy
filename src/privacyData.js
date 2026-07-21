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
        && savedVersions.crossBorderConsentVersion === currentVersions.crossBorderConsentVersion
    );
  }

  function sanitizeExportRecord(record) {
    const recordId = getRecordId(record);
    const sleepQuality = record
      ? (record.sleepQuality !== undefined ? record.sleepQuality : record.sleep_quality)
      : undefined;
    return {
      recordIdHint: recordId ? recordId.slice(-8) : "",
      createdAt: getRecordValue(record, "createdAt", "created_at"),
      rawDreamText: getRecordValue(record, "rawDreamText", "raw_dream_text"),
      dreamSummary: getRecordValue(record, "dreamSummary", "dream_summary"),
      ...(sleepQuality ? { sleepQuality } : {}),
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

  function defaultDownloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createPrivacyDataController(options) {
    const documentRef = options.document || document;
    const elements = options.elements || {};
    const legalDocuments = options.legalDocuments;
    const runtimeEnv = options.runtimeEnv || {};
    const storage = options.storage || localStorage;
    const dreamSync = options.dreamSync;
    const auth = options.auth || {};
    const onAnalyticsPreferenceLoaded = options.onAnalyticsPreferenceLoaded || null;
    const productAnalytics = options.productAnalytics || null;
    const app = options.app || {};
    const confirmAction = options.confirmAction || createElementConfirmAction(elements);
    const downloadJson = options.downloadJson || defaultDownloadJson;
    const downloadFile = options.downloadFile || defaultDownloadFile;
    const fetchJson = options.fetchJson || defaultFetchJson;
    let currentUser = dreamSync && typeof dreamSync.getCurrentUser === "function"
      ? dreamSync.getCurrentUser()
      : null;
    let currentClient = null;
    let currentConsent = null;
    let lastConsentCheckUserId = "";
    let guestCleanupCard = null;
    let analyticsToggle = null;
    let legalConsentCheckbox = null;
    let crossBorderConsentCheckbox = null;
    let legalStateLine = null;
    let legalAcceptedAtLine = null;

    function setStatus(message) {
      if (elements.status) {
        elements.status.textContent = message || "";
      }
    }

    function trackProductEvent(eventName, properties) {
      if (!productAnalytics || typeof productAnalytics.trackEvent !== "function") return;
      productAnalytics.trackEvent(eventName, properties);
      if (typeof productAnalytics.flushEvents === "function") {
        Promise.resolve(productAnalytics.flushEvents()).catch(() => {});
      }
    }

    function getRecordCountBucket(recordCount) {
      if (recordCount <= 0) return "0";
      if (recordCount === 1) return "1";
      if (recordCount <= 5) return "2-5";
      if (recordCount <= 20) return "6-20";
      return "21+";
    }

    function getAnalyticsAnalysisType(record) {
      const analysisType = String(record && (record.analysisType || record.analysis_type) || "");
      if (analysisType.includes("深度")) return "deep";
      if (analysisType.includes("画像")) return "result_card";
      return "quick";
    }

    function getCurrentVersions() {
      return legalDocuments.getLegalVersions();
    }

    function hasAcceptedCurrentVersions(consentRow) {
      return legalDocuments.hasAcceptedVersions(consentRow);
    }

    function getAcceptedAtDisplay(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      const parts = new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(date).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});
      return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
    }

    function updateLegalConsentCardState() {
      const accepted = hasAcceptedCurrentVersions(currentConsent);
      if (legalStateLine) {
        legalStateLine.textContent = accepted ? "法律文件状态：已确认当前版本" : "法律文件状态：待确认";
      }
      if (legalAcceptedAtLine) {
        legalAcceptedAtLine.textContent = accepted
          ? `确认时间：${getAcceptedAtDisplay(currentConsent.accepted_at || currentConsent.updated_at)}`
          : "";
      }
    }

    async function loadCurrentConsent(user, client) {
      if (!user || !client || typeof client.from !== "function") {
        currentConsent = null;
        updateLegalConsentCardState();
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
      updateLegalConsentCardState();

      if (!hasAcceptedCurrentVersions(currentConsent)) {
        setStatus("请确认最新版本的用户协议、隐私政策、AI 使用说明和境外处理说明。");
      }

      return currentConsent;
    }

    function renderLegalLinkList(parent) {
      const list = createElement(documentRef, "div", "privacy-legal-links");
      [
        ["privacy", "隐私政策"],
        ["terms", "用户协议"],
        ["ai", "AI 使用说明"],
        ["cross-border", "境外处理说明"]
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

    function renderLegalConsentAction(parent) {
      const versions = getCurrentVersions();
      const card = createElement(documentRef, "article", "privacy-action-card legal-consent-card");
      const heading = createElement(documentRef, "h3", "", "确认当前法律文件");
      legalStateLine = createElement(documentRef, "p", "legal-consent-state");
      const versionList = createElement(documentRef, "ul", "legal-version-list");
      [
        `隐私政策 v${versions.privacyPolicyVersion}`,
        `用户协议 v${versions.termsVersion}`,
        `AI 使用说明 v${versions.aiDisclaimerVersion}`,
        `境外处理说明 v${versions.crossBorderConsentVersion}`
      ].forEach((line) => {
        versionList.append(createElement(documentRef, "li", "", line));
      });
      const links = createElement(documentRef, "div", "privacy-legal-links");
      [
        ["privacy", "查看隐私政策"],
        ["terms", "查看用户协议"],
        ["ai", "查看 AI 使用说明"],
        ["cross-border", "查看境外处理说明"]
      ].forEach(([type, label]) => {
        const button = createElement(documentRef, "button", "text-button", label);
        button.type = "button";
        button.addEventListener("click", () => openLegalDocument(type));
        links.append(button);
      });
      const generalLabel = createElement(documentRef, "label", "legal-consent-row");
      legalConsentCheckbox = createElement(documentRef, "input");
      legalConsentCheckbox.type = "checkbox";
      generalLabel.append(legalConsentCheckbox, createElement(documentRef, "span", "", "我已阅读并同意用户协议、隐私政策和 AI 使用说明"));
      const crossBorderLabel = createElement(documentRef, "label", "legal-consent-row");
      crossBorderConsentCheckbox = createElement(documentRef, "input");
      crossBorderConsentCheckbox.type = "checkbox";
      crossBorderLabel.append(crossBorderConsentCheckbox, createElement(documentRef, "span", "", "我已阅读境外处理说明，并单独同意必要的境外处理"));
      const button = createElement(documentRef, "button", "secondary-button", "确认并继续");
      button.type = "button";
      button.dataset.privacyAction = "accept-legal";
      legalAcceptedAtLine = createElement(documentRef, "p", "legal-accepted-at");
      card.append(heading, legalStateLine, versionList, links, generalLabel, crossBorderLabel, button, legalAcceptedAtLine);
      parent.append(card);
      updateLegalConsentCardState();
      return button;
    }

    function renderAnalyticsControls(parent) {
      const card = createElement(documentRef, "article", "privacy-action-card");
      const heading = createElement(documentRef, "h3", "", "匿名使用统计（可选）");
      const copy = createElement(documentRef, "p", "", "开启后，我们会记录页面和功能的使用情况，例如是否完成解析或保存梦境。不会记录梦境正文、AI 分析正文、邮箱或直接身份信息。");
      const label = createElement(documentRef, "label", "analytics-consent-row", "开启产品分析");
      const toggle = createElement(documentRef, "input");
      toggle.type = "checkbox";
      toggle.checked = Boolean(productAnalytics && productAnalytics.getAnalyticsConsent && productAnalytics.getAnalyticsConsent());
      toggle.addEventListener("change", async (event) => {
        if (!productAnalytics || typeof productAnalytics.setAnalyticsConsent !== "function") return;
        try {
          await productAnalytics.setAnalyticsConsent(Boolean(event.target.checked));
          setStatus(event.target.checked ? "已开启产品分析。" : "已关闭产品分析，并清除本机产品分析标识。");
        } catch (error) {
          toggle.checked = Boolean(productAnalytics.getAnalyticsConsent && productAnalytics.getAnalyticsConsent());
          setStatus("产品分析偏好暂时没有保存成功，请稍后再试。");
        }
      });
      label.append(toggle);
      const deleteButton = createElement(documentRef, "button", "danger-button", "管理匿名统计数据：删除我的产品分析数据");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", async () => {
        if (!productAnalytics || typeof productAnalytics.deleteProductAnalyticsData !== "function") return;
        try {
          await productAnalytics.deleteProductAnalyticsData();
          if (analyticsToggle) analyticsToggle.checked = false;
          setStatus("产品分析数据删除请求已完成。");
        } catch (error) {
          setStatus("产品分析数据暂时无法删除，请稍后再试。");
        }
      });
      card.append(heading, copy, label, deleteButton);
      parent.append(card);
      analyticsToggle = toggle;
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
      const acceptButton = renderLegalConsentAction(actions);
      const exportHtmlButton = renderAction(actions, "导出可阅读的梦境档案", "生成一份可离线打开、可打印或另存为 PDF 的 HTML 梦境档案。", "导出可阅读的梦境档案", "export-html", false);
      const exportButton = renderAction(actions, "导出原始数据备份（JSON）", "适合备份、迁移或技术处理，直接打开时会显示结构化数据。", "导出原始数据备份（JSON）", "export-json", false);
      const clearButton = renderAction(actions, "清空全部梦境", "删除当前账户的全部梦境记录；游客状态下只清理本机游客记录。", "清空全部梦境", "clear", true);
      const guestButton = renderAction(actions, "清除本机梦境数据", "游客可以清除当前浏览器中的本机梦境数据。", "清除本机梦境数据", "clear-guest", true);
      const accountButton = renderAction(actions, "注销账户", "注销会删除当前账户的云端梦境、法律同意记录和可关联的 authenticated AI 使用统计。", "注销账户", "delete-account", true);
      renderAnalyticsControls(actions);

      acceptButton.addEventListener("click", () => {
        acceptCurrentLegalVersions().catch((error) => {
          setStatus(error && error.message ? error.message : "确认暂时没有保存成功，请稍后再试。");
        });
      });
      exportHtmlButton.addEventListener("click", () => exportReadableArchive());
      exportButton.addEventListener("click", () => exportData());
      clearButton.addEventListener("click", () => clearAllDreams());
      guestButton.addEventListener("click", () => clearAllDreams());
      accountButton.addEventListener("click", () => deleteAccount());
      guestCleanupCard = guestButton.parentNode || actions.children[4] || null;
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
      const effectiveDate = createElement(documentRef, "p", "legal-version", `生效日期：${documentData.effectiveDate || documentData.version}`);
      const note = createElement(documentRef, "p", "legal-note", documentData.note);
      container.append(title, version, effectiveDate, note);

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
        if (lastConsentCheckUserId !== currentUser.id) {
          try {
            await loadCurrentConsent(currentUser, currentClient);
          } catch (error) {
            setStatus("法律文件确认状态暂时无法读取，请稍后再试。");
            return false;
          }
        }
        if (hasAcceptedCurrentVersions(currentConsent)) {
          return true;
        }
        setStatus("请先确认当前版本的用户协议、隐私政策、AI 使用说明和境外处理说明。");
        if (app && typeof app.showView === "function") {
          app.showView("privacy-data");
        }
        return false;
      }

      const versions = getCurrentVersions();
      const saved = safeParseJson(storage.getItem(guestConsentKey), null);
      if (versionsMatch(saved, versions)) {
        return true;
      }

      const confirmed = await confirmAction({
        title: "AI 使用说明",
        body: "第一次使用 AI 解析前，请确认你已阅读并理解用户协议、隐私政策、AI 使用说明和境外处理说明，并单独同意必要的境外处理。",
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
        if (!elements.registerCrossBorderConsent || elements.registerCrossBorderConsent.checked) {
          return true;
        }
        setStatus("请先阅读境外处理说明，并勾选单独同意必要的境外处理。");
        return false;
      }

      setStatus("请先阅读并勾选同意用户协议、隐私政策和 AI 使用说明。");
      return false;
    }

    function getExportPayload() {
      const records = dreamSync && typeof dreamSync.getVisibleRecords === "function"
        ? dreamSync.getVisibleRecords()
        : [];
      const user = dreamSync && typeof dreamSync.getCurrentUser === "function"
        ? dreamSync.getCurrentUser()
        : currentUser;
      return {
        records,
        payload: {
          exportVersion: "2026-07-21",
          exportedAt: new Date().toISOString(),
          account: user
            ? { type: "authenticated", userIdHint: String(user.id || "").slice(-8) }
            : { type: "guest" },
          legalVersions: getCurrentVersions(),
          legalConsent: currentConsent ? {
            privacyPolicyVersion: currentConsent.privacy_policy_version,
            termsVersion: currentConsent.terms_version,
            aiDisclaimerVersion: currentConsent.ai_disclaimer_version,
            crossBorderConsentVersion: currentConsent.cross_border_consent_version,
            acceptedAt: currentConsent.accepted_at || "",
            crossBorderAcceptedAt: currentConsent.cross_border_accepted_at || ""
          } : null,
          dreams: records.map(sanitizeExportRecord)
        }
      };
    }

    async function exportData() {
      const { records, payload: exportDataPayload } = getExportPayload();

      downloadJson(`dream-anatomy-export-${getTodayString()}.json`, exportDataPayload);
      setStatus("数据导出已准备好。");
      trackProductEvent("data_export_completed", { record_count_bucket: getRecordCountBucket(records.length) });
      return exportDataPayload;
    }

    function formatList(value) {
      if (Array.isArray(value)) return value.filter(Boolean).join("、");
      return value || "";
    }

    function createReportLines(reportContent) {
      const lines = [];
      if (!reportContent || typeof reportContent !== "object") return lines;
      [
        ["梦境整理", reportContent.dreamSummary || reportContent.summary],
        ["核心主题", reportContent.coreTheme || reportContent.theme],
        ["核心解析", reportContent.coreInterpretation || reportContent.jungianInterpretation || reportContent.jungian],
        ["反思问题", Array.isArray(reportContent.reflectionQuestions) ? reportContent.reflectionQuestions.join("；") : reportContent.question],
        ["今日小行动", reportContent.gentleAction || reportContent.smallAction || reportContent.action],
        ["温和提醒", reportContent.safetyReminder || reportContent.gentleReminder || reportContent.reminder]
      ].forEach(([label, value]) => {
        if (value) lines.push(`<p><strong>${escapeHtml(label)}：</strong>${escapeHtml(value)}</p>`);
      });
      if (Array.isArray(reportContent.evidence) && reportContent.evidence.length) {
        reportContent.evidence.forEach((item, index) => {
          const fragment = item && (item.dreamFragment || item.fragment || item.evidence);
          const interpretation = item && (item.interpretation || item.possibleMeaning || item.meaning);
          const value = [fragment, interpretation].filter(Boolean).join("：");
          if (value) {
            lines.push(`<p><strong>${escapeHtml(`证据 ${index + 1}`)}：</strong>${escapeHtml(value)}</p>`);
          }
        });
      }
      return lines;
    }

    function createResultCardHtml(card) {
      if (!card || typeof card !== "object") return "";
      const parts = ["<section class=\"result-card-export\"><h4>梦境画像 Dream Result Card</h4>"];
      if (card.archetype) {
        parts.push(`<p><strong>梦境原型：</strong>${escapeHtml(card.archetype.nameZh || "")}${card.archetype.nameEn ? ` · ${escapeHtml(card.archetype.nameEn)}` : ""}</p>`);
      }
      if (card.coreInsight) parts.push(`<p><strong>一句话洞察：</strong>${escapeHtml(card.coreInsight)}</p>`);
      if (Array.isArray(card.dimensions) && card.dimensions.length) {
        parts.push("<ul>");
        card.dimensions.forEach((dimension) => {
          const rationale = Array.isArray(dimension.rationale) ? `依据：${dimension.rationale.map(escapeHtml).join("；")}` : "";
          parts.push(`<li><strong>${escapeHtml(dimension.name || dimension.id)}：</strong>${escapeHtml(dimension.score)} / 100。${escapeHtml(dimension.summary || "")}${rationale ? `<br>${rationale}` : ""}</li>`);
        });
        parts.push("</ul>");
      }
      if (card.safetyReminder) parts.push(`<p><strong>安全提醒：</strong>${escapeHtml(card.safetyReminder)}</p>`);
      parts.push("</section>");
      return parts.join("");
    }

    function buildReadableArchiveHtml(exportDataPayload) {
      const dreams = exportDataPayload.dreams || [];
      const items = dreams.map((record, index) => {
        const reportContent = record.reportContent || {};
        const sleepScore = reportContent.sleepQualityScore;
        const sleepLabel = reportContent.sleepQualityLabel || record.sleepQuality || "";
        const sleepLine = sleepScore !== undefined && sleepLabel
          ? `${sleepScore}% · ${sleepLabel}`
          : sleepLabel;
        const cardHtml = createResultCardHtml(reportContent.dreamResultCard);
        return `<article class="dream-entry">
          <p class="entry-index">记录 ${index + 1}</p>
          <h3>${escapeHtml(record.dreamSummary || "未命名的梦")}</h3>
          <p class="meta">${escapeHtml(record.createdAt || "")} · ${escapeHtml(record.analysisType || "")}</p>
          ${sleepLine ? `<p>睡眠感受：${escapeHtml(sleepLine)}</p>` : ""}
          <section><h4>梦境原文</h4><p>${escapeHtml(record.rawDreamText || "")}</p></section>
          <section><h4>梦境摘要</h4><p>${escapeHtml(record.dreamSummary || "")}</p></section>
          <p><strong>情绪：</strong>${escapeHtml(formatList(record.emotions))}</p>
          <p><strong>意象：</strong>${escapeHtml(formatList(record.symbols))}</p>
          <section><h4>AI 分析</h4>${createReportLines(reportContent).join("") || "<p>未记录。</p>"}</section>
          ${cardHtml}
          ${reportContent.userReflection ? `<section><h4>用户自我思考</h4><p>${escapeHtml(reportContent.userReflection)}</p></section>` : ""}
        </article>`;
      }).join("");
      return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Dream Anatomy 梦境档案导出</title>
<style>
body{margin:0;padding:32px;background:#f4eddf;color:#332e27;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif;line-height:1.7}
main{max-width:880px;margin:0 auto}
h1,h2,h3,h4{font-family:"Songti SC","Noto Serif SC",serif;color:#2f352b}
.intro,.dream-entry{background:#fffaf0;border:1px solid #d9cdb9;border-radius:8px;padding:24px;margin:0 0 20px;box-shadow:0 10px 30px rgba(78,67,48,.08)}
.meta,.entry-index{color:#7b705f;font-size:.92rem}
.result-card-export{border-top:1px solid #d9cdb9;margin-top:18px;padding-top:14px}
p{white-space:pre-wrap}
@media print{body{background:#fff}.intro,.dream-entry{box-shadow:none;break-inside:avoid}}
</style>
</head>
<body>
<main>
<section class="intro">
<h1>Dream Anatomy 梦境档案</h1>
<p>导出时间：${escapeHtml(exportDataPayload.exportedAt)}</p>
<p>记录数量：${dreams.length}</p>
<p>这是一份离线可阅读的梦境档案，不包含邮箱、完整用户 ID、token、principal hash、微信身份 hash 或管理员统计。</p>
</section>
${items || "<article class=\"dream-entry\"><h3>暂无梦境记录</h3><p>这次导出时没有可见的梦境记录。</p></article>"}
</main>
</body>
</html>`;
    }

    async function exportReadableArchive() {
      const { records, payload } = getExportPayload();
      const html = buildReadableArchiveHtml(payload);
      downloadFile(`dream-anatomy-archive-${getTodayString()}.html`, html, "text/html;charset=utf-8");
      setStatus("可阅读的梦境档案已准备好。");
      trackProductEvent("data_export_completed", { record_count_bucket: getRecordCountBucket(records.length) });
      return html;
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
        trackProductEvent("dream_deleted", { analysis_type: getAnalyticsAnalysisType(record) });
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
      trackProductEvent("all_dreams_cleared", { record_count_bucket: getRecordCountBucket(records.length) });
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
      if (legalConsentCheckbox && !legalConsentCheckbox.checked) {
        throw new Error("请先勾选同意用户协议、隐私政策和 AI 使用说明。");
      }
      if (crossBorderConsentCheckbox && !crossBorderConsentCheckbox.checked) {
        throw new Error("请先勾选单独同意必要的境外处理。");
      }
      const now = new Date().toISOString();
      const row = {
        user_id: currentUser.id,
        privacy_policy_version: versions.privacyPolicyVersion,
        terms_version: versions.termsVersion,
        ai_disclaimer_version: versions.aiDisclaimerVersion,
        accepted_at: now,
        cross_border_consent_version: versions.crossBorderConsentVersion,
        cross_border_accepted_at: now
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
      setStatus("已确认当前版本。");
      updateLegalConsentCardState();
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
      if (productAnalytics && typeof productAnalytics.loadPreferenceForSession === "function") {
        try {
          await productAnalytics.loadPreferenceForSession({ user: nextUser, client: currentClient, authEvent: detail.authEvent });
        } catch (error) {
          setStatus("产品分析偏好暂时无法读取，不影响隐私与数据设置。");
        }
        if (analyticsToggle) analyticsToggle.checked = Boolean(productAnalytics.getAnalyticsConsent && productAnalytics.getAnalyticsConsent());
        if (typeof onAnalyticsPreferenceLoaded === "function") {
          onAnalyticsPreferenceLoaded();
        }
      }
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
      exportReadableArchive,
      handleSession,
      openLegalDocument,
      render,
      validateRegistrationConsent
    };
  }

  function validateRegistrationConsent() {
    const legalCheckbox = typeof document !== "undefined"
      ? document.querySelector("[data-legal-consent-checkbox]")
      : null;
    const crossBorderCheckbox = typeof document !== "undefined"
      ? document.querySelector("[data-cross-border-consent-checkbox]")
      : null;
    return (!legalCheckbox || Boolean(legalCheckbox.checked))
      && (!crossBorderCheckbox || Boolean(crossBorderCheckbox.checked));
  }

  return {
    createPrivacyDataController,
    validateRegistrationConsent
  };
});
