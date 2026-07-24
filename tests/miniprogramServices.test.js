const assert = require("node:assert/strict");
const test = require("node:test");

function createWxHarness(options = {}) {
  const storage = new Map(Object.entries(options.storage || {}));
  const requests = [];
  const wx = {
    login(payload = {}) {
      const response = typeof options.login === "function"
        ? options.login(payload)
        : { code: "wx-code-1" };
      setImmediate(() => {
        if (response.fail) {
          payload.fail(response.fail);
        } else {
          payload.success(response);
        }
      });
    },
    request(payload) {
      requests.push(payload);
      const response = typeof options.respond === "function"
        ? options.respond(payload)
        : { statusCode: 200, data: { analysis: { dreamSummary: "梦见学校走廊。", coreTheme: "寻找方向。", coreInterpretation: "可能与准备有关。" }, dreamResultCard: { coreInsight: "也许在寻找方向。" } } };
      setImmediate(() => {
        if (response.fail) {
          payload.fail(response.fail);
        } else {
          payload.success(response);
        }
      });
    },
    getStorageSync(key) {
      return storage.has(key) ? storage.get(key) : "";
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
    removeStorageSync(key) {
      storage.delete(key);
    }
  };

  return { wx, requests, storage };
}

test("mini program config, auth, and analytics adapters keep guest fallback and establish explicit WeChat identity", async () => {
  const { getConfig } = require("../miniprogram/config/config.example");
  const auth = require("../miniprogram/services/authAdapter");
  const analytics = require("../miniprogram/services/productAnalyticsAdapter");
  const { wx, requests, storage } = createWxHarness({
    respond: (payload) => {
      if (payload.url.endsWith("/api/v1/wechat-auth/login")) {
        return {
          statusCode: 200,
          data: {
            sessionToken: "wechat-session-token",
            expiresAt: "2026-07-27T00:00:00.000Z",
            account: { mode: "wechat", authenticated: true, cloudSyncAvailable: false }
          }
        };
      }
      if (payload.url.endsWith("/api/v1/wechat-auth/session")) {
        return {
          statusCode: 200,
          data: {
            expiresAt: "2026-07-27T00:00:00.000Z",
            account: { mode: "wechat", authenticated: true, cloudSyncAvailable: false }
          }
        };
      }
      if (payload.url.endsWith("/api/v1/wechat-auth/logout")) {
        return { statusCode: 200, data: { ok: true } };
      }
      return { statusCode: 500, data: { error: { code: "UPSTREAM_UNAVAILABLE" } } };
    }
  });
  const config = getConfig();
  assert.equal(config.API_BASE_URL, "https://dream-anatomy.onrender.com");
  assert.equal(config.REQUEST_TIMEOUT_MS, 45000);
  auth.clearLocalSession({ wx });
  assert.deepEqual(auth.getAuthState(), { mode: "guest", authenticated: false, cloudSyncAvailable: false });
  assert.deepEqual(await auth.initialize({ wx }), { mode: "guest", authenticated: false, cloudSyncAvailable: false });

  const loggedIn = await auth.login({ wx });
  assert.deepEqual(loggedIn, { mode: "wechat", authenticated: true, cloudSyncAvailable: false });
  assert.equal(await auth.getAccessToken({ wx }), "wechat-session-token");
  assert.equal(storage.has(auth.WECHAT_SESSION_TOKEN_KEY), true);
  assert.equal(requests[0].url, "https://dream-anatomy.onrender.com/api/v1/wechat-auth/login");
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].data.code, "wx-code-1");
  assert.equal(Object.hasOwn(requests[0].data, "openid"), false);
  assert.equal(Object.hasOwn(requests[0].data, "accountId"), false);

  const restored = await auth.initialize({ wx });
  assert.deepEqual(restored, { mode: "wechat", authenticated: true, cloudSyncAvailable: false });
  assert.equal(requests[1].url, "https://dream-anatomy.onrender.com/api/v1/wechat-auth/session");
  assert.equal(requests[1].header.Authorization, "Bearer wechat-session-token");

  assert.deepEqual(await auth.logout({ wx }), { mode: "guest", authenticated: false, cloudSyncAvailable: false });
  assert.equal(requests[2].url, "https://dream-anatomy.onrender.com/api/v1/wechat-auth/logout");
  assert.equal(requests[2].header.Authorization, "Bearer wechat-session-token");
  assert.equal(storage.has(auth.WECHAT_SESSION_TOKEN_KEY), false);
  assert.deepEqual(auth.getAuthState(), { mode: "guest", authenticated: false, cloudSyncAvailable: false });
  assert.equal(auth.isCloudSyncAvailable(), false);
  assert.equal(analytics.trackEvent("app_opened"), false);
  assert.equal(analytics.flush(), false);
  auth.clearLocalSession({ wx });
});

