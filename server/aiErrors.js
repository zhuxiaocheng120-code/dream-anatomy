const defaultMessages = {
  INVALID_REQUEST: "请求内容不完整，请检查后再试。",
  AUTH_INVALID: "登录状态已失效，请重新登录。",
  FEATURE_DISABLED: "这个功能正在开发中。",
  RATE_LIMITED: "请求太频繁了，请稍后再试。",
  DAILY_LIMIT_REACHED: "今天的免费解析次数已经用完，稍后再来继续记录梦境。",
  REQUEST_IN_PROGRESS: "上一段梦境还在整理中，请稍等片刻。",
  UPSTREAM_TIMEOUT: "AI 暂时没有及时回应，请稍后再试。",
  UPSTREAM_UNAVAILABLE: "梦境解析服务暂时不可用，请稍后再试。",
  GENERATION_INCOMPLETE: "AI 结果暂时不够完整，请稍后再试。",
  INTERNAL_ERROR: "服务暂时遇到问题，请稍后再试。"
};

function createApiError(code, message, status, extra = {}) {
  const error = new Error(message || defaultMessages[code] || defaultMessages.INTERNAL_ERROR);
  error.code = code;
  error.status = status || 500;
  Object.assign(error, extra);
  return error;
}

function createEmptyUsage() {
  return {
    authenticated: false,
    limit: null,
    remaining: null,
    resetAt: null
  };
}

function formatApiError(error, usage = null) {
  const code = error && error.code ? error.code : "INTERNAL_ERROR";

  return {
    error: {
      code,
      message: error && error.message ? error.message : defaultMessages.INTERNAL_ERROR
    },
    usage: usage || (error && error.usage) || createEmptyUsage()
  };
}

module.exports = {
  createApiError,
  createEmptyUsage,
  formatApiError
};
