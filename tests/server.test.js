const assert = require("node:assert/strict");
const test = require("node:test");

process.env.DEEPSEEK_API_KEY = "test-key";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-key";
process.env.AI_GUEST_DAILY_LIMIT = "100";
process.env.AI_USER_DAILY_LIMIT = "100";
process.env.AI_GUEST_REQUESTS_PER_MINUTE = "100";
process.env.AI_USER_REQUESTS_PER_MINUTE = "100";
process.env.AI_MAX_CONCURRENT_PER_PRINCIPAL = "1";
process.env.AI_REQUEST_TIMEOUT_MS = "45000";
process.env.DEEP_GUIDANCE_ENABLED = "false";

const { app } = require("../server");
const { createAiAccessControl } = require("../server/aiAccessControl");

function createResultCardPayload() {
  return {
    archetype: {
      id: "seeker",
      summary: "本次梦境更接近寻路者，也许与你正在寻找方向有关。",
      evidence: ["你反复寻找教室。", "门发着光但你停在门前。"]
    },
    coreInsight: "这个梦也许在邀请你留意正在靠近的选择。",
    dimensions: [
      { id: "symbol_depth", score: 88, summary: "门和走廊带来方向线索。", rationale: ["走廊和门形成过渡主题。", "寻找教室让方向感更清晰。"] },
      { id: "emotion_intensity", score: 0, summary: "情绪线索较轻。", rationale: ["梦中停留在走廊。", "紧张感来自找不到教室。"] },
      { id: "self_awareness", score: 42, summary: "你注意到门的存在。", rationale: ["门是清晰画面。", "你能描述停在门前的状态。"] },
      { id: "growth_signal", score: 76, summary: "也许值得继续观察。", rationale: ["发光的门带来靠近新方向的线索。", "寻找教室暗示仍在准备。"] }
    ],
    symbols: [
      { name: "门", generalPossibility: "门有时与选择有关。", contextMeaning: "在这次梦里可能与方向有关。", evidence: "梦里出现一扇门。", reflectionQuestion: "这扇门让你想到什么？" },
      { name: "走廊", generalPossibility: "走廊有时与过渡有关。", contextMeaning: "可能与正在经历的阶段有关。", evidence: "梦里在学校走廊。", reflectionQuestion: "你想走向哪里？" },
      { name: "学校", generalPossibility: "学校有时与学习有关。", contextMeaning: "可能与你熟悉的经历有关。", evidence: "地点是学校。", reflectionQuestion: "这让你想起什么？" },
      { name: "窗", generalPossibility: "窗有时与视野有关。", contextMeaning: "可能带来新的看法。", evidence: "窗在远处。", reflectionQuestion: "你看见了什么？" }
    ],
    emotionalProfile: { primary: "好奇", secondary: ["迟疑"], intensity: 72, evidence: "你停在门前。" },
    reflectionQuestions: ["哪个画面最想被你记住？"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
}

function createQuickAnalysisPayload() {
  return {
    dreamSummary: "你梦见自己在学校走廊里反复寻找教室，始终没有到达，最后停在一扇发光的门前。这个梦的重点似乎集中在寻找、迟疑和接近某个入口的过程。",
    coreTheme: "这个梦更像是在围绕寻找方向、准备不足和靠近选择的感受展开。",
    coreInterpretation: "梦中“反复寻找教室却始终没有到达”是实际发生的情节，它可能与一种追赶、准备或被评价的感受有关；而“发光的门”则是另一个具体画面，也许可以理解为你已经看见某个可能的入口，却还在门前停留。这样的理解并不是在判断现实中发生了什么，而是把梦里的寻找和停顿当作线索，帮助你观察最近是否有需要准备、靠近或做选择的事情。",
    evidence: [
      {
        dreamFragment: "反复寻找教室却始终没有到达",
        interpretation: "这个片段支持“追赶、准备或被评价感”的分析，因为教室在这次梦里处在一直想找到却找不到的位置。"
      },
      {
        dreamFragment: "停在一扇发光的门前",
        interpretation: "这个片段支持“靠近选择”的分析，因为门已经出现，但梦里的你还没有真正进入。"
      }
    ],
    emotionalReading: {
      primaryEmotion: "紧张",
      secondaryEmotions: ["迟疑", "好奇"],
      intensity: 68,
      evidence: "紧张主要来自反复寻找教室却始终没有到达，迟疑和好奇则来自发光的门。"
    },
    symbolReading: [
      {
        symbol: "教室",
        context: "教室是这次梦里一直想找到却找不到的地点。",
        possibleMeaning: "在这次语境中，它可能与准备、学习或被评价的感受有关。",
        evidence: "你反复寻找教室，却始终没有到达。",
        reflectionQuestion: "最近有什么事情让你感觉自己还没有准备好进入？"
      },
      {
        symbol: "发光的门",
        context: "门出现在寻找之后，像一个被看见但还没进入的入口。",
        possibleMeaning: "它也许和某个选择、边界或新的方向有关。",
        evidence: "你最后停在一扇发光的门前。",
        reflectionQuestion: "如果这扇门可以打开，你希望门后是什么？"
      }
    ],
    reflectionQuestions: [
      "最近有什么事情让你感觉一直在寻找却还没到达？",
      "梦里的教室让你想到现实中哪一种准备或评价？",
      "停在发光的门前时，你更想靠近还是先观察？"
    ],
    gentleAction: "你可以用两分钟写下：梦里最让你着急的寻找片段，以及现实中是否有一个类似的准备感。",
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
}

function createDeepAnalysisPayload() {
  return {
    summary: "你梦见在学校走廊寻找教室，并在门前停下。",
    emotionClues: "你回答自己最明显的感受是紧张，这让梦里的寻找更像一种压力线索。",
    coreImages: "教室、走廊和门是这次梦里较清晰的意象。",
    jungianView: "从荣格式视角看，这也许是在靠近一个还没完全准备好的内在主题。",
    lifeConnection: "你提到最近有考试压力，这个回答可能与梦中的寻找和停顿互相呼应。",
    reflectionQuestions: "你可以思考：那扇门让你想靠近，还是想停下来？",
    smallAction: "今天可以用一句话写下你想准备的一件小事。",
    gentleReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  };
}

async function withServer(run, options = {}) {
  app.locals.aiAccessControl = options.accessControl || createAiAccessControl({
    guestDailyLimit: 100,
    userDailyLimit: 100,
    guestRequestsPerMinute: 100,
    userRequestsPerMinute: 100,
    maxConcurrentPerPrincipal: 1
  });
  if (options.authResolver) {
    app.locals.aiAuthResolver = options.authResolver;
  }
  if (options.requestTimeoutMs !== undefined) {
    app.locals.aiRequestTimeoutMs = options.requestTimeoutMs;
  }
  if (Object.prototype.hasOwnProperty.call(options, "analyticsClient")) {
    app.locals.analyticsClient = options.analyticsClient;
  }
  if (options.analyticsEnv) {
    app.locals.analyticsEnv = options.analyticsEnv;
  }
  if (options.adminEnv) {
    app.locals.adminEnv = options.adminEnv;
  }
  if (options.analyticsLogger) {
    app.locals.analyticsLogger = options.analyticsLogger;
  }
  if (options.awaitAnalyticsWrites !== undefined) {
    app.locals.awaitAnalyticsWrites = options.awaitAnalyticsWrites;
  }
  if (options.accountDeletionService) {
    app.locals.accountDeletionService = options.accountDeletionService;
  }

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    delete app.locals.aiAccessControl;
    delete app.locals.aiAuthResolver;
    delete app.locals.aiRequestTimeoutMs;
    delete app.locals.analyticsClient;
    delete app.locals.analyticsEnv;
    delete app.locals.adminEnv;
    delete app.locals.analyticsLogger;
    delete app.locals.awaitAnalyticsWrites;
    delete app.locals.accountDeletionService;
  }
}

async function postDreamAnalysis(baseUrl, body, options = {}) {
  return fetch(`${baseUrl}${options.path || "/api/dream-analysis"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify(body)
  });
}

async function deleteAccount(baseUrl, body, options = {}) {
  return fetch(`${baseUrl}/api/v1/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify(body)
  });
}

test("runtime environment response is not cached", { concurrency: false }, async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/runtime-env.js`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("account deletion route returns no-store success responses", { concurrency: false }, async () => {
  const calls = [];
  await withServer(async (baseUrl) => {
    const response = await deleteAccount(baseUrl, { confirmation: "注销账户" }, {
      headers: { Authorization: "Bearer token" }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(payload, { ok: true, requestId: "request-1" });
    assert.equal(calls.length, 1);
  }, {
    accountDeletionService: {
      deleteAccount: async (request) => {
        calls.push({
          authorization: request.headers.authorization,
          body: request.body
        });
        return { ok: true, requestId: "request-1" };
      }
    }
  });
});

test("account deletion route formats safe stable errors", { concurrency: false }, async () => {
  await withServer(async (baseUrl) => {
    const response = await deleteAccount(baseUrl, { confirmation: "bad" });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(payload.error, {
      code: "INVALID_REQUEST",
      message: "请输入正确确认文字后再注销账户。"
    });
    assert.equal(payload.requestId, "request-1");
    assert.doesNotMatch(JSON.stringify(payload), /stack|token|service_role/i);
  }, {
    accountDeletionService: {
      deleteAccount: async () => {
        const error = new Error("请输入正确确认文字后再注销账户。");
        error.code = "INVALID_REQUEST";
        error.status = 400;
        error.requestId = "request-1";
        throw error;
      }
    }
  });
});

test("returns a normalized result card from strict DeepSeek JSON", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(createResultCardPayload()) } }] })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "学校走廊里的门",
        analysisType: "result_card"
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(payload.analysis.dimensions.map((dimension) => dimension.score), [88, 0, 42, 76]);
      assert.equal(payload.analysis.symbols.length, 3);
      assert.equal(payload.analysis.emotionalProfile.intensity, 72);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("rejects incomplete standalone result-card generations before saving partial scores", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    const partialCard = createResultCardPayload();
    partialCard.dimensions = [
      {
        id: "symbol_depth",
        score: 70,
        summary: "学校走廊和门提供了一些象征线索。",
        rationale: ["学校走廊和门形成过渡线索。"]
      }
    ];
    partialCard.emotionalProfile = {
      primary: "迟疑",
      secondary: ["好奇"],
      intensity: null,
      evidence: "梦里停在门前。"
    };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(partialCard) } }] })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里看见一扇门，停在门前很久。",
        analysisType: "result_card"
      });
      const payload = await response.json();

      assert.equal(response.status, 422);
      assert.equal(payload.error.code, "GENERATION_INCOMPLETE");
      assert.equal(payload.analysis, undefined);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("rejects standalone result-card generations with out-of-range raw scores", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    const partialCard = createResultCardPayload();
    partialCard.dimensions[0].score = 140;
    partialCard.emotionalProfile.intensity = -1;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(partialCard) } }] })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "学校走廊里的门",
        analysisType: "result_card"
      });
      const payload = await response.json();

      assert.equal(response.status, 422);
      assert.equal(payload.error.code, "GENERATION_INCOMPLETE");
      assert.equal(payload.analysis, undefined);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("rejects standalone result-card generations with fallback-filled core fields", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    const partialCard = createResultCardPayload();
    partialCard.coreInsight = "";
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(partialCard) } }] })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "学校走廊里的门",
        analysisType: "result_card"
      });
      const payload = await response.json();

      assert.equal(response.status, 422);
      assert.equal(payload.error.code, "GENERATION_INCOMPLETE");
      assert.equal(payload.generationMeta.source, "generation_failed");
      assert.equal(payload.analysis, undefined);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("returns quick analysis and result card from one final request", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  const upstreamCalls = [];
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamCalls.push([url, options]);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal(upstreamCalls.length, 1);
      assert.match(JSON.parse(upstreamCalls[0][1].body).messages[1].content, /promptVersion/);
      assert.match(JSON.parse(upstreamCalls[0][1].body).messages[1].content, /dreamSummary/);
      assert.match(JSON.parse(upstreamCalls[0][1].body).messages[1].content, /至少引用两个/);
      assert.equal(payload.dreamResultCardStatus, "ai_generated");
      assert.equal(payload.generationMeta.source, "ai_generated");
      assert.equal(payload.generationMeta.promptVersion, "quick-analysis-v2");
      assert.equal(payload.generationMeta.qualityStatus, "passed");
      assert.equal(payload.usage.authenticated, false);
      assert.equal(payload.usage.limit, 100);
      assert.equal(payload.usage.remaining, 99);
      assert.equal(payload.analysis.dreamSummary, createQuickAnalysisPayload().dreamSummary);
      assert.equal(payload.analysis.coreTheme, createQuickAnalysisPayload().coreTheme);
      assert.equal(payload.analysis.evidence.length, 2);
      assert.equal(payload.analysis.emotionalReading.primaryEmotion, "紧张");
      assert.equal(payload.analysis.symbolReading.length, 2);
      assert.equal(payload.dreamResultCard.archetype.nameZh, "寻路者");
      assert.deepEqual(payload.dreamResultCard.dimensions.map((dimension) => dimension.score), [88, 0, 42, 76]);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("v1 dream-analysis route uses the same protected handler as the legacy alias", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      }, { path: "/api/v1/dream-analysis" });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.analysis.coreTheme, createQuickAnalysisPayload().coreTheme);
      assert.equal(payload.usage.remaining, 99);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("retries quick analysis once when the first response is too short", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  const upstreamBodies = [];
  const inserted = [];
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamBodies.push(JSON.parse(options.body));
    const firstAttempt = upstreamBodies.length === 1;
    return {
      ok: true,
      json: async () => ({
        usage: firstAttempt
          ? { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }
          : { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        choices: [{
          message: {
            content: JSON.stringify(firstAttempt
              ? {
                  analysis: {
                    ...createQuickAnalysisPayload(),
                    coreInterpretation: "这个梦可能和压力有关。",
                    evidence: createQuickAnalysisPayload().evidence.slice(0, 1)
                  },
                  dreamResultCard: createResultCardPayload()
                }
              : {
                  analysis: createQuickAnalysisPayload(),
                  dreamResultCard: createResultCardPayload()
                })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(upstreamBodies.length, 2);
      assert.match(upstreamBodies[1].messages[1].content, /上一次输出没有通过质量检查/);
      assert.equal(payload.analysis.evidence.length, 2);
      assert.equal(payload.generationMeta.qualityStatus, "passed");
      assert.equal(payload.usage.remaining, 99);
      assert.equal(inserted.length, 1);
      assert.equal(inserted[0].quality_retry_count, 1);
      assert.equal(inserted[0].prompt_tokens, 110);
      assert.equal(inserted[0].completion_tokens, 220);
      assert.equal(inserted[0].total_tokens, 330);
    }, {
      analyticsClient: {
        from: () => ({
          insert: async (event) => {
            inserted.push(event);
            return { error: null };
          }
        })
      },
      analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" },
      awaitAnalyticsWrites: true
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("returns an incomplete quick generation error after repeated quality failures", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  let upstreamCalls = 0;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamCalls += 1;
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: {
                ...createQuickAnalysisPayload(),
                coreInterpretation: "这个梦可能和压力有关。",
                evidence: []
              },
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const payload = await response.json();

      assert.equal(response.status, 422);
      assert.equal(upstreamCalls, 2);
      assert.equal(payload.error.code, "GENERATION_INCOMPLETE");
      assert.equal(payload.generationMeta.source, "generation_failed");
      assert.equal(payload.generationMeta.qualityStatus, "incomplete");
      assert.equal(payload.usage.remaining, 99);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("rejects guided questions while deep guidance is disabled before calling DeepSeek", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  let upstreamCalls = 0;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamCalls += 1;
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              questions: [
                { id: "emotion", label: "情绪", question: "在寻找教室时，最明显的感受是什么？", placeholder: "可以写紧张、着急或别的感受。" },
                { id: "association", label: "联想", question: "这间教室让你想到现实中的什么场景？", placeholder: "可以写一个最近想到的场景。" },
                { id: "lifeLink", label: "现实连接", question: "最近有没有让你觉得需要赶上的事情？", placeholder: "只写愿意记录的部分。" }
              ]
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我一直找不到教室。",
        analysisType: "guided_questions"
      });
      const payload = await response.json();

      assert.equal(response.status, 403);
      assert.equal(payload.error.code, "FEATURE_DISABLED");
      assert.equal(upstreamCalls, 0);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("rejects guided final while deep guidance is disabled before calling DeepSeek", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  const upstreamBodies = [];
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamBodies.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createDeepAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我一直找不到教室。",
        analysisType: "guided_final",
        guidedAnswers: {
          emotion: "紧张",
          lifeLink: "最近有考试压力"
        }
      });
      const payload = await response.json();

      assert.equal(response.status, 403);
      assert.equal(payload.error.code, "FEATURE_DISABLED");
      assert.equal(upstreamBodies.length, 0);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("rejects quick-shaped JSON for guided final analysis", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              dreamSummary: "你在学校走廊看见一扇门。",
              coreEmotion: "好奇",
              symbols: ["学校", "走廊", "门"],
              jungianInterpretation: "这也许与你正在留意新的方向有关。",
              reflectionQuestions: ["这扇门让你想到什么？"],
              gentleReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我一直找不到教室。",
        analysisType: "guided_final",
        guidedAnswers: { emotion: "紧张" }
      });

      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, "FEATURE_DISABLED");
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("keeps text analysis readable when combined result card is invalid", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: {}
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.analysis.dreamSummary, createQuickAnalysisPayload().dreamSummary);
      assert.equal(payload.dreamResultCardStatus, "generation_failed");
      assert.equal(payload.dreamResultCard, undefined);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("does not accept non-numeric result-card scores as generated zeros", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    const invalidScoreCard = createResultCardPayload();
    const invalidScores = ["   ", false, [], "abc"];
    invalidScoreCard.dimensions = invalidScoreCard.dimensions.map((dimension) => ({
      ...dimension,
      score: invalidScores.shift()
    }));
    invalidScoreCard.emotionalProfile = {
      ...invalidScoreCard.emotionalProfile,
      intensity: false
    };
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: invalidScoreCard
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.analysis.coreTheme, createQuickAnalysisPayload().coreTheme);
      assert.equal(payload.dreamResultCardStatus, "generation_failed");
      assert.equal(payload.dreamResultCard, undefined);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("returns only a safe error when result-card model JSON is invalid", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return { ok: true, json: async () => ({ choices: [{ message: { content: "not json" } }] }) };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "学校走廊里的门",
        analysisType: "result_card"
      });
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error.code, "UPSTREAM_UNAVAILABLE");
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("returns only a safe error when result-card JSON has no result-card shape", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({}) } }] }) };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "学校走廊里的门",
        analysisType: "result_card"
      });
      assert.equal(response.status, 422);
      assert.equal((await response.json()).error.code, "GENERATION_INCOMPLETE");
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("returns only a safe error when result-card JSON uses quick-analysis shape", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              dreamSummary: "你在学校走廊看见一扇门。",
              coreEmotion: "好奇",
              symbols: ["学校", "走廊", "门"],
              jungianInterpretation: "这也许与你正在留意新的方向有关。",
              reflectionQuestions: ["这扇门让你想到什么？"],
              gentleReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "学校走廊里的门",
        analysisType: "result_card"
      });
      assert.equal(response.status, 422);
      assert.equal((await response.json()).error.code, "GENERATION_INCOMPLETE");
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("continues to reject unsupported deep analysis", { concurrency: false }, async () => {
  await withServer(async (baseUrl) => {
    const response = await postDreamAnalysis(baseUrl, {
      dreamText: "学校走廊里的门",
      analysisType: "deep"
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_REQUEST");
  });
});

test("rejects legacy quick analysis shape after the quality retry", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  let upstreamCalls = 0;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamCalls += 1;
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              dreamSummary: "你在学校走廊看见一扇门。",
              coreEmotion: "好奇",
              symbols: ["学校", "走廊", "门"],
              jungianInterpretation: "这也许与你正在留意新的方向有关。",
              reflectionQuestions: ["这扇门让你想到什么？"],
              gentleReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "学校走廊里的门",
        analysisType: "quick"
      });
      const payload = await response.json();
      assert.equal(response.status, 422);
      assert.equal(upstreamCalls, 2);
      assert.equal(payload.generationMeta.qualityStatus, "incomplete");
      assert.equal(payload.error.code, "GENERATION_INCOMPLETE");
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("invalid Authorization returns AUTH_INVALID and does not call DeepSeek", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  let upstreamCalls = 0;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamCalls += 1;
    return { ok: true, json: async () => ({}) };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "学校走廊里的门",
        analysisType: "quick"
      }, {
        headers: { Authorization: "Token bad" }
      });
      const payload = await response.json();

      assert.equal(response.status, 401);
      assert.equal(payload.error.code, "AUTH_INVALID");
      assert.equal(upstreamCalls, 0);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("successful authenticated request uses user quota metadata", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick",
        userId: "forged-user"
      }, {
        headers: { Authorization: "Bearer valid-token" }
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.usage.authenticated, true);
      assert.equal(payload.usage.limit, 5);
      assert.equal(payload.usage.remaining, 4);
    }, {
      authResolver: {
        resolveIdentity: async () => ({
          type: "authenticated",
          userId: "real-user",
          rateLimitKey: "user:real-user"
        })
      },
      accessControl: createAiAccessControl({
        userDailyLimit: 5,
        userRequestsPerMinute: 5,
        guestDailyLimit: 1,
        guestRequestsPerMinute: 1,
        maxConcurrentPerPrincipal: 1
      })
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("successful quick analysis records one analytics event", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  const inserted = [];
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 1000, completion_tokens: 2000, total_tokens: 3000 },
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.analysis.coreTheme, createQuickAnalysisPayload().coreTheme);
      assert.equal(inserted.length, 1);
      assert.equal(inserted[0].analysis_type, "quick");
      assert.equal(inserted[0].outcome, "success");
      assert.equal(inserted[0].prompt_tokens, 1000);
      assert.equal(inserted[0].completion_tokens, 2000);
      assert.equal(inserted[0].total_tokens, 3000);
      assert.equal(inserted[0].estimated_cost_usd, 0.005);
      assert.match(inserted[0].principal_hash, /^[a-f0-9]{64}$/);
      assert.doesNotMatch(JSON.stringify(inserted[0]), /学校走廊|test-key|Bearer/);
    }, {
      analyticsClient: {
        from: () => ({
          insert: async (event) => {
            inserted.push(event);
            return { error: null };
          }
        })
      },
      analyticsEnv: {
        ANALYTICS_HASH_SECRET: "analytics-secret",
        AI_INPUT_COST_PER_1M_TOKENS: "1",
        AI_OUTPUT_COST_PER_1M_TOKENS: "2"
      },
      awaitAnalyticsWrites: true
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("analytics insert failure does not affect quick analysis", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.analysis.coreTheme, createQuickAnalysisPayload().coreTheme);
    }, {
      analyticsClient: {
        from: () => ({
          insert: async () => ({ error: new Error("db unavailable") })
        })
      },
      analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" },
      awaitAnalyticsWrites: true,
      analyticsLogger: { warn() {} }
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("disabled guided analysis does not record normal analytics event", { concurrency: false }, async () => {
  const inserted = [];

  await withServer(async (baseUrl) => {
    const response = await postDreamAnalysis(baseUrl, {
      dreamText: "学校走廊里的门",
      analysisType: "guided_questions"
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error.code, "FEATURE_DISABLED");
    assert.equal(inserted.length, 0);
  }, {
    analyticsClient: {
      from: () => ({
        insert: async (event) => {
          inserted.push(event);
          return { error: null };
        }
      })
    },
    analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" },
    awaitAnalyticsWrites: true
  });
});

test("DeepSeek 5xx refunds daily quota but preserves stable UPSTREAM_UNAVAILABLE error", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  let upstreamCalls = 0;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamCalls += 1;
    if (upstreamCalls === 1) {
      return { ok: false, status: 503, json: async () => ({ upstream: "private" }) };
    }

    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };
  const accessControl = createAiAccessControl({
    guestDailyLimit: 1,
    guestRequestsPerMinute: 5,
    maxConcurrentPerPrincipal: 1
  });

  try {
    await withServer(async (baseUrl) => {
      const first = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const firstPayload = await first.json();
      assert.equal(first.status, 502);
      assert.equal(firstPayload.error.code, "UPSTREAM_UNAVAILABLE");
      assert.equal(firstPayload.usage.remaining, 1);

      const second = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      assert.equal(second.status, 200);
      assert.equal((await second.json()).usage.remaining, 0);
    }, { accessControl });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("route returns DAILY_LIMIT_REACHED with Retry-After when quota is exhausted", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };
  const accessControl = createAiAccessControl({
    guestDailyLimit: 1,
    guestRequestsPerMinute: 5,
    maxConcurrentPerPrincipal: 1
  });

  try {
    await withServer(async (baseUrl) => {
      const first = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      assert.equal(first.status, 200);

      const second = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const payload = await second.json();

      assert.equal(second.status, 429);
      assert.equal(payload.error.code, "DAILY_LIMIT_REACHED");
      assert.equal(payload.usage.remaining, 0);
      assert.ok(Number(second.headers.get("Retry-After")) > 0);
    }, { accessControl });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("route returns RATE_LIMITED with Retry-After for short-window bursts", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };
  const accessControl = createAiAccessControl({
    guestDailyLimit: 10,
    guestRequestsPerMinute: 1,
    maxConcurrentPerPrincipal: 1
  });

  try {
    await withServer(async (baseUrl) => {
      const first = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      assert.equal(first.status, 200);

      const second = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const payload = await second.json();

      assert.equal(second.status, 429);
      assert.equal(payload.error.code, "RATE_LIMITED");
      assert.ok(Number(second.headers.get("Retry-After")) > 0);
    }, { accessControl });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("route returns REQUEST_IN_PROGRESS for duplicate concurrent principal", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  let releaseFirst;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => {
    firstStarted = resolve;
  });
  const releaseFirstPromise = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let upstreamCalls = 0;

  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamCalls += 1;
    if (upstreamCalls === 1) {
      firstStarted();
      await releaseFirstPromise;
    }

    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };
  const accessControl = createAiAccessControl({
    guestDailyLimit: 10,
    guestRequestsPerMinute: 10,
    maxConcurrentPerPrincipal: 1
  });

  try {
    await withServer(async (baseUrl) => {
      const firstRequest = postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      await firstStartedPromise;

      const second = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const secondPayload = await second.json();

      assert.equal(second.status, 429);
      assert.equal(secondPayload.error.code, "REQUEST_IN_PROGRESS");
      assert.equal(upstreamCalls, 1);

      releaseFirst();
      const first = await firstRequest;
      assert.equal(first.status, 200);
    }, { accessControl });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("DeepSeek timeout aborts request, releases lock, and refunds daily quota", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  let aborted = false;
  let upstreamCalls = 0;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamCalls += 1;
    if (upstreamCalls === 1) {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          aborted = true;
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    }

    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: createQuickAnalysisPayload(),
              dreamResultCard: createResultCardPayload()
            })
          }
        }]
      })
    };
  };
  const accessControl = createAiAccessControl({
    guestDailyLimit: 1,
    guestRequestsPerMinute: 5,
    maxConcurrentPerPrincipal: 1
  });

  try {
    await withServer(async (baseUrl) => {
      const first = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      const firstPayload = await first.json();
      assert.equal(first.status, 504);
      assert.equal(firstPayload.error.code, "UPSTREAM_TIMEOUT");
      assert.equal(firstPayload.usage.remaining, 1);
      assert.equal(aborted, true);

      const second = await postDreamAnalysis(baseUrl, {
        dreamText: "我在学校走廊里一直找不到教室，门发着光。",
        analysisType: "quick"
      });
      assert.equal(second.status, 200);
      assert.equal((await second.json()).usage.remaining, 0);
    }, { accessControl, requestTimeoutMs: 5 });
  } finally {
    global.fetch = nativeFetch;
  }
});

function createAnalyticsQueryClient(rows = []) {
  return {
    from(tableName) {
      assert.equal(tableName, "ai_usage_events");
      let limitValue = rows.length;
      const builder = {
        select() {
          return builder;
        },
        gte() {
          return builder;
        },
        order() {
          return builder;
        },
        limit(limit) {
          limitValue = limit;
          return builder;
        },
        then(resolve, reject) {
          return Promise.resolve({ data: rows.slice(0, limitValue), error: null }).then(resolve, reject);
        }
      };

      return builder;
    }
  };
}

test("admin summary requires authenticated admin", { concurrency: false }, async () => {
  await withServer(async (baseUrl) => {
    const guest = await fetch(`${baseUrl}/api/v1/admin/analytics/summary`);
    const guestPayload = await guest.json();

    assert.equal(guest.status, 401);
    assert.equal(guestPayload.error.code, "AUTH_INVALID");

    const user = await fetch(`${baseUrl}/api/v1/admin/analytics/summary`, {
      headers: { Authorization: "Bearer user-token" }
    });
    const userPayload = await user.json();

    assert.equal(user.status, 403);
    assert.equal(userPayload.error.code, "AUTH_FORBIDDEN");
  }, {
    authResolver: {
      resolveIdentity: async (request) => {
        const header = request.headers.authorization || "";
        if (!header) return { type: "guest", userId: "", rateLimitKey: "guest:127.0.0.1" };
        return { type: "authenticated", userId: "normal-user", rateLimitKey: "user:normal-user" };
      }
    },
    adminEnv: {
      ADMIN_USER_IDS: "admin-user",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service"
    },
    analyticsClient: createAnalyticsQueryClient([])
  });
});

test("admin summary returns analytics for configured admin only", { concurrency: false }, async () => {
  const rows = [{
    request_id: "00000000-0000-4000-8000-000000000001",
    occurred_at: new Date().toISOString(),
    principal_type: "guest",
    principal_hash: "private-hash",
    analysis_type: "quick",
    outcome: "success",
    duration_ms: 120,
    quality_retry_count: 1,
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
    estimated_cost_usd: 0.001
  }];

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/analytics/summary?range=30d`, {
      headers: { Authorization: "Bearer admin-token" }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(payload.range.key, "30d");
    assert.equal(payload.totalRequests, 1);
    assert.equal(payload.todayRequests, 1);
    assert.equal(payload.approximatePrincipals, 1);
    assert.doesNotMatch(JSON.stringify(payload), /private-hash/);
  }, {
    authResolver: {
      resolveIdentity: async () => ({
        type: "authenticated",
        userId: "admin-user",
        rateLimitKey: "user:admin-user"
      })
    },
    adminEnv: {
      ADMIN_USER_IDS: "admin-user",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service"
    },
    analyticsClient: createAnalyticsQueryClient(rows)
  });
});

