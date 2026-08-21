const LONG_CHARACTER_THRESHOLD = 800;
const LONG_TOKEN_THRESHOLD = 650;
const VERY_LONG_CHARACTER_THRESHOLD = 2200;
const VERY_LONG_TOKEN_THRESHOLD = 2000;
const CHUNK_CHARACTER_LIMIT = 1500;
const CHUNK_TOKEN_LIMIT = 1400;
const MAX_COLLECTION_ITEMS = 12;
const MAX_EVIDENCE_FRAGMENTS = 24;
const MAX_TEXT_LENGTH = 300;
const MAX_EVIDENCE_LENGTH = 500;
const MAX_EXTRACTION_ITEMS = 12;
const CHUNK_ORDER_STRIDE = MAX_COLLECTION_ITEMS + 1;
const MAX_STRUCTURED_CONTEXT_CHARACTERS = 1600;
const MAX_STRUCTURED_SOURCE_COVERAGE_RATIO = 0.45;

const ENTITY_FIELDS = ["people", "locations", "emotions", "notableObjects", "recurringElements"];
const ORDERED_FIELDS = ["events", "transitions"];
const CONTEXT_FIELD_PRIORITY = [
  "events",
  "transitions",
  "emotions",
  "people",
  "locations",
  "notableObjects",
  "recurringElements",
  "ambiguities",
  "evidenceFragments"
];

function emptyExtraction() {
  return {
    people: [],
    locations: [],
    events: [],
    transitions: [],
    emotions: [],
    notableObjects: [],
    recurringElements: [],
    ambiguities: [],
    evidenceFragments: []
  };
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/gu, " ").trim();
}

function boundedString(value, limit = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, limit);
}

function sourceContains(sourceNormalized, fragment) {
  const normalizedFragment = normalizeWhitespace(fragment);
  return Boolean(normalizedFragment) && sourceNormalized.includes(normalizedFragment);
}

function normalizedKey(value) {
  return normalizeWhitespace(value).toLocaleLowerCase("en-US");
}

function stableUnique(items, keyForItem, limit) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyForItem(item);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function limitedArray(value, limit) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function collectionLimit(field) {
  return field === "evidenceFragments" ? MAX_EVIDENCE_FRAGMENTS : MAX_COLLECTION_ITEMS;
}

function globalOrder(order, chunkIndex) {
  const localOrder = Number.isFinite(Number(order))
    ? Math.min(Math.max(0, Math.floor(Number(order))), CHUNK_ORDER_STRIDE - 1)
    : 0;
  const normalizedChunkIndex = Number.isFinite(Number(chunkIndex))
    ? Math.max(0, Math.floor(Number(chunkIndex)))
    : 0;

  return normalizedChunkIndex * CHUNK_ORDER_STRIDE + localOrder;
}

function normalizeEntity(item, sourceNormalized) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const name = boundedString(item.name);
  const evidence = boundedString(item.evidence, MAX_EVIDENCE_LENGTH);
  if (!name || !sourceContains(sourceNormalized, name) || !sourceContains(sourceNormalized, evidence)) {
    return null;
  }

  return { name, evidence };
}

function normalizeOrderedItem(item, sourceNormalized, chunkIndex, preserveOrder) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const description = boundedString(item.description);
  const evidence = boundedString(item.evidence, MAX_EVIDENCE_LENGTH);
  if (!description || !sourceContains(sourceNormalized, description) || !sourceContains(sourceNormalized, evidence)) {
    return null;
  }

  const order = Number.isFinite(Number(item.order)) ? Math.max(0, Math.floor(Number(item.order))) : 0;
  return {
    order: preserveOrder ? order : globalOrder(order, chunkIndex),
    description,
    evidence
  };
}

function isCjkCharacter(character) {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(character);
}

function estimateDreamTokens(text) {
  let tokenCount = 0;
  let nonCjkRunLength = 0;

  for (const character of String(text || "")) {
    if (isCjkCharacter(character)) {
      tokenCount += Math.ceil(nonCjkRunLength / 4);
      nonCjkRunLength = 0;
      tokenCount += 1;
    } else if (/\s/u.test(character)) {
      tokenCount += Math.ceil(nonCjkRunLength / 4);
      nonCjkRunLength = 0;
    } else {
      nonCjkRunLength += 1;
    }
  }

  return tokenCount + Math.ceil(nonCjkRunLength / 4);
}

