const assert = require("node:assert/strict");
const test = require("node:test");

process.env.DEEPSEEK_API_KEY = "test-key";

const { app } = require("../server");

function createResultCardPayload() {
  return {
    archetype: {
      id: "seeker",
      summary: "本次梦境更接近寻路者，也许与你正在寻找方向有关。",
      evidence: ["你反复寻找教室。", "门发着光但你停在门前。"]
    },
    coreInsight: "这个梦也许在邀请你留意正在靠近的选择。",
    dimensions: [
      { id: "symbol_depth", score: 140, summary: "门和走廊带来方向线索。", rationale: ["走廊和门形成过渡主题。", "寻找教室让方向感更清晰。"] },
      { id: "emotion_intensity", score: -12, summary: "情绪线索较轻。", rationale: ["梦中停留在走廊。", "紧张感来自找不到教室。"] },
      { id: "self_awareness", score: 42, summary: "你注意到门的存在。", rationale: ["门是清晰画面。", "你能描述停在门前的状态。"] },
      { id: "growth_signal", score: 101, summary: "也许值得继续观察。", rationale: ["发光的门带来靠近新方向的线索。", "寻找教室暗示仍在准备。"] }
    ],
    symbols: [
      { name: "门", generalPossibility: "门有时与选择有关。", contextMeaning: "在这次梦里可能与方向有关。", evidence: "梦里出现一扇门。", reflectionQuestion: "这扇门让你想到什么？" },
      { name: "走廊", generalPossibility: "走廊有时与过渡有关。", contextMeaning: "可能与正在经历的阶段有关。", evidence: "梦里在学校走廊。", reflectionQuestion: "你想走向哪里？" },
      { name: "学校", generalPossibility: "学校有时与学习有关。", contextMeaning: "可能与你熟悉的经历有关。", evidence: "地点是学校。", reflectionQuestion: "这让你想起什么？" },
      { name: "窗", generalPossibility: "窗有时与视野有关。", contextMeaning: "可能带来新的看法。", evidence: "窗在远处。", reflectionQuestion: "你看见了什么？" }
    ],
    emotionalProfile: { primary: "好奇", secondary: ["迟疑"], intensity: 130, evidence: "你停在门前。" },
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

async function withServer(run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function postDreamAnalysis(baseUrl, body) {
  return fetch(`${baseUrl}/api/dream-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

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
      assert.deepEqual(payload.analysis.dimensions.map((dimension) => dimension.score), [100, 0, 42, 100]);
      assert.equal(payload.analysis.symbols.length, 3);
      assert.equal(payload.analysis.emotionalProfile.intensity, 100);
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
      assert.equal(upstreamCalls.length, 1);
      assert.match(JSON.parse(upstreamCalls[0][1].body).messages[1].content, /promptVersion/);
      assert.match(JSON.parse(upstreamCalls[0][1].body).messages[1].content, /dreamSummary/);
      assert.match(JSON.parse(upstreamCalls[0][1].body).messages[1].content, /至少引用两个/);
      assert.equal(payload.dreamResultCardStatus, "ai_generated");
      assert.equal(payload.generationMeta.source, "ai_generated");
      assert.equal(payload.generationMeta.promptVersion, "quick-analysis-v2");
      assert.equal(payload.generationMeta.qualityStatus, "passed");
      assert.equal(payload.analysis.dreamSummary, createQuickAnalysisPayload().dreamSummary);
      assert.equal(payload.analysis.coreTheme, createQuickAnalysisPayload().coreTheme);
      assert.equal(payload.analysis.evidence.length, 2);
      assert.equal(payload.analysis.emotionalReading.primaryEmotion, "紧张");
      assert.equal(payload.analysis.symbolReading.length, 2);
      assert.equal(payload.dreamResultCard.archetype.nameZh, "寻路者");
      assert.deepEqual(payload.dreamResultCard.dimensions.map((dimension) => dimension.score), [100, 0, 42, 100]);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("retries quick analysis once when the first response is too short", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  const upstreamBodies = [];
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
    upstreamBodies.push(JSON.parse(options.body));
    const firstAttempt = upstreamBodies.length === 1;
    return {
      ok: true,
      json: async () => ({
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
      assert.equal(payload.error, "Dream analysis result was incomplete.");
      assert.equal(payload.generationMeta.source, "generation_failed");
      assert.equal(payload.generationMeta.qualityStatus, "incomplete");
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("returns guided questions from dream-specific model output", { concurrency: false }, async () => {
  const nativeFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1")) return nativeFetch(url, options);
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

      assert.equal(response.status, 200);
      assert.equal(payload.questions.length, 3);
      assert.match(payload.questions[0].question, /教室/);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});

test("returns guided final analysis and result card using answer context", { concurrency: false }, async () => {
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

      assert.equal(response.status, 200);
      assert.match(upstreamBodies[0].messages[1].content, /最近有考试压力/);
      assert.equal(payload.analysis.lifeConnection, createDeepAnalysisPayload().lifeConnection);
      assert.equal(payload.dreamResultCardStatus, "ai_generated");
      assert.equal(payload.dreamResultCard.emotionalProfile.primary, "好奇");
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

      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), {
        error: "Dream analysis service is temporarily unavailable."
      });
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
      assert.deepEqual(await response.json(), {
        error: "Dream analysis service is temporarily unavailable."
      });
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
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), {
        error: "Dream analysis service is temporarily unavailable."
      });
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
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), {
        error: "Dream analysis service is temporarily unavailable."
      });
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
    assert.equal(typeof (await response.json()).error, "string");
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
    });
  } finally {
    global.fetch = nativeFetch;
  }
});