test("admin analytics returns ANALYTICS_UNAVAILABLE when service role config is missing", { concurrency: false }, async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/analytics/summary`, {
      headers: { Authorization: "Bearer admin-token" }
    });
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.error.code, "ANALYTICS_UNAVAILABLE");
  }, {
    authResolver: {
      resolveIdentity: async () => ({
        type: "authenticated",
        userId: "admin-user",
        rateLimitKey: "user:admin-user"
      })
    },
    adminEnv: {
      ADMIN_USER_IDS: "admin-user",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: ""
    },
    analyticsClient: null
  });
});

test("admin recent returns redacted events with max limit", { concurrency: false }, async () => {
  const rows = [{
    request_id: "00000000-0000-4000-8000-000000000001",
    occurred_at: "2026-07-17T01:00:00.000Z",
    principal_hash: "private-hash",
    principal_type: "authenticated",
    analysis_type: "quick",
    outcome: "success",
    duration_ms: 120,
    total_tokens: 30,
    estimated_cost_usd: 0.001
  }];

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/analytics/recent?limit=200`, {
      headers: { Authorization: "Bearer admin-token" }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.limit, 100);
    assert.equal(payload.events[0].requestId, "00000000");
    assert.equal(payload.events[0].principalType, "authenticated");
    assert.doesNotMatch(JSON.stringify(payload), /private-hash/);
  }, {
    authResolver: {
      resolveIdentity: async () => ({
        type: "authenticated",
        userId: "admin-user",
        rateLimitKey: "user:admin-user"
      })
    },
    adminEnv: {
      ADMIN_USER_IDS: "admin-user",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service"
    },
    analyticsClient: createAnalyticsQueryClient(rows)
  });
});

