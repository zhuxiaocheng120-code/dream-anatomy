(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamHome = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const defaultTitleLength = 36;

  function getGreeting(date) {
    const hour = date.getHours();

    if (hour >= 5 && hour < 12) {
      return "早上好";
    }

    if (hour >= 12 && hour < 18) {
      return "下午好";
    }

    return "晚上好";
  }

  function getRecordValue(record, snakeCaseKey, camelCaseKey) {
    if (!record || typeof record !== "object") {
      return undefined;
    }

    return record[snakeCaseKey] || record[camelCaseKey];
  }

  function normalizeTitle(value) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  }

  function getDisplayTitle(record, maxLength = defaultTitleLength) {
    const title = normalizeTitle(record && record.title)
      || normalizeTitle(getRecordValue(record, "dream_summary", "dreamSummary"))
      || normalizeTitle(getRecordValue(record, "raw_dream_text", "rawDreamText"))
      || "未命名的梦";
    const length = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : defaultTitleLength;

    return title.length > length ? `${title.slice(0, length)}...` : title;
  }

  function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
  }

  function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getRecordDate(record) {
    const value = getRecordValue(record, "created_at", "createdAt");

    if (!value) {
      return null;
    }

    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }

  function calculateDreamStreak(records, now) {
    if (!Array.isArray(records) || !isValidDate(now)) {
      return 0;
    }

    const recordDates = new Set();

    records.forEach((record) => {
      const recordDate = getRecordDate(record);

      if (recordDate) {
        recordDates.add(toLocalDateKey(recordDate));
      }
    });

    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (!recordDates.has(toLocalDateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    let streak = 0;

    while (recordDates.has(toLocalDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }

  function calculateDreamStats(records, now) {
    const safeRecords = Array.isArray(records) ? records : [];
    const aiOrganized = safeRecords.filter((record) => {
      const analysisType = getRecordValue(record, "analysis_type", "analysisType");
      return analysisType === "快速解析" || analysisType === "深度引导";
    }).length;

    return {
      total: safeRecords.length,
      important: 0,
      streak: calculateDreamStreak(safeRecords, now),
      aiOrganized
    };
  }

  function getRecentDreams(records, limit = 5) {
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 5;

    return (Array.isArray(records) ? records : [])
      .slice()
      .sort((left, right) => {
        const leftDate = getRecordDate(left);
        const rightDate = getRecordDate(right);
        const leftTime = leftDate ? leftDate.getTime() : Number.NEGATIVE_INFINITY;
        const rightTime = rightDate ? rightDate.getTime() : Number.NEGATIVE_INFINITY;

        return rightTime - leftTime;
      })
      .slice(0, safeLimit);
  }

  async function fetchDreamRecords(client, user) {
    if (!client || !user || !user.id) {
      return [];
    }

    const response = await client
      .from("dream_records")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (response.error) {
      throw new Error("Dream Home records unavailable");
    }

    return Array.isArray(response.data) ? response.data : [];
  }

  return {
    calculateDreamStats,
    calculateDreamStreak,
    fetchDreamRecords,
    getDisplayTitle,
    getGreeting,
    getRecentDreams
  };
});
