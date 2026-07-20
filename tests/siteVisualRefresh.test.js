const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readSource(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

function cssRuleBlock(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule must exist`);
  return match[1];
}

function cssMediaBlock(css, mediaQuery) {
  const start = css.indexOf(mediaQuery);
  assert.notEqual(start, -1, `${mediaQuery} block must exist`);
  const openingBrace = css.indexOf("{", start);
  assert.notEqual(openingBrace, -1, `${mediaQuery} opening brace must exist`);
  let depth = 0;
  for (let index = openingBrace; index < css.length; index += 1) {
    const char = css[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(openingBrace + 1, index);
      }
    }
  }
  assert.fail(`${mediaQuery} block must close`);
}

test("site-wide visual refresh adds restrained page-level identity without external image assets", () => {
  const html = readSource("src/index.html");
  const css = readSource("src/style.css");

  [
    'data-page-visual="quick-workbench"',
    'data-page-visual="guided-path"',
    'data-page-visual="journal-archive"',
    'data-page-visual="detail-manuscript"',
    'data-page-visual="privacy-ledger"',
    'data-page-visual="auth-seal"'
  ].forEach((hook) => assert.match(html, new RegExp(hook)));

  [
    "情绪有时比解释更早接近真相。",
    "你可以慢一点，让问题先陪你靠近梦。",
    "把梦写下来，是给内在经验留一张索引卡。"
  ].forEach((copy) => assert.match(html, new RegExp(copy)));

  [
    "quick-workbench",
    "guided-path",
    "journal-archive",
    "detail-manuscript",
    "privacy-ledger",
    "auth-seal"
  ].forEach((visual) => {
    const pattern = new RegExp(`aria-hidden="true"[\\s\\S]{0,220}data-page-visual="${visual}"`);
    assert.match(html, pattern, `${visual} must be decorative and hidden from assistive tech`);
  });

  assert.doesNotMatch(html, /<img\b|https?:\/\/[^"']+\.(?:png|jpe?g|webp|gif|svg)/i);

  const addedCopyRegion = html.match(/<section class="view-panel work-panel" data-view="quick"[\s\S]*?<section class="view-panel work-panel" data-view="guided"/)[0]
    + html.match(/<section class="view-panel work-panel" data-view="guided"[\s\S]*?<section class="view-panel work-panel" data-view="diary"/)[0]
    + html.match(/<section class="view-panel work-panel" data-view="diary"[\s\S]*?<section class="view-panel work-panel admin-panel"/)[0]
    + html.match(/<section class="view-panel work-panel privacy-data-panel"[\s\S]*?<\/section>\s*<\/main>/)[0];
  assert.doesNotMatch(addedCopyRegion, /算命|吉凶|未来预测|发财|倒霉|遇灾|一定代表/);

  [
    ".page-visual-shell",
    ".page-visual-copy",
    ".work-panel-ornament",
    ".archive-divider-sketch",
    ".quick-workbench-note",
    ".guided-path-note",
    ".journal-archive-rail",
    ".detail-manuscript-mark",
    ".privacy-ledger-note",
    ".auth-archive-mark",
    ".empty-state::before"
  ].forEach((selector) => assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));

  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.page-visual-shell/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.work-panel-ornament/);
});

test("visual refresh keeps existing page hooks available for product behavior", () => {
  const html = readSource("src/index.html");

  [
    "data-quick-form",
    "data-guided-form",
    "data-guided-status",
    "data-journal-list-shell",
    "data-journal-search",
    "data-dream-detail",
    "data-dream-detail-content",
    "data-privacy-data-view",
    "data-auth-modal",
    "data-auth-login-form",
    "data-auth-register-form"
  ].forEach((hook) => assert.match(html, new RegExp(hook)));
});

test("sleep quality slider uses a restrained cloud thumb with accessible interaction states", () => {
  const css = readSource("src/style.css");
  const baseRangeRule = cssRuleBlock(css, ".sleep-quality-range");
  const webkitThumbRule = cssRuleBlock(css, ".sleep-quality-range::-webkit-slider-thumb");
  const mozThumbRule = cssRuleBlock(css, ".sleep-quality-range::-moz-range-thumb");

  assert.match(baseRangeRule, /--sleep-quality-cloud-thumb:/);
  assert.match(baseRangeRule, /--sleep-quality-thumb-width:\s*36px/);
  assert.match(baseRangeRule, /--sleep-quality-thumb-height:\s*26px/);
  assert.match(css, /cloud-shaped sleep quality slider thumb/);
  assert.match(webkitThumbRule, /background:\s*var\(--sleep-quality-cloud-thumb\) center \/ 100% 100% no-repeat/);
  assert.match(mozThumbRule, /background:\s*var\(--sleep-quality-cloud-thumb\) center \/ 100% 100% no-repeat/);

  assert.match(css, /rgba\(95,\s*101,\s*73,\s*0\.72\) 0 var\(--sleep-quality-progress\)/);
  assert.match(css, /rgba\(229,\s*216,\s*192,\s*0\.72\) var\(--sleep-quality-progress\) 100%/);

  const feedbackRules = [
    ".sleep-quality-range:hover::-webkit-slider-thumb",
    ".sleep-quality-range:focus-visible::-webkit-slider-thumb",
    ".sleep-quality-range:active::-webkit-slider-thumb",
    ".sleep-quality-range:hover::-moz-range-thumb",
    ".sleep-quality-range:focus-visible::-moz-range-thumb",
    ".sleep-quality-range:active::-moz-range-thumb"
  ];

  feedbackRules.forEach((selector) => {
    const block = cssRuleBlock(css, selector);
    assert.match(block, /transform:\s*scale\(1\.0[458]\)/);
    assert.match(block, /box-shadow:/);
  });

  const coarsePointerBlock = cssMediaBlock(css, "@media (pointer: coarse)");
  assert.match(coarsePointerBlock, /--sleep-quality-thumb-width:\s*40px/);
  assert.match(coarsePointerBlock, /--sleep-quality-thumb-height:\s*29px/);
  assert.match(coarsePointerBlock, /min-height:\s*42px/);
});