function createProductAnalyticsQueryClient(rows = [], inserted = [], preferenceRows = []) {
  return {
    from(tableName) {
      if (tableName === "product_analytics_preferences") {
        let selectedUserId = null;
        const preferenceBuilder = {
          select() { return preferenceBuilder; },
          eq(column, value) {
            assert.equal(column, "user_id");
            selectedUserId = value;
            return preferenceBuilder;
          },
          maybeSingle: async () => ({
            data: preferenceRows.find((row) => row.user_id === selectedUserId) || null,
            error: null
          })
        };
        return preferenceBuilder;
      }

      assert.equal(tableName, "product_events");
      const builder = {
        upsert(events) {
          inserted.push(...events);
          return { select: async () => ({ data: events, error: null }) };
        },
        select() { return builder; },
        gte() { return builder; },
        lte() { return builder; },
        order() { return builder; },
        then(resolve, reject) {
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

function createProductEvent(overrides = {}) {
  return {
    eventId: "00000000-0000-4000-8000-000000000101",
    eventName: "app_opened",
    occurredAt: "2026-07-19T08:00:00.000Z",
    properties: {},
    ...overrides
  };
}

test("product events accept opted-in guest events without caching", { concurrency: false }, async () => {
  const inserted = [];
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/product-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analyticsConsent: true, sessionId: "00000000-0000-4000-8000-000000000102", installationId: "00000000-0000-4000-8000-000000000103", events: [createProductEvent()] })
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).insertedCount, 1);
    assert.equal(inserted.length, 1);
    assert.doesNotMatch(JSON.stringify(inserted), /00000000-0000-4000-8000-000000000102|00000000-0000-4000-8000-000000000103/);
  }, {
    analyticsClient: createProductAnalyticsQueryClient([], inserted),
    analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" }
  });
});

