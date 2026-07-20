const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readSource(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

function readIfExists(relativePath) {
  const filePath = path.join(__dirname, "..", relativePath);
  assert.ok(fs.existsSync(filePath), `${relativePath} must exist`);
  return fs.readFileSync(filePath, "utf8");
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

  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:png|jpe?g|webp|gif|svg)/i);
  [...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].forEach((match) => {
    assert.match(match[1], /^assets\/brand\/dream-guide-|^assets\/brand\/dream-anatomy-lockup\.svg$/);
  });

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
  assert.match(baseRangeRule, /--sleep-quality-thumb-width:\s*40px/);
  assert.match(baseRangeRule, /--sleep-quality-thumb-height:\s*28px/);
  assert.match(baseRangeRule, /--sleep-quality-cloud-thumb-style:\s*dream-guide-slider-thumb-v2/);
  assert.match(css, /cloud-shaped sleep quality slider thumb/);
  assert.match(baseRangeRule, /viewBox='0 0 48 34'/);
  assert.match(baseRangeRule, /stroke='%235f6549'/);
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
  assert.match(coarsePointerBlock, /--sleep-quality-thumb-width:\s*44px/);
  assert.match(coarsePointerBlock, /--sleep-quality-thumb-height:\s*31px/);
  assert.match(coarsePointerBlock, /min-height:\s*44px/);
});

test("brand logo assets are local original SVGs without executable or external content", () => {
  [
    "src/assets/brand/dream-guide-mark.svg",
    "src/assets/brand/dream-anatomy-lockup.svg",
    "src/assets/brand/dream-guide-monochrome.svg"
  ].forEach((assetPath) => {
    const svg = readIfExists(assetPath);
    assert.match(svg, /<svg\b/);
    assert.match(svg, /<title\b/);
    assert.doesNotMatch(svg, /<script\b|\son[a-z]+\s*=|javascript:/i);
    assert.doesNotMatch(svg, /\b(?:href|src)=["']https?:|url\(["']?https?:|data:image|base64/i);
    assert.doesNotMatch(svg, /Anthropic|Claude|HEMISPHERIC|tarot|zodiac/i);
  });
});

test("Dream Guide brand assets are wired into Web UI without changing navigation hooks", () => {
  const html = readSource("src/index.html");

  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="assets\/brand\/dream-guide-mark\.svg">/);
  assert.match(html, /<button class="brand text-button" type="button" data-view-target="home" aria-label="返回析梦 Dream Anatomy 首页">/);

  [
    'class="brand-mark"',
    'class="hero-brand-seal"',
    'class="dream-guide-seal"',
    'class="auth-brand-mark"'
  ].forEach((classHook) => assert.match(html, new RegExp(classHook)));

  [
    'src="assets/brand/dream-guide-mark.svg"',
    'src="assets/brand/dream-anatomy-lockup.svg"'
  ].forEach((assetReference) => assert.match(html, new RegExp(assetReference)));

  assert.doesNotMatch(html, /\/admin\.html|new Router|createRouter|fetch\("assets\/brand/);
});

test("Dream Guide microanimations are restrained and respect reduced motion", () => {
  const css = readSource("src/style.css");

  [
    "@keyframes dreamGuideFloat",
    "@keyframes dreamSoftEnter",
    "@keyframes dreamDimensionReveal"
  ].forEach((keyframe) => assert.match(css, new RegExp(keyframe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));

  assert.doesNotMatch(css, /@keyframes dreamGuideBlink|filter:\s*brightness/);

  assert.match(css, /dreamGuideFloat[\s\S]*transform:/);
  assert.match(css, /dreamSoftEnter[\s\S]*opacity:/);
  assert.match(css, /dreamDimensionReveal[\s\S]*transform:/);

  const reducedMotion = cssMediaBlock(css, "@media (prefers-reduced-motion: reduce)");
  assert.match(reducedMotion, /animation:\s*none/);
  assert.match(reducedMotion, /transition-duration:\s*0\.01ms/);
  assert.match(reducedMotion, /\.brand-mark/);
  assert.match(reducedMotion, /\.result-card-progress span/);

  [
    ".brand-mark",
    ".hero-brand-seal",
    ".dream-guide-seal",
    ".auth-brand-mark"
  ].forEach((selector) => assert.match(cssRuleBlock(css, selector), /pointer-events:\s*none/));
});

test("brand asset documentation records beta originality and future mini program export boundary", () => {
  const docs = readIfExists("docs/BRAND_ASSETS.md");

  [
    "Dream Anatomy Beta 的原创品牌标识 v1",
    "正式商标使用前仍应完成相似标识检索和必要法律审查",
    "prefers-reduced-motion",
    "小程序"
  ].forEach((copy) => assert.match(docs, new RegExp(copy)));
});
