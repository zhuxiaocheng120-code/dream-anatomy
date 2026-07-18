(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamProductAnalytics = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const PRODUCT_ANALYTICS_VERSION = "2026-07-19";
  const guestPreferenceKey = "dreamAnatomy.productAnalytics.guestPreference";
  const installationIdKey = "dreamAnatomy.productAnalytics.installationId";
  const sessionIdKey = "dreamAnatomy.productAnalytics.sessionId";
  const maxQueueSize = 20;
  const eventProperties = {
    app_opened: {},
    view_opened: { view_name: ["home", "quick", "quick-result", "journal", "dream-detail", "privacy-data", "auth"] },
    dream_input_started: { entry_point: ["nav", "home", "journal", "auth", "privacy-data"] },
    dream_input_abandoned: { length_bucket: ["1-50", "51-150", "151-500", "500+"], view_name: ["home", "quick", "quick-result", "journal", "dream-detail", "privacy-data", "auth"] },
    analysis_requested: { analysis_type: ["quick", "deep", "result_card"] },
    analysis_completed: { analysis_type: ["quick", "deep", "result_card"], source: ["ai_generated", "fallback", "generation_failed", "mock_legacy"], has_result_card: "boolean" },
    analysis_failed: { analysis_type: ["quick", "deep", "result_card"], error_code: "error_code" },
    result_viewed: { analysis_type: ["quick", "deep", "result_card"], source: ["ai_generated", "fallback", "generation_failed", "mock_legacy"] },
    dream_saved: { analysis_type: ["quick", "deep", "result_card"], sync_status: ["synced", "pending_sync", "local_only"] },
    journal_opened: { record_count_bucket: ["0", "1", "2-5", "6-20", "21+"] },
    dream_detail_opened: { analysis_type: ["quick", "deep", "result_card"] },
    signup_started: { entry_point: ["nav", "home", "journal", "auth", "privacy-data"] },
    signup_completed: { method: ["email"] },
    login_completed: { method: ["email"] },
    data_export_completed: { record_count_bucket: ["0", "1", "2-5", "6-20", "21+"] },
    dream_deleted: { analysis_type: ["quick", "deep", "result_card"] },
    all_dreams_cleared: { record_count_bucket: ["0", "1", "2-5", "6-20", "21+"] }
  };
  const errorCodePattern = /^[A-Z][A-Z_]{0,63}$/;

  function createUuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "00000000-0000-4000-8000-000000000000";
  }

  function sanitizeProperties(eventName, properties) {
    const allowed = eventProperties[eventName];
    const result = {};
    const values = properties && typeof properties === "object" && !Array.isArray(properties) ? properties : {};
    if (!allowed) return result;

    Object.entries(allowed).forEach(([key, rule]) => {
      const value = values[key];
      if (rule === "boolean" && typeof value === "boolean") result[key] = value;
      if (Array.isArray(rule) && rule.includes(value)) result[key] = value;
      if (rule === "error_code" && typeof value === "string" && errorCodePattern.test(value)) result[key] = value;
    });
    return result;
  }

  function createProductAnalyticsController(options = {}) {
    const local = options.localStorage || (typeof localStorage !== "undefined" ? localStorage : null);
    const session = options.sessionStorage || (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    const request = options.fetch || (typeof fetch === "function" ? fetch : null);
    const makeUuid = options.createUuid || createUuid;
    const getSession = options.getSession || (async () => null);
    let currentUser = null;
    let currentClient = null;
    let consentEnabled = local ? local.getItem(guestPreferenceKey) === "true" : false;
    let queue = [];
    let flushInFlight = false;
    let lastViewName = "";

    function getInstallationId() {
      if (!local) return "";
      let installationId = local.getItem(installationIdKey);
      if (!installationId && consentEnabled && !currentUser) {
        installationId = makeUuid();
        local.setItem(installationIdKey, installationId);
      }
      return installationId || "";
    }

    function getSessionId() {
      if (!session) return "";
      let sessionId = session.getItem(sessionIdKey);
      if (!sessionId && consentEnabled) {
        sessionId = makeUuid();
        session.setItem(sessionIdKey, sessionId);
      }
      return sessionId || "";
    }

    function clearAnalyticsIdentity() {
      queue = [];
      lastViewName = "";
      if (local) local.removeItem(installationIdKey);
      if (session) session.removeItem(sessionIdKey);
    }

    async function persistAuthenticatedPreference(enabled) {
      if (!currentUser || !currentClient || typeof currentClient.from !== "function") return;
      const response = await currentClient.from("product_analytics_preferences")
        .upsert({ user_id: currentUser.id, enabled }, { onConflict: "user_id" });
      if (response && response.error) throw response.error;
    }

    async function setAnalyticsConsent(enabled) {
      const nextEnabled = Boolean(enabled);
      if (currentUser) {
        await persistAuthenticatedPreference(nextEnabled);
      } else if (local) {
        local.setItem(guestPreferenceKey, String(nextEnabled));
      }
      consentEnabled = nextEnabled;
      if (nextEnabled) {
        getSessionId();
        if (!currentUser) getInstallationId();
      } else {
        clearAnalyticsIdentity();
      }
      return consentEnabled;
    }

    function trackEvent(eventName, properties) {
      if (!consentEnabled || !Object.prototype.hasOwnProperty.call(eventProperties, eventName)) return false;
      const sessionId = getSessionId();
      if (!sessionId) return false;
      const event = {
        eventId: makeUuid(),
        eventName,
        occurredAt: new Date().toISOString(),
        sessionId,
        properties: sanitizeProperties(eventName, properties)
      };
      if (!currentUser) event.installationId = getInstallationId();
      if (!currentUser && !event.installationId) return false;
      if (queue.length >= maxQueueSize) queue.shift();
      queue.push(event);
      return true;
    }

    function trackView(viewName) {
      if (viewName === lastViewName) return false;
      lastViewName = viewName;
      return trackEvent("view_opened", { view_name: viewName });
    }

    async function getAccessToken() {
      const result = await getSession();
      const activeSession = result && result.data ? result.data.session : result;
      return activeSession && activeSession.access_token ? activeSession.access_token : "";
    }

    async function flushEvents(flushOptions = {}) {
      if (!consentEnabled || flushInFlight || queue.length === 0 || typeof request !== "function") return false;
      flushInFlight = true;
      const events = queue.slice();
      try {
        const headers = { "Content-Type": "application/json" };
        const token = await getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await request("/api/v1/product-events", {
          method: "POST",
          headers,
          body: JSON.stringify({ events }),
          keepalive: Boolean(flushOptions.keepalive)
        });
        if (!response || !response.ok) return false;
        queue.splice(0, events.length);
        return true;
      } catch (error) {
        return false;
      } finally {
        flushInFlight = false;
      }
    }

    async function loadPreferenceForSession(detail = {}) {
      const nextUser = detail.user || null;
      const nextClient = detail.client || null;
      const changedAccount = Boolean(currentUser && (!nextUser || currentUser.id !== nextUser.id));
      if (changedAccount) clearAnalyticsIdentity();
      currentUser = nextUser;
      currentClient = nextUser ? nextClient : null;

      if (!nextUser) {
        consentEnabled = local ? local.getItem(guestPreferenceKey) === "true" : false;
        if (consentEnabled) getInstallationId();
        return consentEnabled;
      }

      consentEnabled = false;
      if (!nextClient || typeof nextClient.from !== "function") return false;
      const response = await nextClient.from("product_analytics_preferences")
        .select("enabled")
        .eq("user_id", nextUser.id)
        .maybeSingle();
      if (response && response.error) throw response.error;
      consentEnabled = Boolean(response && response.data && response.data.enabled);
      if (consentEnabled) getSessionId();
      return consentEnabled;
    }

    async function deleteProductAnalyticsData() {
      const installationId = !currentUser ? getInstallationId() : "";
      const headers = { "Content-Type": "application/json" };
      const token = await getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      try {
        if (typeof request === "function") {
          await request("/api/v1/product-analytics", {
            method: "DELETE",
            headers,
            body: JSON.stringify(installationId ? { installationId } : {})
          });
        }
      } finally {
        clearAnalyticsIdentity();
      }
    }

    return {
      clearAnalyticsIdentity,
      deleteProductAnalyticsData,
      flushEvents,
      getAnalyticsConsent: () => consentEnabled,
      getQueueLength: () => queue.length,
      loadPreferenceForSession,
      setAnalyticsConsent,
      trackEvent,
      trackView
    };
  }

  return { PRODUCT_ANALYTICS_VERSION, createProductAnalyticsController };
});
