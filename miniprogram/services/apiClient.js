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

  return new Promise((resolve, reject) => {
    wxRef.request({
      url: `${apiBaseUrl}/api/v1/dream-analysis`,
      method: "POST",
      timeout: config.REQUEST_TIMEOUT_MS,
      header: { "Content-Type": "application/json" },
      data: {
        analysisType: "quick",
        dreamText: validation.value,
        clientPlatform: "wechat_mini_program"
      },
      success(response) {
        const statusCode = response && response.statusCode ? response.statusCode : 0;
        const data = response && response.data ? response.data : {};
        if (statusCode < 200 || statusCode >= 300) {
          const apiError = data && data.error ? data.error : {};
          reject(createApiError(apiError.code || "UPSTREAM_UNAVAILABLE", apiError.message, statusCode));
          return;
        }
        if (!data || !data.analysis) {
          reject(createApiError("GENERATION_INCOMPLETE", "AI 结果暂时不够完整，请稍后再试。", statusCode));
          return;
        }
        resolve(data);
      },
      fail() {
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

module.exports = { createQuickAnalysisController, requestQuickAnalysis };
