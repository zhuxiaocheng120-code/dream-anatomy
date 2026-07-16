(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(root);
  } else {
    root.AdminAnalytics = factory(root);
  }
})(typeof window !== "undefined" ? window : globalThis, function (root) {
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
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function formatPercent(value) {
    return typeof value === "number" ? `${Math.round(value * 100)}%` : "暂无数据";
  }

  function formatDuration(value) {
    return typeof value === "number" ? `${value} 毫秒` : "暂无数据";
  }

  function formatNumber(value) {
    return typeof value === "number" ? String(value) : "暂无数据";
  }

  function formatCost(summary) {
    if (!summary || !summary.costConfigured || typeof summary.totalEstimatedCostUsd !== "number") {
      return "尚未配置成本估算";
    }

    return `$${summary.totalEstimatedCostUsd.toFixed(4)}`;
  }

  function getPrincipalTypeLabel(value) {
    if (value === "authenticated") return "登录用户";
    if (value === "guest") return "游客";
    return value || "未知";
  }

  function getOutcomeLabel(value) {
    if (value === "success") return "成功";
    if (value === "timeout") return "超时";
    if (value === "upstream_error") return "上游错误";
    if (value === "generation_incomplete") return "生成不完整";
    return value || "未知";
  }

  function getAnalysisTypeLabel(value) {
    if (value === "quick") return "快速解析";
    if (value === "result_card") return "梦境画像";
    if (value === "guided_questions") return "深度追问";
    if (value === "guided_final") return "深度报告";
    return value || "未知类型";
  }

  function createStatCard(documentRef, label, value, note) {
    const card = createElement(documentRef, "article", "admin-stat-card");
    const title = createElement(documentRef, "span", "", label);
    const strong = createElement(documentRef, "strong", "", value);
    card.append(title, strong);
    if (note) {
      card.append(createElement(documentRef, "small", "", note));
    }
    return card;
  }

  function createDistributionList(documentRef, title, items) {
    const section = createElement(documentRef, "div", "admin-distribution");
    section.append(createElement(documentRef, "h3", "", title));

    const list = createElement(documentRef, "div", "admin-distribution-list");
    (Array.isArray(items) ? items : []).forEach((item) => {
      const row = createElement(documentRef, "p", "");
      row.append(
        createElement(documentRef, "span", "", item.label || "未知"),
        createElement(documentRef, "strong", "", formatNumber(item.count))
      );
      list.append(row);
    });

    if (!items || items.length === 0) {
      list.append(createElement(documentRef, "p", "", "暂无数据"));
    }

    section.append(list);
    return section;
  }

  function createAdminAnalyticsController(options = {}) {
    const elements = options.elements || {};
    const app = options.app || {};
    const documentRef = options.document || (root && root.document);
    const fetchJson = options.fetchJson || ((url, init) => fetch(url, init));
    const getAuthHeader = options.getAuthHeader || async function () {
      const client = root.DreamAnatomyAuth && typeof root.DreamAnatomyAuth.getClient === "function"
        ? root.DreamAnatomyAuth.getClient()
        : null;

      if (!client || !client.auth || typeof client.auth.getSession !== "function") {
        return {};
      }

      const { data } = await client.auth.getSession();
      const token = data && data.session ? data.session.access_token : "";
      return token ? { Authorization: `Bearer ${token}` } : {};
    };
    let activeUserId = "";
    let range = "7d";
    let requestGeneration = 0;

    function clear() {
      requestGeneration += 1;
      setHidden(elements.entry, true);
      setText(elements.status, "");
      replaceChildren(elements.cards);
      replaceChildren(elements.trend);
      replaceChildren(elements.principalDistribution);
      replaceChildren(elements.analysisDistribution);
      replaceChildren(elements.errorDistribution);
      replaceChildren(elements.recent);
      setText(elements.costNote, "");
    }

    async function requestAdminJson(url) {
      const authHeader = await getAuthHeader();
      return fetchJson(url, { headers: authHeader });
    }

    function renderSummary(summary) {
      if (!documentRef) return;

      replaceChildren(
        elements.cards,
        createStatCard(documentRef, "今日解析次数", formatNumber(summary.todayRequests)),
        createStatCard(documentRef, "总解析次数", formatNumber(summary.totalRequests)),
        createStatCard(documentRef, "近似独立访客 / 主体", formatNumber(summary.approximatePrincipals), "基于匿名化统计，非精确用户数"),
        createStatCard(documentRef, "成功率", formatPercent(summary.successRate)),
        createStatCard(documentRef, "平均生成时间", formatDuration(summary.averageDurationMs)),
        createStatCard(documentRef, "Token 使用量", formatNumber(summary.totalTokens)),
        createStatCard(documentRef, "预估 AI 成本", formatCost(summary), "仅用于运营估算")
      );

      const trendItems = (Array.isArray(summary.dailyTrend) ? summary.dailyTrend : []).map((item) => {
        const bar = createElement(documentRef, "div", "admin-trend-row");
        bar.append(
          createElement(documentRef, "span", "", item.date),
          createElement(documentRef, "strong", "", formatNumber(item.count))
        );
        return bar;
      });
      replaceChildren(elements.trend, ...trendItems);

      replaceChildren(
        elements.principalDistribution,
        createDistributionList(documentRef, "用户类型", [
          { label: "游客", count: summary.guestRequests || 0 },
          { label: "登录用户", count: summary.authenticatedRequests || 0 }
        ])
      );
      replaceChildren(
        elements.analysisDistribution,
        createDistributionList(
          documentRef,
          "分析类型",
          (summary.analysisTypeDistribution || []).map((item) => ({
            ...item,
            label: getAnalysisTypeLabel(item.label)
          }))
        )
      );
      replaceChildren(
        elements.errorDistribution,
        createDistributionList(documentRef, "错误类型", summary.errorCodeDistribution || [])
      );
      setText(elements.costNote, summary.costConfigured ? "当前显示预估成本。" : "尚未配置成本估算。");
    }

    function renderRecent(payload) {
      if (!documentRef) return;

      const rows = (payload && Array.isArray(payload.events) ? payload.events : []).map((event) => {
        const row = createElement(documentRef, "article", "admin-recent-row");
        row.append(
          createElement(documentRef, "strong", "", event.requestId || "未知请求"),
          createElement(documentRef, "span", "", getPrincipalTypeLabel(event.principalType)),
          createElement(documentRef, "span", "", getAnalysisTypeLabel(event.analysisType)),
          createElement(documentRef, "span", "", getOutcomeLabel(event.outcome)),
          createElement(documentRef, "span", "", formatDuration(event.durationMs)),
          createElement(documentRef, "span", "", `Token ${formatNumber(event.totalTokens)}`)
        );
        return row;
      });

      replaceChildren(
        elements.recent,
        ...(rows.length ? rows : [createElement(documentRef, "p", "empty-state-copy", "暂无最近请求。")])
      );
    }

    async function loadDashboard() {
      const generation = requestGeneration + 1;
      requestGeneration = generation;
      setText(elements.status, "正在读取运营数据……");

      try {
        const summaryResponse = await requestAdminJson(`/api/v1/admin/analytics/summary?range=${range}`);
        const summary = await summaryResponse.json().catch(() => ({}));

        if (generation !== requestGeneration) return false;

        if (!summaryResponse.ok) {
          clear();
          setText(elements.status, summary.error && summary.error.message ? summary.error.message : "暂时无法读取运营数据。");
          return false;
        }

        const recentResponse = await requestAdminJson("/api/v1/admin/analytics/recent?limit=20");
        const recent = await recentResponse.json().catch(() => ({}));

        if (generation !== requestGeneration) return false;

        setHidden(elements.entry, false);
        renderSummary(summary);
        renderRecent(recentResponse.ok ? recent : { events: [] });
        setText(elements.status, summary.totalRequests ? "" : "暂无运营统计数据。");
        return true;
      } catch (error) {
        if (generation === requestGeneration) {
          setText(elements.status, "网络暂时无法连接运营统计。");
        }
        return false;
      }
    }

    async function enterAdminView() {
      return loadDashboard();
    }

    async function handleSession(session = {}) {
      const userId = session.user && session.user.id ? session.user.id : "";

      if (!userId || (activeUserId && activeUserId !== userId)) {
        clear();
        if (app.getCurrentView && app.getCurrentView() === "admin" && typeof app.showView === "function") {
          app.showView("home");
        }
      }

      activeUserId = userId;
      if (!userId) return false;
      return loadDashboard();
    }

    (elements.rangeButtons || []).forEach((button) => {
      if (button && typeof button.addEventListener === "function") {
        button.addEventListener("click", () => {
          range = button.dataset.adminRange || "7d";
          (elements.rangeButtons || []).forEach((item) => {
            if (item.classList && typeof item.classList.toggle === "function") {
              item.classList.toggle("is-current", item === button);
            }
          });
          loadDashboard();
        });
      }
    });

    clear();

    return {
      clear,
      enterAdminView,
      handleSession
    };
  }

  return {
    createAdminAnalyticsController
  };
});
