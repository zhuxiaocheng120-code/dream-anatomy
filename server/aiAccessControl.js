const { createApiError } = require("./aiErrors");

const minuteMs = 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

function toPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function createUsage(identity, dailyRecords, dailyLimit) {
  const records = dailyRecords || [];
  const oldest = records.length ? records[0] : null;

  return {
    authenticated: identity.type === "authenticated",
    limit: dailyLimit,
    remaining: Math.max(0, dailyLimit - records.length),
    resetAt: oldest === null ? null : new Date(oldest + dayMs).toISOString()
  };
}

function createAiAccessControl(options = {}) {
  const limits = {
    guestDailyLimit: toPositiveInteger(options.guestDailyLimit, 3),
    userDailyLimit: toPositiveInteger(options.userDailyLimit, 10),
    guestRequestsPerMinute: toPositiveInteger(options.guestRequestsPerMinute, 2),
    userRequestsPerMinute: toPositiveInteger(options.userRequestsPerMinute, 3),
    maxConcurrentPerPrincipal: toPositiveInteger(options.maxConcurrentPerPrincipal, 1)
  };
  const getNow = typeof options.now === "function" ? options.now : () => Date.now();
  const dailyAttempts = new Map();
  const minuteAttempts = new Map();
  const activeCounts = new Map();

  function getDailyLimit(identity) {
    return identity.type === "authenticated" ? limits.userDailyLimit : limits.guestDailyLimit;
  }

  function getMinuteLimit(identity) {
    return identity.type === "authenticated" ? limits.userRequestsPerMinute : limits.guestRequestsPerMinute;
  }

  function pruneList(list, now, windowMs) {
    return (list || []).filter((timestamp) => now - timestamp < windowMs);
  }

  function cleanup(now = getNow()) {
    for (const [key, records] of dailyAttempts) {
      const pruned = pruneList(records, now, dayMs);
      if (pruned.length) dailyAttempts.set(key, pruned);
      else dailyAttempts.delete(key);
    }

    for (const [key, records] of minuteAttempts) {
      const pruned = pruneList(records, now, minuteMs);
      if (pruned.length) minuteAttempts.set(key, pruned);
      else minuteAttempts.delete(key);
    }

    for (const [key, count] of activeCounts) {
      if (!count) activeCounts.delete(key);
    }
  }

  const cleanupIntervalMs = toPositiveInteger(options.cleanupIntervalMs, 5 * minuteMs);
  const cleanupTimer = setInterval(() => cleanup(), cleanupIntervalMs);
  if (typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }

  function getUsage(identity, now = getNow()) {
    cleanup(now);
    const key = identity.rateLimitKey;
    const dailyRecords = pruneList(dailyAttempts.get(key), now, dayMs);
    dailyAttempts.set(key, dailyRecords);
    return createUsage(identity, dailyRecords, getDailyLimit(identity));
  }

  function start(identity, analysisType, now = getNow()) {
    cleanup(now);
    const key = identity.rateLimitKey;
    const dailyLimit = getDailyLimit(identity);
    const minuteLimit = getMinuteLimit(identity);
    const usageBefore = getUsage(identity, now);

    if ((activeCounts.get(key) || 0) >= limits.maxConcurrentPerPrincipal) {
      throw createApiError("REQUEST_IN_PROGRESS", "上一段梦境还在整理中，请稍等片刻。", 429, {
        usage: usageBefore,
        retryAfter: 1
      });
    }

    const minuteRecords = pruneList(minuteAttempts.get(key), now, minuteMs);
    if (minuteRecords.length >= minuteLimit) {
      const retryAfter = Math.max(1, Math.ceil((minuteMs - (now - minuteRecords[0])) / 1000));
      throw createApiError("RATE_LIMITED", "请求太频繁了，请稍后再试。", 429, {
        usage: usageBefore,
        retryAfter
      });
    }

    const dailyRecords = pruneList(dailyAttempts.get(key), now, dayMs);
    if (dailyRecords.length >= dailyLimit) {
      throw createApiError("DAILY_LIMIT_REACHED", "今天的免费解析次数已经用完，稍后再来继续记录梦境。", 429, {
        usage: createUsage(identity, dailyRecords, dailyLimit),
        retryAfter: Math.max(1, Math.ceil((dayMs - (now - dailyRecords[0])) / 1000))
      });
    }

    minuteRecords.push(now);
    dailyRecords.push(now);
    minuteAttempts.set(key, minuteRecords);
    dailyAttempts.set(key, dailyRecords);
    activeCounts.set(key, (activeCounts.get(key) || 0) + 1);

    return {
      identity,
      analysisType,
      key,
      timestamp: now,
      finished: false,
      usage: createUsage(identity, dailyRecords, dailyLimit)
    };
  }

  function finish(reservation, outcome = {}) {
    if (!reservation || reservation.finished) return;
    reservation.finished = true;

    const active = activeCounts.get(reservation.key) || 0;
    if (active <= 1) activeCounts.delete(reservation.key);
    else activeCounts.set(reservation.key, active - 1);

    if (outcome.refundDaily) {
      const records = dailyAttempts.get(reservation.key) || [];
      const index = records.lastIndexOf(reservation.timestamp);
      if (index >= 0) {
        records.splice(index, 1);
      }
      if (records.length) dailyAttempts.set(reservation.key, records);
      else dailyAttempts.delete(reservation.key);
    }
  }

  function close() {
    clearInterval(cleanupTimer);
  }

  return {
    cleanup,
    close,
    finish,
    getUsage,
    start
  };
}

module.exports = {
  createAiAccessControl
};