test("mini program auth clears invalid local session and keeps guest features available", async () => {
  const auth = require("../miniprogram/services/authAdapter");
  const { wx, storage } = createWxHarness({
    storage: { [auth.WECHAT_SESSION_TOKEN_KEY]: "expired-token" },
    respond: () => ({
      statusCode: 401,
      data: { error: { code: "AUTH_INVALID", message: "微信登录状态已失效，请重新登录。" } }
    })
  });

  assert.deepEqual(await auth.initialize({ wx }), { mode: "guest", authenticated: false, cloudSyncAvailable: false });
  assert.equal(storage.has(auth.WECHAT_SESSION_TOKEN_KEY), false);
  await assert.rejects(
    () => auth.login({ wx: createWxHarness({ login: () => ({ fail: { errMsg: "login failed" } }) }).wx }),
    (error) => /微信身份/.test(error.message)
  );
  assert.deepEqual(auth.getAuthState(), { mode: "guest", authenticated: false, cloudSyncAvailable: false });
});

test("quick analysis request uses Render backend structure and no Authorization header", async () => {
  const { requestQuickAnalysis } = require("../miniprogram/services/apiClient");
  const { wx, requests } = createWxHarness({
    respond: () => ({
      statusCode: 200,
      data: {
        analysis: {
          dreamSummary: "你梦见自己在学校走廊寻找教室。",
          coreTheme: "寻找方向与准备感。",
          coreInterpretation: "这可能与最近正在靠近某个选择有关。"
        },
        dreamResultCard: { coreInsight: "也许你正在靠近一个还没准备好的入口。" },
        dreamResultCardStatus: "ai_generated"
      }
    })
  });

  const result = await requestQuickAnalysis("梦见在学校找教室", { wx });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://dream-anatomy.onrender.com/api/v1/dream-analysis");
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].timeout, 45000);
  assert.equal(requests[0].header["Content-Type"], "application/json");
  assert.equal(Object.hasOwn(requests[0].header, "Authorization"), false);
  assert.deepEqual(requests[0].data, {
    analysisType: "quick",
    dreamText: "梦见在学校找教室",
    clientPlatform: "wechat_mini_program"
  });
  assert.equal(result.analysis.dreamSummary, "你梦见自己在学校走廊寻找教室。");
  assert.equal(result.dreamResultCardStatus, "ai_generated");
});

test("quick analysis maps stable errors and never falls back to local mock", async () => {
  const { requestQuickAnalysis } = require("../miniprogram/services/apiClient");
  const { mapApiError } = require("../miniprogram/services/errorMessages");

  assert.match(mapApiError("DAILY_LIMIT_REACHED"), /免费整理次数/);
  assert.match(mapApiError("RATE_LIMITED"), /太频繁/);
  assert.match(mapApiError("UPSTREAM_TIMEOUT"), /及时回应/);
  assert.match(mapApiError("FEATURE_DISABLED"), /正在开发/);

  const { wx } = createWxHarness({
    respond: () => ({
      statusCode: 429,
      data: { error: { code: "DAILY_LIMIT_REACHED", message: "今天的免费解析次数已经用完，稍后再来继续记录梦境。" } }
    })
  });

  await assert.rejects(
    () => requestQuickAnalysis("梦见海", { wx }),
    (error) => error.code === "DAILY_LIMIT_REACHED" && /免费整理次数/.test(error.message) && !/mock|示例/.test(error.message)
  );

  const failed = createWxHarness({ respond: () => ({ fail: { errMsg: "request:fail timeout" } }) });
  await assert.rejects(
    () => requestQuickAnalysis("梦见海", { wx: failed.wx }),
    (error) => error.code === "NETWORK_ERROR" && !/mock|示例/.test(error.message)
  );
});

test("quick analysis controller prevents duplicate submit while in flight", async () => {
  const { createQuickAnalysisController } = require("../miniprogram/services/apiClient");
  let resolveRequest;
  let count = 0;
  const controller = createQuickAnalysisController({
    requestQuickAnalysis: async () => {
      count += 1;
      return new Promise((resolve) => { resolveRequest = resolve; });
    }
  });

  const first = controller.submit("梦见飞行");
  const second = controller.submit("梦见飞行");
  assert.equal(controller.isSubmitting(), true);
  assert.strictEqual(first, second);
  assert.equal(count, 1);

  resolveRequest({ analysis: { dreamSummary: "梦见飞行。" } });
  const result = await first;
  assert.equal(result.analysis.dreamSummary, "梦见飞行。");
  assert.equal(controller.isSubmitting(), false);
});

