const { getConfig } = require("../config/config.example");
const { mapApiError } = require("./errorMessages");
const { validateDreamText } = require("../utils/validation");

function getWx(options = {}) {
  return options.wx || (typeof wx !== "undefined" ? wx : null);
}

function createApiError(code, message, statusCode) {
  const error = new Error(mapApiError(code, message));
  error.code = code;
  error.statusCode = statusCode || 0;
  return error;
}

function createRequestCorrelationId() {
  return `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getRequestPath(url, apiBaseUrl) {
  const normalizedUrl = String(url || "");
  const normalizedBase = String(apiBaseUrl || "").replace(/\/+$/, "");
  if (normalizedBase && normalizedUrl.startsWith(normalizedBase)) {
    return normalizedUrl.slice(normalizedBase.length) || "/";
  }

  const protocolIndex = normalizedUrl.indexOf("://");
  if (protocolIndex >= 0) {
    const pathStart = normalizedUrl.indexOf("/", protocolIndex + 3);
    return pathStart >= 0 ? normalizedUrl.slice(pathStart) : "/";
  }

  return normalizedUrl.startsWith("/") ? normalizedUrl : "/";
}

function classifyWxRequestFailure(error) {
  const message = String(error && error.errMsg ? error.errMsg : "").toLowerCase();
  if (/domain list|url not in domain|合法域名|request domain/.test(message)) {
    return "WX_REQUEST_DOMAIN_NOT_CONFIGURED";
  }
  if (/timeout|timed[\s_-]*out|err_connection_timed_out/.test(message)) {
    return "WX_REQUEST_TIMEOUT";
  }
  if (/ssl|tls|certificate|cert/.test(message)) {
    return "WX_REQUEST_TLS_ERROR";
  }
  if (/dns|resolve|host/.test(message)) {
    return "WX_REQUEST_DNS_ERROR";
  }

  return "WX_REQUEST_FAILED";
}

function getNetworkDebugLogger(options, wxRef) {
  if (typeof options.networkDebugLogger === "function") {
    return options.networkDebugLogger;
  }

  if (typeof wx !== "undefined" && wxRef === wx && typeof console !== "undefined" && typeof console.info === "function") {
    return (entry) => console.info("[dream-anatomy:miniprogram-request]", entry);
  }

  return null;
}

function emitNetworkDiagnostic(logger, entry) {
  if (!logger) return;
  logger({
    requestPath: entry.requestPath,
    httpStatus: entry.httpStatus === undefined ? null : entry.httpStatus,
    safeErrorCode: entry.safeErrorCode || null,
    requestCorrelationId: entry.requestCorrelationId
  });
}

function requestQuickAnalysis(dreamText, options = {}) {
  const validation = validateDreamText(dreamText);
  if (!validation.ok) {
    return Promise.reject(createApiError("INVALID_REQUEST", validation.message, 400));
  }

  const wxRef = getWx(options);
  if (!wxRef || typeof wxRef.request !== "function") {
    return Promise.reject(createApiError("NETWORK_ERROR", "网络暂时没有连接上，请稍后再试。"));
  }

  const config = { ...getConfig(), ...(options.config || {}) };
  const apiBaseUrl = String(config.API_BASE_URL || "").replace(/\/+$/, "");
  const url = `${apiBaseUrl}/api/v1/dream-analysis`;
  const requestPath = getRequestPath(url, apiBaseUrl);
  const requestCorrelationId = typeof options.createCorrelationId === "function"
    ? options.createCorrelationId()
    : createRequestCorrelationId();
  const networkDebugLogger = getNetworkDebugLogger(options, wxRef);

  return new Promise((resolve, reject) => {
    emitNetworkDiagnostic(networkDebugLogger, {
      requestPath,
      httpStatus: null,
      safeErrorCode: null,
      requestCorrelationId
    });

    wxRef.request({
      url,
      method: "POST",
      timeout: config.REQUEST_TIMEOUT_MS,
      header: {
        "Content-Type": "application/json",
        "X-Request-Correlation-Id": requestCorrelationId
      },
      data: {
        analysisType: "quick",
        dreamText: validation.value,
        clientPlatform: "wechat_mini_program"
      },
      success(response) {
        const statusCode = response && response.statusCode ? response.statusCode : 0;
        const data = response && response.data ? response.data : {};
        const apiError = data && data.error ? data.error : {};
        emitNetworkDiagnostic(networkDebugLogger, {
          requestPath,
          httpStatus: statusCode,
          safeErrorCode: statusCode < 200 || statusCode >= 300 ? apiError.code || "HTTP_ERROR" : null,
          requestCorrelationId
        });
        if (statusCode < 200 || statusCode >= 300) {
          reject(createApiError(apiError.code || "UPSTREAM_UNAVAILABLE", apiError.message, statusCode));
          return;
        }
        if (!data || !data.analysis) {
          reject(createApiError("GENERATION_INCOMPLETE", "AI 结果暂时不够完整，请稍后再试。", statusCode));
          return;
        }
        resolve(data);
      },
      fail(error) {
        emitNetworkDiagnostic(networkDebugLogger, {
          requestPath,
          httpStatus: null,
          safeErrorCode: classifyWxRequestFailure(error),
          requestCorrelationId
        });
        reject(createApiError("NETWORK_ERROR", "网络暂时没有连接上，请稍后再试。"));
      }
    });
  });
}

function createQuickAnalysisController(apiClient = {}) {
  const request = apiClient.requestQuickAnalysis || requestQuickAnalysis;
  let submitting = false;
  let inFlight = null;

  function submit(dreamText, options) {
    if (inFlight) return inFlight;
    submitting = true;
    inFlight = request(dreamText, options).finally(() => {
      submitting = false;
      inFlight = null;
    });
    return inFlight;
  }

  return {
    isSubmitting: () => submitting,
    submit
  };
}

module.exports = {
  createQuickAnalysisController,
  requestQuickAnalysis,
  classifyWxRequestFailure,
  getRequestPath
};
