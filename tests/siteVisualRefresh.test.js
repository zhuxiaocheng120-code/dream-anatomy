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

test("classical archive refresh exposes shared tokens and restrained logo motion", () => {
  const html = readSource("src/index.html");
  const css = readSource("src/style.css");

  [
    "--warm-ivory:",
    "--parchment-fiber:",
    "--dark-walnut:",
    "--bronze-gold:",
    "--archive-hairline:",
    "--manuscript-shadow:"
  ].forEach((token) => assert.match(css, new RegExp(token)));

  [
    "@keyframes archiveLogoBreath",
    "@keyframes archiveLineDrift",
    "@keyframes archiveCloudLineDrift"
  ].forEach((keyframe) => assert.match(css, new RegExp(keyframe)));

  [
    ".brand-mark",
    ".hero-brand-seal",
    ".dream-guide-seal"
  ].forEach((selector) => {
    const block = cssRuleBlock(css, selector);
    assert.match(block, /archiveLogoBreath/);
    assert.match(block, /archiveLineDrift/);
  });

  [
    ".archive-cloud-mark",
    ".archive-cloud-line",
    ".cloud-breath",
    ".cloud-line-drift"
  ].forEach((selector) => assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));

  [
    /class="[^"]*\bbrand-mark\b[^"]*\barchive-cloud-mark\b[^"]*\bcloud-breath\b/,
    /class="[^"]*\bhero-brand-seal\b[^"]*\barchive-cloud-mark\b[^"]*\bcloud-breath\b/,
    /class="[^"]*\bdream-guide-seal\b[^"]*\barchive-cloud-mark\b[^"]*\bcloud-breath\b/
  ].forEach((pattern) => assert.match(html, pattern));

  assert.match(cssRuleBlock(css, ".cloud-breath"), /archiveLogoBreath\s+1[012]s/);
  assert.match(cssRuleBlock(css, ".cloud-line-drift"), /archiveCloudLineDrift\s+1[012]s/);

  const reducedMotion = cssMediaBlock(css, "@media (prefers-reduced-motion: reduce)");
  assert.match(reducedMotion, /\.brand-mark/);
  assert.match(reducedMotion, /\.hero-brand-seal/);
  assert.match(reducedMotion, /\.dream-guide-seal/);
  assert.match(reducedMotion, /\.archive-cloud-mark/);
  assert.match(reducedMotion, /\.cloud-line-drift/);

  assert.match(html, /class="archive-microcopy"/);
  assert.match(html, /梦不是答案，而是线索。/);
});

test("classical archive refresh keeps product hooks and visual boundaries", () => {
  const html = readSource("src/index.html");
  const css = readSource("src/style.css");

  [
    'class="hero archive-hero"',
    "archival-card",
    "classical-section-heading",
    "manuscript-divider"
  ].forEach((hook) => assert.match(html, new RegExp(hook)));

  [
    "data-view=\"home\"",
    "data-view=\"quick\"",
    "data-view=\"guided\"",
    "data-view=\"diary\"",
    "data-view=\"privacy-data\"",
    "data-quick-form",
    "data-journal-list-shell",
    "data-dream-detail",
    "data-privacy-data-view"
  ].forEach((hook) => assert.match(html, new RegExp(hook)));

  assert.match(css, /\.archival-card/);
  assert.match(css, /\.archive-hero/);
  assert.match(css, /\.classical-section-heading/);
  assert.match(css, /\.manuscript-divider/);
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:png|jpe?g|webp|gif|svg)/i);
});

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
    + html.match(/<section[^>]+data-view="privacy-data"[\s\S]*?<\/section>\s*<\/main>/)[0];
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

test("sleep quality slider renders a real visible cloud element over the native range", () => {
  const html = readSource("src/index.html");
  const css = readSource("src/style.css");
  const sliderShellRule = cssRuleBlock(css, ".sleep-quality-slider-shell");
  const cloudRule = cssRuleBlock(css, ".sleep-quality-cloud-visual");
  const baseRangeRule = cssRuleBlock(css, ".sleep-quality-range");
  const webkitThumbRule = cssRuleBlock(css, ".sleep-quality-range::-webkit-slider-thumb");
  const mozThumbRule = cssRuleBlock(css, ".sleep-quality-range::-moz-range-thumb");

  assert.match(html, /class="sleep-quality-slider-shell"/);
  assert.match(html, /class="sleep-quality-cloud-visual"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /<svg[^>]+viewBox="0 0 56 36"/);

  assert.match(css, /cloud-shaped sleep quality slider thumb/);
  assert.match(sliderShellRule, /position:\s*relative/);
  assert.match(sliderShellRule, /--sleep-quality-cloud-left:\s*clamp\(/);
  assert.match(cloudRule, /position:\s*absolute/);
  assert.match(cloudRule, /pointer-events:\s*none/);
  assert.match(cloudRule, /left:\s*var\(--sleep-quality-cloud-left\)/);
  assert.match(cloudRule, /width:\s*var\(--sleep-quality-thumb-width\)/);
  assert.match(cloudRule, /transform:\s*translate\(-50%,\s*-50%\)/);
  assert.match(webkitThumbRule, /background:\s*transparent/);
  assert.match(webkitThumbRule, /box-shadow:\s*none/);
  assert.match(webkitThumbRule, /opacity:\s*0/);
  assert.match(mozThumbRule, /background:\s*transparent/);
  assert.match(mozThumbRule, /box-shadow:\s*none/);
  assert.match(mozThumbRule, /opacity:\s*0/);

  assert.match(css, /rgba\(95,\s*101,\s*73,\s*0\.72\) 0 var\(--sleep-quality-progress\)/);
  assert.match(css, /rgba\(229,\s*216,\s*192,\s*0\.72\) var\(--sleep-quality-progress\) 100%/);

  const feedbackRules = [
    ".sleep-quality-slider-shell:hover .sleep-quality-cloud-visual",
    ".sleep-quality-slider-shell:focus-within .sleep-quality-cloud-visual",
    ".sleep-quality-slider-shell:active .sleep-quality-cloud-visual"
  ];

  feedbackRules.forEach((selector) => {
    const block = cssRuleBlock(css, selector);
    assert.match(block, /scale\(1\.0[458]\)/);
    assert.match(block, /filter:/);
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
    "brand-mark",
    "hero-brand-seal",
    "dream-guide-seal",
    "auth-brand-mark"
  ].forEach((classHook) => assert.match(html, new RegExp(`class="[^"]*\\b${classHook}\\b`)));

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
  assert.match(reducedMotion, /\.archive-cloud-mark/);
  assert.match(reducedMotion, /\.cloud-breath/);
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
