const assert = require("node:assert/strict");
const test = require("node:test");

process.env.DEEPSEEK_API_KEY = "test-key";

const { app } = require("../server");

function createResultCardPayload() {
  return {
    archetype: { id: "seeker", summary: "也许与你正在寻找方向有关。" },
    coreInsight: "这个梦也许在邀请你留意正在靠近的选择。",
    dimensions: [
      { id: "symbol_depth", score: 140, summary: "门和走廊带来方向线索。", rationale: ["门可能与选择有关。"] },
      { id: "emotion_intensity", score: -12, summary: "情绪线索较轻。", rationale: ["梦中停留在走廊。"] },
      { id: "self_awareness", score: 42, summary: "你注意到门的存在。", rationale: ["门是清晰画面。"] },
      { id: "growth_signal", score: 101, summary: "也许值得继续观察。", rationale: ["无需急于得出结论。"] }
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

test("keeps quick analysis normalization working", { concurrency: false }, async () => {
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
        analysisType: "quick"
      });
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.equal(payload.analysis.coreEmotion, "好奇");
      assert.deepEqual(payload.analysis.symbols, ["学校", "走廊", "门"]);
    });
  } finally {
    global.fetch = nativeFetch;
  }
});