test("product events derive logged-in identity from a valid Bearer token", { concurrency: false }, async () => {
  const inserted = [];
  const userId = "00000000-0000-4000-8000-000000000104";
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/product-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer member-token" },
      body: JSON.stringify({ analyticsConsent: true, sessionId: "00000000-0000-4000-8000-000000000102", events: [createProductEvent({ userId: "attacker-id" })] })
    });
    assert.equal(response.status, 200);
    assert.equal(inserted[0].principal_type, "authenticated");
    assert.doesNotMatch(JSON.stringify(inserted), /attacker-id/);
  }, {
    authResolver: {
      resolveIdentity: async () => ({ type: "authenticated", userId })
    },
    analyticsClient: createProductAnalyticsQueryClient([], inserted, [{ user_id: userId, enabled: true }]),
    analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" }
  });
});

test("product events require the authenticated user's stored opt-in preference", { concurrency: false }, async () => {
  const inserted = [];
  const userId = "00000000-0000-4000-8000-000000000104";
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/product-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer member-token" },
      body: JSON.stringify({
        analyticsConsent: true,
        sessionId: "00000000-0000-4000-8000-000000000102",
        events: [createProductEvent()]
      })
    });

    const payload = await response.json();
    assert.equal(response.status, 403);
    assert.equal(payload.error.code, "PRODUCT_ANALYTICS_DISABLED");
    assert.equal(inserted.length, 0);
  }, {
    authResolver: {
      resolveIdentity: async () => ({ type: "authenticated", userId })
    },
    analyticsClient: createProductAnalyticsQueryClient([], inserted, [{ user_id: userId, enabled: false }]),
    analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" }
  });
});