test("dream storage saves, reads, exports, deletes, clears, and enforces schema limits", () => {
  const { createDreamStorage, STORAGE_KEY, STORAGE_VERSION, MAX_RECORDS } = require("../miniprogram/services/dreamStorage");
  const { wx } = createWxHarness();
  const storage = createDreamStorage(wx);

  const saved = storage.saveRecord({
    dreamText: "梦见一条河",
    sleepQuality: "未记录",
    analysisType: "快速解析",
    reportContent: { analysis: { dreamSummary: "河流梦。" } },
    dreamResultCard: { coreInsight: "也许在流动。" }
  });

  assert.equal(saved.ok, true);
  assert.equal(saved.record.storageVersion, STORAGE_VERSION);
  assert.match(saved.record.localRecordId, /^local_/);
  assert.equal(storage.getRecords().length, 1);
  assert.equal(storage.getRecord(saved.record.localRecordId).dreamText, "梦见一条河");

  const exported = storage.exportRecords();
  assert.equal(exported.exportVersion, 1);
  assert.equal(exported.records.length, 1);
  assert.doesNotMatch(JSON.stringify(exported), /token|principal_hash|Authorization/i);

  assert.equal(storage.deleteRecord(saved.record.localRecordId).ok, true);
  assert.equal(storage.getRecords().length, 0);

  wx.setStorageSync(STORAGE_KEY, "{bad json");
  assert.deepEqual(storage.getRecords(), []);

  wx.setStorageSync(STORAGE_KEY, []);
  for (let index = 0; index < MAX_RECORDS; index += 1) {
    assert.equal(storage.saveRecord({ dreamText: `梦 ${index}`, reportContent: {}, dreamResultCard: null }).ok, true);
  }
  const overflow = storage.saveRecord({ dreamText: "第 101 个梦", reportContent: {}, dreamResultCard: null });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.code, "LOCAL_RECORD_LIMIT_REACHED");
  assert.match(overflow.message, /导出或删除旧记录/);

  assert.equal(storage.clearRecords().ok, true);
  assert.equal(storage.getRecords().length, 0);
});

test("mini program legal versions match Web and guest consent follows versions", () => {
  const webLegal = require("../src/legalDocuments");
  const miniLegal = require("../miniprogram/services/legalDocuments");
  const miniSource = require("node:fs").readFileSync(require("node:path").join(__dirname, "../miniprogram/services/legalDocuments.js"), "utf8");
  const { wx } = createWxHarness();

  assert.doesNotMatch(miniSource, /\.\.\/\.\.\/src\/legalDocuments/);
  assert.deepEqual(miniLegal.getLegalVersions(), {
    privacyPolicyVersion: webLegal.PRIVACY_POLICY_VERSION,
    termsVersion: webLegal.TERMS_VERSION,
    aiDisclaimerVersion: webLegal.AI_DISCLAIMER_VERSION,
    crossBorderConsentVersion: webLegal.CROSS_BORDER_CONSENT_VERSION
  });
  assert.equal(miniLegal.hasAcceptedLegalVersions(wx), false);
  miniLegal.saveGuestLegalConsent(wx);
  assert.equal(miniLegal.hasAcceptedLegalVersions(wx), true);
  wx.setStorageSync(miniLegal.LEGAL_CONSENT_KEY, {
    privacyPolicyVersion: "old",
    termsVersion: webLegal.TERMS_VERSION,
    aiDisclaimerVersion: webLegal.AI_DISCLAIMER_VERSION,
    crossBorderConsentVersion: webLegal.CROSS_BORDER_CONSENT_VERSION
  });
  assert.equal(miniLegal.hasAcceptedLegalVersions(wx), false);
  wx.setStorageSync(miniLegal.LEGAL_CONSENT_KEY, {
    privacyPolicyVersion: webLegal.PRIVACY_POLICY_VERSION,
    termsVersion: webLegal.TERMS_VERSION,
    aiDisclaimerVersion: webLegal.AI_DISCLAIMER_VERSION
  });
  assert.equal(miniLegal.hasAcceptedLegalVersions(wx), false);

  assert.equal(miniLegal.getLegalDocument("privacy").title, "隐私政策");
  assert.equal(miniLegal.getLegalDocument("terms").title, "用户协议");
  assert.equal(miniLegal.getLegalDocument("ai").title, "AI 使用说明");
  assert.equal(miniLegal.getLegalDocument("cross-border").title, "境外处理说明");

  const aiDocument = JSON.stringify(miniLegal.getLegalDocument("ai"));
  const privacyDocument = JSON.stringify(miniLegal.getLegalDocument("privacy"));
  assert.match(aiDocument, /本功能不是解梦、算命、占卜、吉凶判断或未来预测服务/);
  assert.match(aiDocument, /摘要整理、情绪词识别、意象关键词整理/);
  assert.doesNotMatch(`${aiDocument}\n${privacyDocument}`, /AI 解梦|梦境解析|象征解释|潜意识分析/);
});