function classifyDreamInput(text) {
  const value = String(text || "");
  const characterCount = value.length;
  const estimatedTokenCount = estimateDreamTokens(value);
  let mode = "direct";

  if (
    characterCount >= VERY_LONG_CHARACTER_THRESHOLD ||
    estimatedTokenCount >= VERY_LONG_TOKEN_THRESHOLD
  ) {
    mode = "very_long";
  } else if (
    characterCount >= LONG_CHARACTER_THRESHOLD ||
    estimatedTokenCount >= LONG_TOKEN_THRESHOLD
  ) {
    mode = "long";
  }

  return { mode, characterCount, estimatedTokenCount };
}

function splitIntoBoundarySegments(text) {
  const segments = [];
  let current = "";

  for (const character of String(text || "")) {
    if (character === "\n") {
      if (current && !current.startsWith("\n")) {
        segments.push(current);
        current = "";
      }
      current += character;
    } else {
      current += character;
      if (/[。！？]/u.test(character)) {
        segments.push(current);
        current = "";
      }
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

function hardSplitSegment(segment) {
  const pieces = [];
  let remainder = segment;

  while (remainder) {
    let end = Math.min(remainder.length, CHUNK_CHARACTER_LIMIT);

    while (end > 0 && estimateDreamTokens(remainder.slice(0, end)) > CHUNK_TOKEN_LIMIT) {
      end -= 1;
    }

    if (end === 0) {
      end = 1;
    }

    pieces.push(remainder.slice(0, end));
    remainder = remainder.slice(end);
  }

  return pieces;
}

function fitsChunk(text) {
  return text.length <= CHUNK_CHARACTER_LIMIT && estimateDreamTokens(text) <= CHUNK_TOKEN_LIMIT;
}

function splitDreamIntoChunks(text) {
  const chunks = [];
  let current = "";

  function addChunk(chunkText) {
    if (chunkText) {
      chunks.push({ index: chunks.length, text: chunkText });
    }
  }

  for (const segment of splitIntoBoundarySegments(text)) {
    if (fitsChunk(segment) && fitsChunk(current + segment)) {
      current += segment;
      continue;
    }

    addChunk(current);
    current = "";

    if (fitsChunk(segment)) {
      current = segment;
      continue;
    }

    const pieces = hardSplitSegment(segment);
    for (const piece of pieces.slice(0, -1)) {
      addChunk(piece);
    }
    current = pieces[pieces.length - 1] || "";
  }

  addChunk(current);
  return chunks;
}

function buildDreamExtractionPrompt(chunk, metadata = {}) {
  const chunkIndex = Number.isFinite(Number(metadata.chunkIndex)) ? Number(metadata.chunkIndex) : 0;
  const chunkCount = Number.isFinite(Number(metadata.chunkCount)) ? Number(metadata.chunkCount) : 1;

  return [
    "你是梦境记录的事实提取器。仅输出 JSON，不要 Markdown、解释或其他文字。",
    "只提取文本中明确出现的人物、地点、事件、转场、情绪、显著物件、重复元素、歧义和原文证据片段。",
    "禁止解释或解读，禁止评分，禁止诊断，禁止预测，禁止声称象征意义，禁止推断现实原因，禁止编造任何背景、人物或事实。",
    "每个 evidence 和 evidenceFragments 项都必须是输入文本中可逐字对应的片段（忽略空白差异）。",
    "返回的 JSON 必须使用字段 people, locations, events, transitions, emotions, notableObjects, recurringElements, ambiguities, evidenceFragments。",
    `分块：${chunkIndex + 1}/${chunkCount}。`,
    "输入文本：",
    String(chunk || "")
  ].join("\n");
}

function normalizeDreamExtraction(raw, sourceText, chunkIndex) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const sourceNormalized = normalizeWhitespace(sourceText);
  const normalized = emptyExtraction();

  for (const field of ENTITY_FIELDS) {
    const items = limitedArray(raw[field], MAX_COLLECTION_ITEMS);
    normalized[field] = stableUnique(
      items.map((item) => normalizeEntity(item, sourceNormalized)).filter(Boolean),
      (item) => normalizedKey(item.name),
      MAX_COLLECTION_ITEMS
    );
  }

  for (const field of ORDERED_FIELDS) {
    const items = limitedArray(raw[field], MAX_COLLECTION_ITEMS);
    normalized[field] = stableUnique(
      items.map((item) => normalizeOrderedItem(item, sourceNormalized, chunkIndex, false)).filter(Boolean),
      (item) => `${normalizedKey(item.description)}\u0000${normalizedKey(item.evidence)}`,
      MAX_COLLECTION_ITEMS
    ).sort((left, right) => left.order - right.order);
  }

  const ambiguities = limitedArray(raw.ambiguities, MAX_COLLECTION_ITEMS);
  normalized.ambiguities = stableUnique(
    ambiguities
      .map((item) => boundedString(item))
      .filter((item) => sourceContains(sourceNormalized, item)),
    normalizedKey,
    MAX_COLLECTION_ITEMS
  );

  const evidenceFragments = limitedArray(raw.evidenceFragments, MAX_EVIDENCE_FRAGMENTS);
  normalized.evidenceFragments = stableUnique(
    evidenceFragments
      .map((item) => boundedString(item, MAX_EVIDENCE_LENGTH))
      .filter((item) => sourceContains(sourceNormalized, item)),
    normalizedKey,
    MAX_EVIDENCE_FRAGMENTS
  );

  return normalized;
}

function createDeterministicExtraction(sourceText, chunkIndex) {
  const extraction = emptyExtraction();
  const sourceNormalized = normalizeWhitespace(sourceText);
  const fragments = [];

  for (const segment of splitIntoBoundarySegments(sourceText)) {
    for (const piece of fitsChunk(segment) ? [segment] : hardSplitSegment(segment)) {
      const fragment = boundedString(piece, MAX_EVIDENCE_LENGTH);
      if (sourceContains(sourceNormalized, fragment)) {
        fragments.push(fragment);
      }
    }
  }

  extraction.events = stableUnique(
    fragments.map((fragment, index) => ({
      order: globalOrder(index + 1, chunkIndex),
      description: fragment,
      evidence: fragment
    })),
    (item) => normalizedKey(item.evidence),
    MAX_COLLECTION_ITEMS
  );
  extraction.evidenceFragments = stableUnique(fragments, normalizedKey, MAX_EVIDENCE_FRAGMENTS);
  return extraction;
}

function getExtractionSourceFragments(representation) {
  const fragments = [];
  const value = representation && typeof representation === "object" ? representation : emptyExtraction();

  ENTITY_FIELDS.forEach((field) => {
    limitedArray(value[field], MAX_COLLECTION_ITEMS).forEach((item) => {
      if (item && typeof item === "object") {
        fragments.push(item.name, item.evidence);
      }
    });
  });
  ORDERED_FIELDS.forEach((field) => {
    limitedArray(value[field], MAX_COLLECTION_ITEMS).forEach((item) => {
      if (item && typeof item === "object") {
        fragments.push(item.description, item.evidence);
      }
    });
  });
  fragments.push(...limitedArray(value.ambiguities, MAX_COLLECTION_ITEMS));
  fragments.push(...limitedArray(value.evidenceFragments, MAX_EVIDENCE_FRAGMENTS));
  return fragments.map(normalizeWhitespace).filter(Boolean);
}

function getSourceCoverageLength(representation, sourceNormalized) {
  const ranges = getExtractionSourceFragments(representation)
    .map((fragment) => {
      const start = sourceNormalized.indexOf(fragment);
      return start === -1 ? null : { start, end: start + fragment.length };
    })
    .filter(Boolean)
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

function shouldBudgetStructuredContext(sourceText) {
  return classifyDreamInput(sourceText).mode !== "direct";
}

function compactStructuredDreamRepresentation(representation, sourceText) {
  const normalizedRepresentation = representation && typeof representation === "object" && !Array.isArray(representation)
    ? representation
    : emptyExtraction();
  const sourceNormalized = normalizeWhitespace(sourceText);

  if (!sourceNormalized || !shouldBudgetStructuredContext(sourceText)) {
    return normalizedRepresentation;
  }

  const maxSerializedLength = Math.min(MAX_STRUCTURED_CONTEXT_CHARACTERS, sourceNormalized.length);
  const maxSourceCoverage = Math.max(1, Math.floor(sourceNormalized.length * MAX_STRUCTURED_SOURCE_COVERAGE_RATIO));
  const compacted = emptyExtraction();

  CONTEXT_FIELD_PRIORITY.forEach((field) => {
    for (const item of limitedArray(normalizedRepresentation[field], collectionLimit(field))) {
      const candidate = {
        ...compacted,
        [field]: [...compacted[field], item]
      };
      const serialized = JSON.stringify(candidate);

      if (
        serialized.length <= maxSerializedLength
        && getSourceCoverageLength(candidate, sourceNormalized) <= maxSourceCoverage
      ) {
        compacted[field] = candidate[field];
      }
    }
  });

  return compacted;
}

function mergeDreamExtractions(extractions, sourceText) {
  const sourceNormalized = normalizeWhitespace(sourceText);
  const merged = emptyExtraction();
  const validExtractions = limitedArray(extractions, MAX_EXTRACTION_ITEMS)
    .filter((item) => item && typeof item === "object");

  for (const field of ENTITY_FIELDS) {
    merged[field] = stableUnique(
      validExtractions.flatMap((extraction) => limitedArray(extraction[field], MAX_COLLECTION_ITEMS))
        .map((item) => normalizeEntity(item, sourceNormalized))
        .filter(Boolean),
      (item) => normalizedKey(item.name),
      MAX_COLLECTION_ITEMS
    );
  }

  for (const field of ORDERED_FIELDS) {
    merged[field] = stableUnique(
      validExtractions.flatMap((extraction) => limitedArray(extraction[field], MAX_COLLECTION_ITEMS))
        .map((item) => normalizeOrderedItem(item, sourceNormalized, 0, true))
        .filter(Boolean)
        .sort((left, right) => left.order - right.order),
      (item) => `${normalizedKey(item.description)}\u0000${normalizedKey(item.evidence)}`,
      MAX_COLLECTION_ITEMS
    );
  }

  merged.ambiguities = stableUnique(
    validExtractions.flatMap((extraction) => limitedArray(extraction.ambiguities, MAX_COLLECTION_ITEMS))
      .map((item) => boundedString(item))
      .filter((item) => sourceContains(sourceNormalized, item)),
    normalizedKey,
    MAX_COLLECTION_ITEMS
  );
  merged.evidenceFragments = stableUnique(
    validExtractions.flatMap((extraction) => limitedArray(extraction.evidenceFragments, MAX_EVIDENCE_FRAGMENTS))
      .map((item) => boundedString(item, MAX_EVIDENCE_LENGTH))
      .filter((item) => sourceContains(sourceNormalized, item)),
    normalizedKey,
    MAX_EVIDENCE_FRAGMENTS
  );

  return compactStructuredDreamRepresentation(merged, sourceText);
}

function formatStructuredDreamContext(representation, sourceText) {
  return JSON.stringify(
    compactStructuredDreamRepresentation(representation, sourceText)
  );
}

module.exports = {
  CHUNK_CHARACTER_LIMIT,
  CHUNK_TOKEN_LIMIT,
  LONG_CHARACTER_THRESHOLD,
  LONG_TOKEN_THRESHOLD,
  VERY_LONG_CHARACTER_THRESHOLD,
  VERY_LONG_TOKEN_THRESHOLD,
  MAX_COLLECTION_ITEMS,
  MAX_STRUCTURED_CONTEXT_CHARACTERS,
  MAX_STRUCTURED_SOURCE_COVERAGE_RATIO,
  buildDreamExtractionPrompt,
  classifyDreamInput,
  createDeterministicExtraction,
  estimateDreamTokens,
  formatStructuredDreamContext,
  mergeDreamExtractions,
  normalizeDreamExtraction,
  splitDreamIntoChunks
};
