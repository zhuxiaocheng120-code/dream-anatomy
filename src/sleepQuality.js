(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamSleepQuality = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const minScore = 0;
  const maxScore = 100;
  const step = 5;

  function clampScore(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return null;
    }

    return Math.min(maxScore, Math.max(minScore, numericValue));
  }

  function snapSleepQualityScore(value) {
    const clamped = clampScore(value);

    if (clamped === null) {
      return null;
    }

    return Math.min(maxScore, Math.max(minScore, Math.round(clamped / step) * step));
  }

  function getSleepQualityLabel(score) {
    const snappedScore = clampScore(score);

    if (snappedScore === null) {
      return "";
    }

    if (snappedScore <= 20) return "很差";
    if (snappedScore <= 40) return "不太好";
    if (snappedScore <= 60) return "一般";
    if (snappedScore <= 80) return "不错";
    return "很好";
  }

  function normalizeSleepQualityState(input) {
    if (input === null || input === undefined || input === "") {
      return { score: null, label: "", updatedAt: "" };
    }

    const rawScore = typeof input === "object" ? input.score : input;

    if (rawScore === null || rawScore === undefined || rawScore === "") {
      return { score: null, label: "", updatedAt: "" };
    }
    const score = snapSleepQualityScore(rawScore);

    if (score === null) {
      return { score: null, label: "", updatedAt: "" };
    }

    const updatedAt = typeof input === "object" && typeof input.updatedAt === "string"
      ? input.updatedAt
      : "";

    return {
      score,
      label: getSleepQualityLabel(score),
      updatedAt
    };
  }

  function getReportContent(record) {
    const reportContent = record && (record.reportContent || record.report_content);
    return reportContent && typeof reportContent === "object" && !Array.isArray(reportContent)
      ? reportContent
      : {};
  }

  function removeSleepQualityFields(reportContent) {
    const {
      sleepQualityScore,
      sleepQualityLabel,
      sleepQualityUpdatedAt,
      ...rest
    } = reportContent;

    return rest;
  }

  function applySleepQualityToRecord(record, state, now = () => new Date().toISOString()) {
    const normalized = normalizeSleepQualityState(state);
    const baseReportContent = getReportContent(record);

    if (normalized.score === null) {
      const {
        sleepQuality,
        sleep_quality,
        ...rest
      } = record || {};

      return {
        ...rest,
        reportContent: removeSleepQualityFields(baseReportContent)
      };
    }

    return {
      ...(record || {}),
      sleepQuality: normalized.label,
      reportContent: {
        ...baseReportContent,
        sleepQualityScore: normalized.score,
        sleepQualityLabel: normalized.label,
        sleepQualityUpdatedAt: now()
      }
    };
  }

  return {
    getSleepQualityLabel,
    snapSleepQualityScore,
    normalizeSleepQualityState,
    applySleepQualityToRecord
  };
});