test("product events reject mixed authenticated and guest identity payloads", { concurrency: false }, async () => {
  const inserted = [];
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/product-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer member-token" },
      body: JSON.stringify({
        analyticsConsent: true,
        sessionId: "00000000-0000-4000-8000-000000000102",
        installationId: "00000000-0000-4000-8000-000000000103",
        events: [createProductEvent()]
      })
    });

    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.error.code, "INVALID_REQUEST");
    assert.equal(inserted.length, 0);
  }, {
    authResolver: {
      resolveIdentity: async () => ({ type: "authenticated", userId: "00000000-0000-4000-8000-000000000104" })
    },
    analyticsClient: createProductAnalyticsQueryClient([], inserted),
    analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" }
  });
});

test("product events do not persist arbitrary client app versions", { concurrency: false }, async () => {
  const inserted = [];
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/product-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Version": "private@example.com"
      },
      body: JSON.stringify({
        analyticsConsent: true,
        sessionId: "00000000-0000-4000-8000-000000000102",
        installationId: "00000000-0000-4000-8000-000000000103",
        events: [createProductEvent()]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(inserted[0].app_version, "2026-07-19");
    assert.doesNotMatch(JSON.stringify(inserted), /private@example\.com/);
  }, {
    analyticsClient: createProductAnalyticsQueryClient([], inserted),
    analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" }
  });
});

