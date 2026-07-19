const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readSource(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
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