test("result card normalization avoids fake zero scores and unsafe text", () => {
  const { hasResultCard, normalizeResultCard } = require("../miniprogram/services/resultCard");
  assert.equal(hasResultCard({}), false);
  assert.equal(hasResultCard({ coreInsight: "只有一句话" }), false);
  assert.equal(hasResultCard({
    archetype: { id: "seeker" },
    coreInsight: "这个梦可能与你正在寻找方向有关。",
    dimensions: [{ id: "symbol_depth", score: 55, rationale: ["门出现在梦里。"] }]
  }), false);
  assert.equal(hasResultCard({
    archetype: { id: "unknown" },
    coreInsight: "这个梦可能与你正在寻找方向有关。",
    dimensions: [
      { id: "symbol_depth", score: 55, rationale: ["门出现在梦里。"] },
      { id: "emotion_intensity", score: 62, rationale: ["紧张来自寻找。"] },
      { id: "self_awareness", score: 48, rationale: ["梦里有观察。"] },
      { id: "growth_signal", score: 50, rationale: ["出现选择线索。"] }
    ]
  }), false);
  assert.equal(hasResultCard({
    archetype: { id: "creator" },
    coreInsight: "这个梦可能与你正在寻找方向有关。",
    dimensions: [
      { id: "symbol_depth", score: 55, rationale: ["门出现在梦里。"] },
      { id: "emotion_intensity", score: 62, rationale: ["紧张来自寻找。"] },
      { id: "self_awareness", score: 48, rationale: ["梦里有观察。"] },
      { id: "growth_signal", score: 50, rationale: ["出现选择线索。"] }
    ]
  }), true);

  const card = normalizeResultCard({
    archetype: { id: "creator", summary: "你就是创造者", evidence: ["梦里有一扇门。"] },
    coreInsight: "这个梦可能与你正在寻找方向有关。",
    dimensions: [{ id: "symbol_depth", score: "", summary: "门和走廊是线索。", rationale: ["门出现在梦里。"] }],
    symbols: [{ name: "门", contextMeaning: "可能与选择有关。", evidence: "梦里出现门。", reflectionQuestion: "门让你想到什么？" }],
    emotionalProfile: { primary: "紧张", intensity: "", evidence: "找不到教室。" },
    reflectionQuestions: ["这扇门让你想到什么？"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  });

  assert.equal(card.archetype.nameZh, "创造者");
  assert.equal(card.archetype.summary.includes("你就是"), false);
  assert.equal(card.dimensions[0].score, null);
  assert.equal(card.emotionalProfile.intensity, null);
  assert.equal(card.symbols.length, 1);
});

test("compliance text lowers high-risk AI display terms without mutating records", () => {
  const {
    formatMiniProgramAnalysisType,
    sanitizeComplianceObject,
    sanitizeComplianceText
  } = require("../miniprogram/utils/complianceText");

  assert.equal(sanitizeComplianceText("这个梦预示着命运改变"), "这个记录片段可能让你联想到生活体验改变");
  assert.equal(formatMiniProgramAnalysisType("快速解析"), "AI 整理");
  assert.equal(formatMiniProgramAnalysisType("深度引导"), "深度记录");

  const raw = {
    insight: "潜意识告诉你这意味着机会",
    nested: { text: "梦境解析和梦境画像" },
    list: ["象征着变化", "吉凶判断"]
  };
  const cleaned = sanitizeComplianceObject(raw);

  assert.notStrictEqual(cleaned, raw);
  assert.equal(raw.insight, "潜意识告诉你这意味着机会");
  assert.doesNotMatch(JSON.stringify(cleaned), /潜意识告诉你|意味着|梦境解析|梦境画像|象征着|吉凶/);
});

test("mini program display titles sanitize saved AI summaries without mutating records", () => {
  const { createMiniProgramDisplayTitle } = require("../miniprogram/utils/complianceText");
  const record = {
    dreamText: "我梦见一扇门",
    reportContent: {
      analysis: {
        dreamSummary: "这个梦预示着命运改变，也有梦境画像线索。"
      }
    }
  };

  const title = createMiniProgramDisplayTitle(record);
  assert.equal(record.reportContent.analysis.dreamSummary, "这个梦预示着命运改变，也有梦境画像线索。");
  assert.doesNotMatch(title, /预示|命运|梦境画像/);
  assert.match(title, /记录片段|生活体验|梦境线索卡/);
});