test("product events return stable request errors", { concurrency: false }, async () => {
  await withServer(async (baseUrl) => {
    const invalidAuth = await fetch(`${baseUrl}/api/v1/product-events`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer bad" }, body: JSON.stringify({ analyticsConsent: true, sessionId: "00000000-0000-4000-8000-000000000102", installationId: "00000000-0000-4000-8000-000000000103", events: [createProductEvent()] })
    });
    assert.equal((await invalidAuth.json()).error.code, "AUTH_INVALID");

    const unknownEvent = await fetch(`${baseUrl}/api/v1/product-events`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analyticsConsent: true, sessionId: "00000000-0000-4000-8000-000000000102", installationId: "00000000-0000-4000-8000-000000000103", events: [createProductEvent({ eventName: "unknown" })] })
    });
    assert.equal((await unknownEvent.json()).error.code, "INVALID_REQUEST");

    const tooMany = await fetch(`${baseUrl}/api/v1/product-events`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analyticsConsent: true, sessionId: "00000000-0000-4000-8000-000000000102", installationId: "00000000-0000-4000-8000-000000000103", events: Array.from({ length: 21 }, (_, index) => createProductEvent({ eventId: `00000000-0000-4000-8000-${String(index + 200).padStart(12, "0")}` })) })
    });
    assert.equal((await tooMany.json()).error.code, "INVALID_REQUEST");
  }, {
    authResolver: { resolveIdentity: async (request) => {
      if (request.headers.authorization) throw Object.assign(new Error("bad token"), { code: "AUTH_INVALID", status: 401 });
      return { type: "guest" };
    } },
    analyticsClient: createProductAnalyticsQueryClient(),
    analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" }
  });
});

