const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CHUNK_CHARACTER_LIMIT,
  CHUNK_TOKEN_LIMIT,
  MAX_COLLECTION_ITEMS,
  buildDreamExtractionPrompt,
  classifyDreamInput,
  createDeterministicExtraction,
  estimateDreamTokens,
  formatStructuredDreamContext,
  mergeDreamExtractions,
  normalizeDreamExtraction,
  splitDreamIntoChunks
} = require("../server/dreamPreprocessing");

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function collectSourceStrings(value, sourceNormalized, result = []) {
  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    if (normalized && sourceNormalized.includes(normalized)) {
      result.push(normalized);
    }
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectSourceStrings(item, sourceNormalized, result));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectSourceStrings(item, sourceNormalized, result));
  }

  return result;
}

function getSourceCoverageLength(value, source) {
  const sourceNormalized = normalizeWhitespace(source);
  const ranges = collectSourceStrings(value, sourceNormalized)
    .map((fragment) => {
      const start = sourceNormalized.indexOf(fragment);
      return { start, end: start + fragment.length };
    })
    .sort((left, right) => left.start - right.start);
  let coverage = 0;
  let currentEnd = 0;

  ranges.forEach((range) => {
    const start = Math.max(range.start, currentEnd);
    if (range.end > start) {
      coverage += range.end - start;
      currentEnd = range.end;
    }
  });

  return coverage;
}

test("classifyDreamInput applies character boundaries for direct, long, and very long dreams", () => {
  const cases = [
    ["梦".repeat(200), "direct"],
    ["梦".repeat(800), "long"],
    ["梦".repeat(1500), "long"],
    ["梦".repeat(3000), "very_long"],
    ["梦".repeat(5000), "very_long"]
  ];

  cases.forEach(([text, expectedMode]) => {
    const result = classifyDreamInput(text);
    assert.equal(result.mode, expectedMode);
    assert.equal(result.characterCount, text.length);
  });
});

test("estimateDreamTokens counts compact ASCII-heavy runs conservatively", () => {
  const input = "a ".repeat(650).trim();
  const result = classifyDreamInput(input);

  assert.equal(estimateDreamTokens(input), 650);
  assert.ok(result.estimatedTokenCount >= 650);
  assert.equal(result.mode, "long");
});

test("splitDreamIntoChunks prefers sentence boundaries and preserves normalized source order", () => {
  const source = [
    `第一段${"甲".repeat(720)}。`,
    `\n第二段${"乙".repeat(720)}！`,
    `\n第三段${"丙".repeat(720)}？`
  ].join("");
  const chunks = splitDreamIntoChunks(source);

  assert.deepEqual(chunks.map((chunk) => chunk.index), [0, 1, 2]);
  assert.ok(chunks.every((chunk) => /[。！？]$/.test(chunk.text)));
  assert.ok(chunks.every((chunk) => chunk.text.length <= CHUNK_CHARACTER_LIMIT));
  assert.ok(chunks.every((chunk) => estimateDreamTokens(chunk.text) <= CHUNK_TOKEN_LIMIT));
  assert.equal(normalizeWhitespace(chunks.map((chunk) => chunk.text).join("")), normalizeWhitespace(source));
});

test("splitDreamIntoChunks hard-splits only an oversized unbroken segment within both limits", () => {
  const source = "甲".repeat(CHUNK_CHARACTER_LIMIT + 1);
  const chunks = splitDreamIntoChunks(source);

  assert.deepEqual(chunks.map((chunk) => chunk.index), [0, 1]);
  assert.ok(chunks.every((chunk) => chunk.text.length <= CHUNK_CHARACTER_LIMIT));
  assert.ok(chunks.every((chunk) => estimateDreamTokens(chunk.text) <= CHUNK_TOKEN_LIMIT));
  assert.equal(chunks.map((chunk) => chunk.text).join(""), source);
});

test("normalizeDreamExtraction keeps traceable event evidence and removes invented people", () => {
  const source = "我走进学校。";
  const extraction = normalizeDreamExtraction(
    {
      events: [{ order: 1, description: "走进学校", evidence: "走进学校" }],
      people: [{ name: "陌生医生", evidence: "陌生医生" }]
    },
    source,
    0
  );

  assert.equal(extraction.events.length, 1);
  assert.equal(extraction.events[0].evidence, "走进学校");
  assert.deepEqual(extraction.people, []);
});

