const assert = require("node:assert/strict");
const test = require("node:test");

const SleepQuality = require("../src/sleepQuality");

test("maps sleep quality label boundaries", () => {
  const cases = [
    [0, "很不安稳"],
    [20, "很不安稳"],
    [21, "偏疲惫"],
    [40, "偏疲惫"],
    [41, "一般"],
    [60, "一般"],
    [61, "比较安稳"],
    [80, "比较安稳"],
    [81, "很安稳"],
    [100, "很安稳"]
  ];

  cases.forEach(([score, label]) => {
    assert.equal(SleepQuality.getSleepQualityLabel(score), label);
  });
});

test("snaps sleep quality scores to 5 point steps and clamps to 0-100", () => {
  assert.equal(SleepQuality.snapSleepQualityScore(-3), 0);
  assert.equal(SleepQuality.snapSleepQualityScore(62), 60);
  assert.equal(SleepQuality.snapSleepQualityScore(63), 65);
  assert.equal(SleepQuality.snapSleepQualityScore(104), 100);
});

test("normalizes empty state without manufacturing a score", () => {
  const state = SleepQuality.normalizeSleepQualityState(null);

  assert.equal(state.score, null);
  assert.equal(state.label, "");
  assert.equal(state.updatedAt, "");
});

test("applies and clears sleep quality without overwriting report content", () => {
  const base = {
    sleepQuality: "未记录",
    reportContent: {
      dreamResultCard: { coreInsight: "也许在靠近选择。" },
      userReflection: "我想继续观察这个门。"
    }
  };

  const saved = SleepQuality.applySleepQualityToRecord(
    base,
    { score: 65 },
    () => "2026-07-20T10:00:00.000Z"
  );

  assert.equal(saved.sleepQuality, "比较安稳");
  assert.equal(saved.reportContent.sleepQualityScore, 65);
  assert.equal(saved.reportContent.sleepQualityLabel, "比较安稳");
  assert.equal(saved.reportContent.sleepQualityUpdatedAt, "2026-07-20T10:00:00.000Z");
  assert.deepEqual(saved.reportContent.dreamResultCard, base.reportContent.dreamResultCard);
  assert.equal(saved.reportContent.userReflection, base.reportContent.userReflection);

  const cleared = SleepQuality.applySleepQualityToRecord(saved, { score: null });

  assert.equal(cleared.sleepQuality, undefined);
  assert.equal(cleared.reportContent.sleepQualityScore, undefined);
  assert.equal(cleared.reportContent.sleepQualityLabel, undefined);
  assert.equal(cleared.reportContent.sleepQualityUpdatedAt, undefined);
  assert.deepEqual(cleared.reportContent.dreamResultCard, base.reportContent.dreamResultCard);
});