test("product events require analytics configuration", { concurrency: false }, async () => {
  await withServer(async (baseUrl) => {
    const unavailable = await fetch(`${baseUrl}/api/v1/product-events`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analyticsConsent: true, sessionId: "00000000-0000-4000-8000-000000000102", installationId: "00000000-0000-4000-8000-000000000103", events: [createProductEvent()] })
    });
    assert.equal((await unavailable.json()).error.code, "ANALYTICS_UNAVAILABLE");
  }, { analyticsClient: null, analyticsEnv: {} });
});

test("product events accept duplicate event ids without a second insertion", { concurrency: false }, async () => {
  const inserted = [];
  const client = createProductAnalyticsQueryClient([], inserted);
  client.from = (tableName) => {
    assert.equal(tableName, "product_events");
    const builder = {
      upsert(events) {
        const newEvents = events.filter((event) => !inserted.some((record) => record.event_id === event.event_id));
        inserted.push(...newEvents);
        return { select: async () => ({ data: newEvents, error: null }) };
      }
    };
    return builder;
  };

  await withServer(async (baseUrl) => {
    const body = JSON.stringify({ analyticsConsent: true, sessionId: "00000000-0000-4000-8000-000000000102", installationId: "00000000-0000-4000-8000-000000000103", events: [createProductEvent()] });
    const first = await fetch(`${baseUrl}/api/v1/product-events`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const second = await fetch(`${baseUrl}/api/v1/product-events`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.equal((await first.json()).insertedCount, 1);
    assert.equal((await second.json()).duplicateCount, 1);
    assert.equal(inserted.length, 1);
  }, { analyticsClient: client, analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" } });
});

test("product analytics deletion verifies identity and deletes only the matching hashed principal", { concurrency: false }, async () => {
  const deletes = [];
  const client = {
    from(tableName) {
      assert.equal(tableName, "product_events");
      return {
        delete() { return this; },
        eq(column, value) {
          const filters = [{ column, value }];
          return {
            eq(nextColumn, nextValue) {
              filters.push({ column: nextColumn, value: nextValue });
              deletes.push(filters);
              return Promise.resolve({ error: null });
            }
          };
        }
      };
    }
  };
  await withServer(async (baseUrl) => {
    const guest = await fetch(`${baseUrl}/api/v1/product-analytics`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installationId: "00000000-0000-4000-8000-000000000103" })
    });
    assert.equal(guest.status, 200);
    assert.equal(guest.headers.get("cache-control"), "no-store");

    const authenticated = await fetch(`${baseUrl}/api/v1/product-analytics`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: "Bearer member-token" },
      body: JSON.stringify({ installationId: "attacker-controlled-installation" })
    });
    assert.equal(authenticated.status, 200);
  }, {
    authResolver: {
      resolveIdentity: async (request) => request.headers.authorization
        ? { type: "authenticated", userId: "00000000-0000-4000-8000-000000000104" }
        : { type: "guest" }
    },
    analyticsClient: client,
    analyticsEnv: { ANALYTICS_HASH_SECRET: "analytics-secret" }
  });
  assert.deepEqual(deletes.map((filters) => filters.map((filter) => filter.column)), [
    ["principal_type", "principal_hash"],
    ["principal_type", "principal_hash"]
  ]);
  assert.deepEqual(deletes.map((filters) => filters[0].value), ["guest", "authenticated"]);
  assert.doesNotMatch(JSON.stringify(deletes), /00000000-0000-4000-8000-000000000103|00000000-0000-4000-8000-000000000104/);
});

test("admin product analytics endpoints require admin auth and return sample-ready payloads", { concurrency: false }, async () => {
  const rows = [{ occurred_at: "2026-07-19T08:00:00.000Z", event_name: "app_opened", principal_type: "guest", principal_hash: "private-principal", session_hash: "private-session", properties: {} }];
  await withServer(async (baseUrl) => {
    const guest = await fetch(`${baseUrl}/api/v1/admin/product-analytics/summary`);
    assert.equal((await guest.json()).error.code, "AUTH_INVALID");

    const response = await fetch(`${baseUrl}/api/v1/admin/product-analytics/summary?range=7d`, { headers: { Authorization: "Bearer admin" } });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(payload.sampleLabel, "基于已同意产品分析的用户样本");
    assert.doesNotMatch(JSON.stringify(payload), /private-principal|private-session/);
  }, {
    authResolver: { resolveIdentity: async (request) => request.headers.authorization ? { type: "authenticated", userId: "admin-user" } : { type: "guest" } },
    adminEnv: { ADMIN_USER_IDS: "admin-user" },
    analyticsClient: createProductAnalyticsQueryClient(rows)
  });
});
