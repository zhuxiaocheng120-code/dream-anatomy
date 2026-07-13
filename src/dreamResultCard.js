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
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, number));
  }

  function normalizeDimension(value, definition) {
    const input = value && typeof value === "object" ? value : {};
    return {
      id: definition.id,
      name: definition.name,
      score: clampScore(input.score),
      summary: text(input.summary),
      rationale: textList(input.rationale, fallbackText)
    };
  }

  function normalizeDreamResultCard(raw, context) {
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
        summary: text(archetype.summary, "本次梦境更接近这个原型，也许值得从具体感受开始观察。")
      },
      coreInsight: text(input.coreInsight),
      dimensions: dimensionDefinitions.map((definition) => normalizeDimension(dimensionMap.get(definition.id), definition)),
      symbols,
      emotionalProfile: {
        primary: text(emotionalInput.primary, "未命名情绪"),
        secondary: textList(emotionalInput.secondary, ""),
        intensity: clampScore(emotionalInput.intensity),
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
    const section = createElement(documentRef, "section", "result-card-dimension");
    const heading = createElement(documentRef, "div", "result-card-dimension-heading");
    appendTextElement(documentRef, heading, "strong", "", dimension.name);
    appendTextElement(documentRef, heading, "span", "", `${dimension.score}`);
    const progress = createElement(documentRef, "div", "result-card-progress");
    const fill = createElement(documentRef, "span", "");
    fill.style.width = `${dimension.score}%`;
    progress.append(fill);
    const details = createElement(documentRef, "details", "result-card-rationale");
    appendTextElement(documentRef, details, "summary", "", "为什么");
    const list = createElement(documentRef, "ul", "");
    const rationale = dimension.rationale.length ? dimension.rationale : [fallbackText];
    rationale.forEach((item) => appendTextElement(documentRef, list, "li", "", item));
    details.append(list);
    section.append(heading, progress);
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
      appendTextElement(documentRef, rows, "p", "", `${dimension.name} ${dimension.score}`);
    });
    preview.append(rows);
    appendTextElement(documentRef, preview, "small", "", "这是一次自我探索视角，不是诊断或预测。");
    return preview;
  }

  function renderExistingCard(documentRef, card, statusMessage) {
    const root = createElement(documentRef, "section", "dream-result-card");
    appendTextElement(documentRef, root, "h2", "", "梦境画像");
    if (statusMessage) {
      appendTextElement(documentRef, root, "p", "result-card-status", statusMessage);
    }

    const hero = createElement(documentRef, "section", "result-card-hero");
    appendTextElement(documentRef, hero, "h3", "", "梦境原型");
    appendTextElement(documentRef, hero, "p", "", "本次梦境更接近：");
    appendTextElement(documentRef, hero, "strong", "", card.archetype.nameZh);
    appendTextElement(documentRef, hero, "span", "", card.archetype.nameEn);
    appendTextElement(documentRef, hero, "p", "", card.archetype.summary);

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
    appendTextElement(documentRef, emotion, "p", "", `情绪强度：${card.emotionalProfile.intensity}`);
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

  function createDreamResultCardController(options = {}) {
    const documentRef = options.document || (typeof document !== "undefined" ? document : null);

    function renderEmptyCard(container, record) {
      const empty = createElement(documentRef, "section", "dream-result-card dream-result-card-empty");
      appendTextElement(documentRef, empty, "h2", "", "梦境画像");
      appendTextElement(documentRef, empty, "p", "", "尚未生成梦境画像");
      appendTextElement(documentRef, empty, "p", "", "生成是可选的，只为帮助你整理这一次梦境的线索。");
      const status = createElement(documentRef, "p", "result-card-status", "");
      const button = createElement(documentRef, "button", "primary-button", "生成梦境画像");
      button.type = "button";
      button.addEventListener("click", async () => {
        if (typeof options.requestResultCard !== "function") return;
        button.disabled = true;
        status.textContent = "正在整理梦境画像……";
        try {
          const rawCard = await options.requestResultCard(record);
          const normalizedCard = normalizeDreamResultCard(rawCard, record);
          const result = typeof options.saveResultCard === "function"
            ? await options.saveResultCard(record, normalizedCard)
            : null;
          const statusMessage = result && result.syncStatus === "pending_sync"
            ? "梦境画像已生成，正在等待云端同步。"
            : "";
          render(container, { ...record, reportContent: { ...(record.reportContent || {}), dreamResultCard: normalizedCard } }, statusMessage);
        } catch (error) {
          button.disabled = false;
          status.textContent = "暂时无法生成梦境画像，请稍后再试。";
        }
      });
      empty.append(button, status);
      container.replaceChildren(empty);
    }

    function render(container, record, statusMessage = "") {
      if (!documentRef || !container) return;
      const savedCard = getDreamResultCardFromRecord(record);
      if (!savedCard) {
        renderEmptyCard(container, record);
        return;
      }
      container.replaceChildren(renderExistingCard(documentRef, normalizeDreamResultCard(savedCard, record), statusMessage));
    }

    return { render };
  }

  return {
    normalizeDreamResultCard,
    getDreamResultCardFromRecord,
    getDimensionDefinitions,
    createDreamResultCardController
  };
});