test("normalizeDreamExtraction removes invented labels even when their evidence is traceable", () => {
  const extraction = normalizeDreamExtraction(
    {
      people: [{ name: "陌生医生", evidence: "学校" }],
      events: [{ order: 1, description: "逃离学校", evidence: "走进学校" }]
    },
    "我走进学校。",
    0
  );

  assert.deepEqual(extraction.people, []);
  assert.deepEqual(extraction.events, []);
});

test("normalizeDreamExtraction keeps oversized local order values before later chunks", () => {
  const firstChunk = normalizeDreamExtraction(
    {
      events: [{ order: 1002, description: "看见月亮", evidence: "看见月亮" }]
    },
    "看见月亮。",
    0
  );
  const secondChunk = normalizeDreamExtraction(
    {
      events: [{ order: 1, description: "走进学校", evidence: "走进学校" }]
    },
    "走进学校。",
    1
  );
  const merged = mergeDreamExtractions([firstChunk, secondChunk], "看见月亮。走进学校。");

  assert.deepEqual(merged.events.map((event) => event.description), ["看见月亮", "走进学校"]);
});

test("normalization and merge bound raw arrays before traversing them", () => {
  const oversizedPeople = Array.from({ length: MAX_COLLECTION_ITEMS + 1 }, (_, index) => ({
    name: `人物${index + 1}`,
    evidence: `人物${index + 1}`
  }));
  Object.defineProperty(oversizedPeople, MAX_COLLECTION_ITEMS, {
    get() {
      throw new Error("raw collection exceeded bound");
    }
  });
  const source = Array.from({ length: MAX_COLLECTION_ITEMS }, (_, index) => `人物${index + 1}`).join("、");

  assert.doesNotThrow(() => normalizeDreamExtraction({ people: oversizedPeople }, source, 0));

  const extractions = Array.from({ length: MAX_COLLECTION_ITEMS + 1 }, () => ({
    people: [{ name: "人物1", evidence: "人物1" }]
  }));
  Object.defineProperty(extractions, MAX_COLLECTION_ITEMS, {
    get() {
      throw new Error("extraction list exceeded bound");
    }
  });

  assert.doesNotThrow(() => mergeDreamExtractions(extractions, source));
});

test("createDeterministicExtraction fallback contains only source sentences and fragments", () => {
  const source = "我走进学校。\n看见红色的门！";
  const extraction = createDeterministicExtraction(source, 2);
  const sourceNormalized = normalizeWhitespace(source);
  const values = [
    ...extraction.events.flatMap((event) => [event.description, event.evidence]),
    ...extraction.evidenceFragments
  ];

  assert.ok(values.length > 0);
  assert.ok(values.every((value) => sourceNormalized.includes(normalizeWhitespace(value))));
  assert.deepEqual(extraction.people, []);
  assert.deepEqual(extraction.locations, []);
  assert.deepEqual(extraction.emotions, []);
  assert.deepEqual(extraction.notableObjects, []);
});

test("mergeDreamExtractions deduplicates collections, preserves event order, caps output, and keeps evidence traceable", () => {
  const names = Array.from({ length: MAX_COLLECTION_ITEMS + 3 }, (_, index) => `人物${index + 1}`);
  const source = `我先看见老师和红门。后来走进学校。${names.join("、")}。`;
  const extractions = [
    {
      people: [{ name: "老师", evidence: "老师" }, ...names.map((name) => ({ name, evidence: name }))],
      locations: [],
      events: [{ order: 101, description: "走进学校", evidence: "走进学校" }],
      transitions: [],
      emotions: [],
      notableObjects: [{ name: "红门", evidence: "红门" }],
      recurringElements: [],
      ambiguities: [],
      evidenceFragments: ["老师", "红门"]
    },
    {
      people: [{ name: "老师", evidence: "老师" }],
      locations: [],
      events: [{ order: 1, description: "看见老师", evidence: "看见老师" }],
      transitions: [],
      emotions: [],
      notableObjects: [{ name: "红门", evidence: "红门" }],
      recurringElements: [],
      ambiguities: [],
      evidenceFragments: ["红门", "走进学校"]
    }
  ];
  const merged = mergeDreamExtractions(extractions, source);
  const sourceNormalized = normalizeWhitespace(source);
  const evidence = [
    ...merged.people.map((item) => item.evidence),
    ...merged.notableObjects.map((item) => item.evidence),
    ...merged.events.map((item) => item.evidence),
    ...merged.evidenceFragments
  ];

  assert.equal(merged.people.filter((person) => person.name === "老师").length, 1);
  assert.equal(merged.notableObjects.filter((item) => item.name === "红门").length, 1);
  assert.deepEqual(merged.events.map((event) => event.description), ["看见老师", "走进学校"]);
  assert.ok(merged.people.length <= MAX_COLLECTION_ITEMS);
  assert.ok(evidence.every((fragment) => sourceNormalized.includes(normalizeWhitespace(fragment))));
});

