const messages = {
  INVALID_REQUEST: "请求内容不完整，请检查后再试。",
  AUTH_INVALID: "登录状态已失效，请重新进入。",
  FEATURE_DISABLED: "这个功能正在开发中。",
  RATE_LIMITED: "请求太频繁了，请稍后再试。",
  DAILY_LIMIT_REACHED: "今天的免费整理次数已经用完，稍后再来继续记录梦境。",
  REQUEST_IN_PROGRESS: "上一段梦境还在整理中，请稍等片刻。",
  UPSTREAM_TIMEOUT: "AI 暂时没有及时回应，请稍后再试。",
  UPSTREAM_UNAVAILABLE: "梦境文字整理服务暂时不可用，请稍后再试。",
  GENERATION_INCOMPLETE: "AI 结果暂时不够完整，请稍后再试。",
  NETWORK_ERROR: "网络暂时没有连接上，请稍后再试。"
};

function mapApiError(code, fallbackMessage) {
  return messages[code] || fallbackMessage || "请求暂时没有完成，请稍后再试。";
}

module.exports = { mapApiError };
