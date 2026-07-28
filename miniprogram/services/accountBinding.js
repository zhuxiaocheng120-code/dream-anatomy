const { getConfig } = require("../config/config.example");
const auth = require("./authAdapter");
const { mapApiError } = require("./errorMessages");

function getWx(options = {}) {
  return options.wx || (typeof wx !== "undefined" ? wx : null);
}

function getApiBaseUrl(options = {}) {
  const config = { ...getConfig(), ...(options.config || {}) };
  return String(config.API_BASE_URL || "").replace(/\/+$/, "");
}

function normalizeBindingCode(value) {
  return String(value || "").replace(/[\s-]+/g, "").trim().toUpperCase();
}

function createBindingError(code, message, statusCode) {
  const error = new Error(message || mapApiError(code, "账户绑定暂时没有完成，请稍后再试。"));
  error.code = code;
  error.statusCode = statusCode || 0;
  return error;
}

function requestBinding(path, options = {}) {
  const wxRef = getWx(options);
  if (!wxRef || typeof wxRef.request !== "function") {
    return Promise.reject(createBindingError("NETWORK_ERROR", "网络暂时没有连接上，请稍后再试。"));
  }

  return auth.getAccessToken({ wx: wxRef }).then((token) => {
    if (!token) {
      throw createBindingError("AUTH_INVALID", "请先建立微信身份。", 401);
    }

    const config = { ...getConfig(), ...(options.config || {}) };
    return new Promise((resolve, reject) => {
      wxRef.request({
        url: `${getApiBaseUrl(options)}${path}`,
        method: options.method || "GET",
        timeout: config.REQUEST_TIMEOUT_MS,
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        data: options.data || {},
        success(response) {
          const statusCode = response && response.statusCode ? response.statusCode : 0;
          const data = response && response.data ? response.data : {};
          if (statusCode < 200 || statusCode >= 300) {
            const apiError = data && data.error ? data.error : {};
            reject(createBindingError(apiError.code || "ACCOUNT_BINDING_UNAVAILABLE", apiError.message, statusCode));
            return;
          }
          resolve(data);
        },
        fail() {
          reject(createBindingError("NETWORK_ERROR", "网络暂时没有连接上，请稍后再试。"));
        }
      });
    });
  });
}

function confirmBinding(bindingCode, options = {}) {
  const normalized = normalizeBindingCode(bindingCode);
  if (!normalized) {
    return Promise.reject(createBindingError("ACCOUNT_BINDING_INVALID", "请输入网页端生成的绑定码。", 400));
  }

  return requestBinding("/api/miniprogram/account-binding/confirm", {
    ...options,
    method: "POST",
    data: {
      bindingCode: normalized,
      confirmMerge: true
    }
  });
}

function getBindingStatus(options = {}) {
  return requestBinding("/api/miniprogram/account-binding/status", {
    ...options,
    method: "GET"
  });
}

module.exports = {
  confirmBinding,
  getBindingStatus,
  normalizeBindingCode
};
