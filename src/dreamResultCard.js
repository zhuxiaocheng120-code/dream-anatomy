(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./dreamArchetypes"));
  } else {
    root.DreamResultCard = factory(root.DreamArchetypes);
  }
})(typeof window !== "undefined" ? window : globalThis, function (DreamArchetypes) {
  const dimensionDefinitions = [
    { id: "symbol_depth", name: "象征深度" },
    { id: "emotion_intensity", name: "情绪强度" },
    { id: "self_awareness", name: "自我觉察" },
    { id: "growth_signal", name: "成长信号" }
  ];
  const safetyReminder = "这不是诊断、治疗或预言，只是一种自我探索视角。";
  const fallbackText = "暂未提供，可从这次梦境的具体感受开始观察。";
  const missingScoreText = "线索不足，暂不评分";
  const shareMissingScoreText = "暂不评分";
  const partialHistoricalMessage = "这是一条较早生成的梦境画像。";
  const generationErrorMessages = {
    GENERATION_INCOMPLETE: "这次画像仍未能完整生成，可以稍后再试。",
    RESULT_CARD_INCOMPLETE: "这次画像仍未能完整生成，可以稍后再试。",
    UPSTREAM_TIMEOUT: "AI 回应时间较长，请稍后重新生成。",
    RATE_LIMITED: "操作太快了，请稍等后再试。",
    REQUEST_IN_PROGRESS: "操作太快了，请稍等后再试。",
    DAILY_LIMIT_REACHED: "今天的免费生成次数已经用完。",
    UPSTREAM_UNAVAILABLE: "梦境画像服务暂时不可用。",
    AUTH_INVALID: "登录状态已失效，请重新登录。"
  };
  const missingDimensionSummaries = {
    symbol_depth: "这次记录中的象征线索较少，可以先从最想记住的画面开始观察。",
    emotion_intensity: "这次记录中没有足够明确的情绪强度线索，可以先留意醒来后的身体感受和情绪余韵。",
    self_awareness: "这次梦境更偏向事件和画面，暂时没有足够的自我观察线索。",
    growth_signal: "这次梦境中没有呈现足够明确的变化、选择或整合线索。"
  };
  const unsafeLanguage = /这(?:说明|代表)[：:，,\s]*你?一定|你(?:一定|必定)会|你(?:会|将会|将)[^。！？!?]{0,30}|未来(?:会|将会|将)[^。！？!?]{0,30}|(?:这个梦|梦境)[^。！？!?]{0,10}预示(?:着)?[^。！？!?]{0,30}|你就是|你是一个[^。！？!?]{0,30}的人|(?:你有|有|你患有|患有|罹患|诊断为)[^。！？!?]{0,20}(?:抑郁症|焦虑症|PTSD|创伤后应激障碍|精神分裂症|双相情感障碍|躁郁症|强迫症|人格障碍)|(?:建议|需要|应该|请|尽快|必须)[^。！？!?]{0,12}(?:治疗|看医生|就医|求医|药物|服药|吃药|用药)|(?:接受)?心理治疗|药物治疗|药物帮助|服用药物|吃药|用药|开药|抗抑郁药|抗焦虑药|一定代表|绝对|必然|注定|命运|吉凶|算命|会发财|会倒霉|会遇灾|恋爱成功|治疗建议|治疗方案|预言/u;

  function text(value, fallback = fallbackText) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized && !unsafeLanguage.test(normalized) ? normalized : fallback;
  }

  function textList(value, fallback) {
    return Array.isArray(value)
      ? value.map((item) => text(item, fallback)).filter((item) => item !== fallback).slice(0, 3)
      : [];
  }

  function clampScore(value) {
    const number = typeof value === "number"
      ? value
      : (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value.trim()) : NaN);
    if (!Number.isFinite(number)) return null;
    return Math.max(0, Math.min(100, number));
  }

  function normalizeScore(value, options) {
    if ((!options || !options.useZeroForMissingScores) && (value === undefined || value === null || value === "")) {
      return null;
    }

    return clampScore(value);
  }

  function normalizeDimension(value, definition, options) {
    const input = value && typeof value === "object" ? value : {};
    const score = normalizeScore(input.score, options);
    const missingSummary = missingDimensionSummaries[definition.id] || fallbackText;
    const rationale = textList(input.rationale, missingSummary);
    return {
      id: definition.id,
      name: definition.name,
      score,
      summary: text(input.summary, score === null ? missingSummary : fallbackText),
      rationale: rationale.length ? rationale : (score === null ? [missingSummary] : [])
    };
  }

  function normalizeDreamResultCard(raw, context, options = {}) {
    const input = raw && typeof raw === "object" ? raw : {};
    const dimensionMap = new Map(Array.isArray(input.dimensions) ? input.dimensions.map((item) => [item && item.id, item]) : []);
    const emotionalInput = input.emotionalProfile && typeof input.emotionalProfile === "object" ? input.emotionalProfile : {};
    const symbols = Array.isArray(input.symbols) ? input.symbols.slice(0, 3).map((item) => {
      const symbol = item && typeof item === "object" ? item : {};
      return {
        name: text(symbol.name, "未命名意象"),
        generalPossibility: text(symbol.generalPossibility),
        contextMeaning: text(symbol.contextMeaning),
        evidence: text(symbol.evidence),
        reflectionQuestion: text(symbol.reflectionQuestion, "这个意象让你想到什么？")
      };
    }) : [];
    const archetype = DreamArchetypes.normalizeArchetype(input.archetype, context);
    return {
      archetype: {
        ...archetype,
        summary: text(archetype.summary, "本次梦境更接近这个原型，也许值得从具体感受开始观察。"),
        evidence: textList(input.archetype && input.archetype.evidence, fallbackText)
      },
      coreInsight: text(input.coreInsight),
      dimensions: dimensionDefinitions.map((definition) => normalizeDimension(dimensionMap.get(definition.id), definition, options)),
      symbols,
      emotionalProfile: {
        primary: text(emotionalInput.primary, "未命名情绪"),
        secondary: textList(emotionalInput.secondary, ""),
        intensity: normalizeScore(emotionalInput.intensity, options),
        evidence: text(emotionalInput.evidence)
      },
      reflectionQuestions: textList(input.reflectionQuestions, ""),
      safetyReminder
    };
  }

  function getDreamResultCardFromRecord(record) {
    if (!record || typeof record !== "object") return null;
    const report = record.reportContent || record.report_content;
    const card = report && typeof report === "object" ? report.dreamResultCard : null;
    return card && typeof card === "object" && !Array.isArray(card) ? card : null;
  }

  function getDreamResultCardStatusFromRecord(record) {
    if (!record || typeof record !== "object") return "";
    const report = record.reportContent || record.report_content;
    return report && typeof report === "object" && typeof report.dreamResultCardStatus === "string"
      ? report.dreamResultCardStatus
      : "";
  }

  function getGenerationMetaFromRecord(record) {
    if (!record || typeof record !== "object") return {};
    const report = record.reportContent || record.report_content;
    return report && typeof report === "object" && report.generationMeta && typeof report.generationMeta === "object"
      ? report.generationMeta
      : {};
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function hasTextValue(value) {
    return typeof value === "string" && value.trim().length > 0 && !unsafeLanguage.test(value.trim());
  }

  function hasScoreValue(value) {
    return clampScore(value) !== null;
  }

  function hasTextList(value, minLength = 1) {
    return Array.isArray(value) && value.filter(hasTextValue).length >= minLength;
  }

  function isCompleteCard(card) {
    if (!isPlainObject(card) || !isPlainObject(card.archetype) || !isPlainObject(card.emotionalProfile)) {
      return false;
    }

    const dimensions = Array.isArray(card.dimensions) ? card.dimensions : [];
    const symbols = Array.isArray(card.symbols) ? card.symbols.slice(0, 3) : [];

    return hasTextValue(card.archetype.id)
      && hasTextValue(card.archetype.summary)
      && hasTextList(card.archetype.evidence, 2)
      && hasTextValue(card.coreInsight)
      && dimensionDefinitions.every((definition) => {
        const dimension = dimensions.find((item) => isPlainObject(item) && item.id === definition.id);
        return dimension
          && hasScoreValue(dimension.score)
          && hasTextList(dimension.rationale);
      })
      && symbols.length > 0
      && symbols.every((symbol) => (
        isPlainObject(symbol)
        && hasTextValue(symbol.name)
        && hasTextValue(symbol.contextMeaning)
        && hasTextValue(symbol.evidence)
        && hasTextValue(symbol.reflectionQuestion)
      ))
      && hasTextValue(card.emotionalProfile.primary)
      && hasScoreValue(card.emotionalProfile.intensity)
      && hasTextValue(card.emotionalProfile.evidence)
      && hasTextList(card.reflectionQuestions)
      && typeof card.safetyReminder === "string"
      && card.safetyReminder.includes(safetyReminder);
  }

  function getDreamResultCardDisplayState(record) {
    const savedCard = getDreamResultCardFromRecord(record);
    const statusValue = getDreamResultCardStatusFromRecord(record);

    if (!savedCard || statusValue === "generation_failed") {
      return "generation_failed";
    }

    return isCompleteCard(savedCard) ? "complete" : "partial_historical";
  }

  function getDimensionDefinitions() {
    return dimensionDefinitions.map((item) => ({ ...item }));
  }

  function createElement(documentRef, tagName, className, value) {
    const element = documentRef.createElement(tagName);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  }

  function appendTextElement(documentRef, parent, tagName, className, value) {
    const element = createElement(documentRef, tagName, className, value);
    parent.append(element);
    return element;
  }

  function renderDimension(documentRef, dimension) {
    const hasScore = dimension.score !== null;
    const section = createElement(documentRef, "section", "result-card-dimension");
    const heading = createElement(documentRef, "div", "result-card-dimension-heading");
    appendTextElement(documentRef, heading, "strong", "", dimension.name);
    appendTextElement(documentRef, heading, "span", hasScore ? "" : "result-card-score-missing", hasScore ? `${dimension.score}` : missingScoreText);
    const details = createElement(documentRef, "details", "result-card-rationale");
    appendTextElement(documentRef, details, "summary", "", hasScore ? "为什么" : "观察依据");
    const list = createElement(documentRef, "ul", "");
    const rationale = dimension.rationale.length ? dimension.rationale : [fallbackText];
    rationale.forEach((item) => appendTextElement(documentRef, list, "li", "", item));
    details.append(list);
    section.append(heading);
    if (hasScore) {
      const progress = createElement(documentRef, "div", "result-card-progress");
      const fill = createElement(documentRef, "span", "");
      fill.style.width = `${dimension.score}%`;
      progress.append(fill);
      section.append(progress);
    }
    appendTextElement(documentRef, section, "p", "", dimension.summary);
    section.append(details);
    return section;
  }

  function renderSymbol(documentRef, symbol) {
    const article = createElement(documentRef, "article", "result-card-symbol");
    appendTextElement(documentRef, article, "h4", "", symbol.name);
    appendTextElement(documentRef, article, "p", "", symbol.contextMeaning);
    appendTextElement(documentRef, article, "p", "", `识别线索：${symbol.evidence}`);
    appendTextElement(documentRef, article, "p", "", `你可以思考：${symbol.reflectionQuestion}`);
    return article;
  }

  function renderSharePreview(documentRef, card) {
    const preview = createElement(documentRef, "section", "result-card-share-preview");
    appendTextElement(documentRef, preview, "p", "result-card-share-brand", "Dream Anatomy");
    appendTextElement(documentRef, preview, "h3", "", "梦境画像");
    appendTextElement(documentRef, preview, "strong", "", card.archetype.nameZh);
    appendTextElement(documentRef, preview, "p", "", card.coreInsight);
    appendTextElement(documentRef, preview, "p", "", card.symbols.map((symbol) => symbol.name).join(" · ") || "梦境意象");
    const rows = createElement(documentRef, "div", "result-card-share-dimensions");
    card.dimensions.forEach((dimension) => {
      appendTextElement(documentRef, rows, "p", "", `${dimension.name} ${dimension.score === null ? shareMissingScoreText : dimension.score}`);
    });
    preview.append(rows);
    appendTextElement(documentRef, preview, "small", "", "这是一次自我探索视角，不是诊断或预测。");
    return preview;
  }

  function renderExistingCard(documentRef, card, statusMessage, displayState = "complete", generationMeta = {}) {
    const root = createElement(documentRef, "section", "dream-result-card");
    appendTextElement(documentRef, root, "h2", "", "梦境画像");
    if (generationMeta && generationMeta.limitedEvidence === true) {
      appendTextElement(documentRef, root, "p", "result-card-status", "基于有限线索的暂定画像");
      appendTextElement(documentRef, root, "p", "result-card-note", "这张画像依据的是本次记录中呈现的线索。它不是对你的固定判断，补充更多梦境细节后，画像可能会有所变化。");
    }
    if (displayState === "partial_historical") {
      appendTextElement(documentRef, root, "p", "result-card-status", partialHistoricalMessage);
    }
    if (statusMessage) {
      appendTextElement(documentRef, root, "p", "result-card-status", statusMessage);
    }

    const hero = createElement(documentRef, "section", "result-card-hero");
    appendTextElement(documentRef, hero, "h3", "", "梦境原型");
    appendTextElement(documentRef, hero, "p", "", "本次梦境更接近：");
    appendTextElement(documentRef, hero, "strong", "", card.archetype.nameZh);
    appendTextElement(documentRef, hero, "span", "", card.archetype.nameEn);
    appendTextElement(documentRef, hero, "p", "", card.archetype.summary);
    if (card.archetype.evidence.length) {
      const evidence = createElement(documentRef, "details", "result-card-rationale");
      appendTextElement(documentRef, evidence, "summary", "", "识别线索");
      const list = createElement(documentRef, "ul", "");
      card.archetype.evidence.forEach((item) => appendTextElement(documentRef, list, "li", "", item));
      evidence.append(list);
      hero.append(evidence);
    }

    const insight = createElement(documentRef, "section", "result-card-insight");
    appendTextElement(documentRef, insight, "h3", "", "一句话核心洞察");
    appendTextElement(documentRef, insight, "p", "", card.coreInsight);

    const dimensions = createElement(documentRef, "section", "result-card-dimensions");
    appendTextElement(documentRef, dimensions, "h3", "", "梦境维度");
    card.dimensions.forEach((dimension) => dimensions.append(renderDimension(documentRef, dimension)));
    appendTextElement(documentRef, dimensions, "p", "result-card-note", "这些分数用于帮助整理梦境线索，不是心理测量结果。");

    const symbols = createElement(documentRef, "section", "result-card-symbols");
    appendTextElement(documentRef, symbols, "h3", "", "主要意象");
    if (card.symbols.length) {
      card.symbols.forEach((symbol) => symbols.append(renderSymbol(documentRef, symbol)));
    } else {
      appendTextElement(documentRef, symbols, "p", "", "暂未整理出主要意象，你可以从最想记住的画面开始观察。");
    }

    const emotion = createElement(documentRef, "section", "result-card-emotion");
    appendTextElement(documentRef, emotion, "h3", "", "情绪画像");
    appendTextElement(documentRef, emotion, "p", "", `主要情绪：${card.emotionalProfile.primary}`);
    if (card.emotionalProfile.secondary.length) {
      appendTextElement(documentRef, emotion, "p", "", `伴随情绪：${card.emotionalProfile.secondary.join("、")}`);
    }
    appendTextElement(
      documentRef,
      emotion,
      "p",
      "",
      `情绪强度：${card.emotionalProfile.intensity === null ? missingScoreText : card.emotionalProfile.intensity}`
    );
    appendTextElement(documentRef, emotion, "p", "", card.emotionalProfile.evidence);
    appendTextElement(documentRef, emotion, "p", "result-card-note", "这反映的是梦境中的情绪线索，不代表现实中的固定心理状态。");

    const reflection = createElement(documentRef, "section", "result-card-reflection");
    appendTextElement(documentRef, reflection, "h3", "", "自我思考");
    const questions = card.reflectionQuestions.length ? card.reflectionQuestions : ["这个梦里哪个画面最想被你记住？"];
    const list = createElement(documentRef, "ul", "");
    questions.forEach((question) => appendTextElement(documentRef, list, "li", "", question));
    reflection.append(list);

    const share = createElement(documentRef, "section", "");
    appendTextElement(documentRef, share, "h3", "", "分享卡片预览");
    share.append(renderSharePreview(documentRef, card));
    appendTextElement(documentRef, root, "p", "result-card-disclaimer", card.safetyReminder);
    root.append(hero, insight, dimensions, symbols, emotion, reflection, share);
    return root;
  }

  function getGenerationErrorMessage(error, fallbackMessage) {
    const code = error && typeof error.code === "string" ? error.code : "";
    return generationErrorMessages[code] || fallbackMessage || "暂时无法生成梦境画像，请稍后再试。";
  }

  function createDreamResultCardController(options = {}) {
    const documentRef = options.document || (typeof document !== "undefined" ? document : null);

    function renderEmptyCard(container, record) {
      let isGenerating = false;
      const statusValue = getDreamResultCardStatusFromRecord(record);
      const isGenerationFailed = statusValue === "generation_failed";
      const empty = createElement(documentRef, "section", "dream-result-card dream-result-card-empty");
      appendTextElement(documentRef, empty, "h2", "", "梦境画像");
      appendTextElement(documentRef, empty, "p", "", isGenerationFailed ? "梦境画像暂时未能完整生成。" : "尚未生成梦境画像");
      appendTextElement(
        documentRef,
        empty,
        "p",
        "",
        isGenerationFailed
          ? "文字分析仍可以阅读；你也可以稍后重新生成梦境画像。"
          : "生成是可选的，只为帮助你整理这一次梦境的线索。"
      );
      const status = createElement(documentRef, "p", "result-card-status", "");
      const button = createElement(documentRef, "button", "primary-button", isGenerationFailed ? "重新生成梦境画像" : "生成梦境画像");
      button.type = "button";
      button.addEventListener("click", async () => {
        if (isGenerating) return;
        if (typeof options.requestResultCard !== "function") return;
        isGenerating = true;
        button.disabled = true;
        status.textContent = isGenerationFailed ? "正在重新整理梦境画像……" : "正在整理梦境画像……";
        try {
          const rawCard = await options.requestResultCard(record);
          const normalizedCard = normalizeDreamResultCard(rawCard, record);
          const result = typeof options.saveResultCard === "function"
            ? await options.saveResultCard(record, normalizedCard)
            : null;
          const statusMessage = result && result.syncStatus === "pending_sync"
            ? "梦境画像已生成，正在等待云端同步。"
            : "";
          render(container, { ...record, reportContent: { ...(record.reportContent || {}), dreamResultCard: normalizedCard, dreamResultCardStatus: "ai_generated" } }, statusMessage);
        } catch (error) {
          isGenerating = false;
          button.disabled = false;
          status.textContent = getGenerationErrorMessage(error, options.generationErrorMessage);
        }
      });
      empty.append(button, status);
      container.replaceChildren(empty);
    }

    function render(container, record, statusMessage = "") {
      if (!documentRef || !container) return;
      const savedCard = getDreamResultCardFromRecord(record);
      const displayState = getDreamResultCardDisplayState(record);
      if (!savedCard || displayState === "generation_failed") {
        renderEmptyCard(container, record);
        return;
      }
      const statusValue = getDreamResultCardStatusFromRecord(record);
      const normalizedCard = normalizeDreamResultCard(savedCard, record, {
        allowUnavailableScores: statusValue === "generation_failed"
      });
      container.replaceChildren(renderExistingCard(documentRef, normalizedCard, statusMessage, displayState, getGenerationMetaFromRecord(record)));
    }

    return { render };
  }

  return {
    normalizeDreamResultCard,
    getDreamResultCardFromRecord,
    getDreamResultCardDisplayState,
    getDimensionDefinitions,
    createDreamResultCardController
  };
});
