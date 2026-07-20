const { getConfig } = require("../config/config.example");
const { mapApiError } = require("./errorMessages");

const WECHAT_SESSION_TOKEN_KEY = "dream_anatomy_wechat_session_token_v1";

const guestState = {
  mode: "guest",
  authenticated: false,
  cloudSyncAvailable: false
};

let currentState = { ...guestState };
let currentExpiresAt = "";

function getWx(options = {}) {
  return options.wx || (typeof wx !== "undefined" ? wx : null);
}

function getApiBaseUrl(options = {}) {
  const config = { ...getConfig(), ...(options.config || {}) };
  return String(config.API_BASE_URL || "").replace(/\/+$/, "");
}

function getStoredToken(wxRef) {
  if (!wxRef || typeof wxRef.getStorageSync !== "function") return "";
  return String(wxRef.getStorageSync(WECHAT_SESSION_TOKEN_KEY) || "");
}

function saveToken(wxRef, token) {
  if (wxRef && typeof wxRef.setStorageSync === "function" && token) {
    wxRef.setStorageSync(WECHAT_SESSION_TOKEN_KEY, token);
  }
}

function removeToken(wxRef) {
  if (wxRef && typeof wxRef.removeStorageSync === "function") {
    wxRef.removeStorageSync(WECHAT_SESSION_TOKEN_KEY);
  }
}

function normalizeAuthState(payload = {}) {
  const account = payload.account || {};
  if (account.mode !== "wechat" || account.authenticated !== true) {
    return { ...guestState };
  }

  currentExpiresAt = typeof payload.expiresAt === "string" ? payload.expiresAt : "";
  return {
    mode: "wechat",
    authenticated: true,
    cloudSyncAvailable: false
  };
}

function createAuthError(code, message) {
  const error = new Error(mapApiError(code, message || "微信身份服务暂时不可用，请稍后再试。"));
  error.code = code;
  return error;
}

function requestAuth(path, options = {}) {
  const wxRef = getWx(options);
  if (!wxRef || typeof wxRef.request !== "function") {
    return Promise.reject(createAuthError("NETWORK_ERROR", "网络暂时没有连接上，请稍后再试。"));
  }

  const header = { "Content-Type": "application/json" };
  if (options.token) {
    header.Authorization = `Bearer ${options.token}`;
  }

  return new Promise((resolve, reject) => {
    wxRef.request({
      url: `${getApiBaseUrl(options)}/api/v1/wechat-auth/${path}`,
      method: options.method || "GET",
      timeout: (options.config && options.config.REQUEST_TIMEOUT_MS) || getConfig().REQUEST_TIMEOUT_MS,
      header,
      data: options.data || {},
      success(response) {
        const statusCode = response && response.statusCode ? response.statusCode : 0;
        const data = response && response.data ? response.data : {};
        if (statusCode < 200 || statusCode >= 300) {
          const apiError = data && data.error ? data.error : {};
          reject(createAuthError(apiError.code || "WECHAT_AUTH_UNAVAILABLE", apiError.message));
          return;
        }
        resolve(data);
      },
      fail() {
        reject(createAuthError("NETWORK_ERROR", "网络暂时没有连接上，请稍后再试。"));
      }
    });
  });
}

function requestLoginCode(wxRef) {
  if (!wxRef || typeof wxRef.login !== "function") {
    return Promise.reject(createAuthError("WECHAT_AUTH_UNAVAILABLE", "当前环境暂时无法建立微信身份。"));
  }

  return new Promise((resolve, reject) => {
    wxRef.login({
      success(result = {}) {
        if (typeof result.code === "string" && result.code.trim()) {
          resolve(result.code.trim());
          return;
        }
        reject(createAuthError("AUTH_INVALID", "微信登录凭证无效，请重新尝试。"));
      },
      fail() {
        reject(createAuthError("WECHAT_AUTH_UNAVAILABLE", "微信身份暂时没有建立，游客功能仍可使用。"));
      }
    });
  });
}

function setGuest(wxRef) {
  removeToken(wxRef);
  currentState = { ...guestState };
  currentExpiresAt = "";
  return getAuthState();
}

async function initialize(options = {}) {
  const wxRef = getWx(options);
  const token = getStoredToken(wxRef);
  if (!token) {
    currentState = { ...guestState };
    currentExpiresAt = "";
    return getAuthState();
  }

  try {
    const result = await requestAuth("session", {
      ...options,
      method: "GET",
      token
    });
    currentState = normalizeAuthState(result);
    return getAuthState();
  } catch (error) {
    return setGuest(wxRef);
  }
}

function getAuthState() {
  return { ...currentState };
}

function getSessionExpiresAt() {
  return currentExpiresAt;
}

async function getAccessToken(options = {}) {
  return getStoredToken(getWx(options));
}

async function login(options = {}) {
  const wxRef = getWx(options);
  const code = await requestLoginCode(wxRef);
  const result = await requestAuth("login", {
    ...options,
    method: "POST",
    data: { code }
  });

  if (!result.sessionToken) {
    throw createAuthError("WECHAT_AUTH_UNAVAILABLE", "微信身份服务暂时不可用，请稍后再试。");
  }

  saveToken(wxRef, result.sessionToken);
  currentState = normalizeAuthState(result);
  return getAuthState();
}

async function logout(options = {}) {
  const wxRef = getWx(options);
  const token = getStoredToken(wxRef);
  if (token) {
    try {
      await requestAuth("logout", {
        ...options,
        method: "POST",
        token
      });
    } catch (error) {
      // Local logout should still clear only this device's opaque session token.
    }
  }

  return setGuest(wxRef);
}

function clearLocalSession(options = {}) {
  return setGuest(getWx(options));
}

function isCloudSyncAvailable() {
  return false;
}

module.exports = {
  WECHAT_SESSION_TOKEN_KEY,
  clearLocalSession,
  getAccessToken,
  getAuthState,
  getSessionExpiresAt,
  initialize,
  isCloudSyncAvailable,
  login,
  logout
};