test("buildDreamExtractionPrompt requests JSON extraction without interpretation or invented context", () => {
  const prompt = buildDreamExtractionPrompt("我走进学校。", { chunkIndex: 0, chunkCount: 1 });

  assert.match(prompt, /JSON/iu);
  assert.match(prompt, /仅输出/iu);
  assert.match(prompt, /禁止.*解释|禁止.*解读/iu);
  assert.match(prompt, /禁止.*诊断/iu);
  assert.match(prompt, /禁止.*预测/iu);
  assert.match(prompt, /禁止.*编造/iu);
});

test("formatStructuredDreamContext preserves the canonical extraction content", () => {
  const context = formatStructuredDreamContext({
    people: [],
    locations: [],
    events: [{ order: 1, description: "走进学校", evidence: "走进学校" }],
    transitions: [],
    emotions: [],
    notableObjects: [],
    recurringElements: [],
    ambiguities: [],
    evidenceFragments: ["走进学校"]
  });

  assert.match(context, /走进学校/iu);
  assert.doesNotMatch(context, /undefined/iu);
});

test("structured context globally budgets deterministic fallback size and source coverage", () => {
  const source = Array.from(
    { length: 9 },
    (_, index) => `片段${index + 1}${"甲".repeat(90)}。`
  ).join("\n");
  const fallback = createDeterministicExtraction(source, 0);
  const context = formatStructuredDreamContext(
    mergeDreamExtractions([fallback], source),
    source
  );
  const representation = JSON.parse(context);

  assert.ok(context.length < source.length);
  assert.ok(getSourceCoverageLength(representation, source) < source.length / 2);
  assert.doesNotMatch(context, new RegExp(source));
});

test("structured context keeps shortened fallback evidence for unpunctuated long dreams", () => {
  const source = "甲".repeat(800);
  const fallback = createDeterministicExtraction(source, 0);
  const context = formatStructuredDreamContext(
    mergeDreamExtractions([fallback], source),
    source
  );
  const representation = JSON.parse(context);
  const event = representation.events[0];

  assert.ok(event, "at least one source-traceable fallback event should remain");
  assert.ok(source.includes(event.description));
  assert.ok(source.includes(event.evidence));
  assert.ok(event.description.length < source.length / 2);
  assert.ok(getSourceCoverageLength(representation, source) < source.length / 2);
  assert.doesNotMatch(context, new RegExp(source));
});

test("structured context globally budgets model extraction size and source coverage", () => {
  const sourceSegments = Array.from(
    { length: 9 },
    (_, index) => `场景${index + 1}${"乙".repeat(90)}。`
  );
  const source = sourceSegments.join("\n");
  const modelExtraction = normalizeDreamExtraction(
    {
      events: sourceSegments.map((segment, index) => ({
        order: index + 1,
        description: segment,
        evidence: segment
      })),
      evidenceFragments: sourceSegments
    },
    source,
    0
  );
  const context = formatStructuredDreamContext(
    mergeDreamExtractions([modelExtraction], source),
    source
  );
  const representation = JSON.parse(context);

  assert.ok(context.length < source.length);
  assert.ok(getSourceCoverageLength(representation, source) < source.length / 2);
  assert.doesNotMatch(context, new RegExp(source));
});
