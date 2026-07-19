const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function listFiles(dir, matcher = () => true) {
  const absolute = path.join(root, dir);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const nested = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(nested, matcher) : (matcher(nested) ? [nested] : []);
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("mini program visual language uses shared tokens and keeps page paths stable", () => {
  const appJson = JSON.parse(read("miniprogram/app.json"));
  assert.deepEqual(appJson.pages, [
    "pages/home/index",
    "pages/quick/index",
    "pages/result/index",
    "pages/journal/index",
    "pages/detail/index",
    "pages/privacy/index",
    "pages/profile/index"
  ]);

  const appWxss = read("miniprogram/app.wxss");
  [
    "Mini Program visual tokens",
    "parchment",
    "warm charcoal",
    "muted olive",
    ".page-hero",
    ".visual-orbit",
    ".archive-panel",
    ".manuscript-panel",
    ".identity-seal",
    ".danger-button",
    ".long-text-safe"
  ].forEach((needle) => assert.match(appWxss, new RegExp(escapeRegExp(needle))));
});

test("each mini program page has restrained page-level visual identity", () => {
  const expected = {
    home: ["data-visual=\"home-archive\"", "梦并不急着给出答案"],
    quick: ["data-visual=\"quick-workbench\"", "情绪有时比解释更早接近真相"],
    result: ["data-visual=\"result-report\"", "心理档案报告"],
    journal: ["data-visual=\"journal-archive\"", "私人梦境档案"],
    detail: ["data-visual=\"detail-manuscript\"", "手稿记录"],
    privacy: ["data-visual=\"privacy-ledger\"", "档案文书"],
    profile: ["data-visual=\"profile-seal\"", "本机游客档案"]
  };

  Object.entries(expected).forEach(([page, needles]) => {
    const source = read(`miniprogram/pages/${page}/index.wxml`);
    needles.forEach((needle) => assert.match(source, new RegExp(escapeRegExp(needle))));
    assert.match(source, /aria-hidden="true"/, `${page} decorative visual should be hidden`);
  });
});

test("mini program visual refresh keeps guest-only and asset boundaries", () => {
  const files = listFiles("miniprogram", (file) => /\.(js|json|wxml|wxss)$/.test(file));
  const source = files.map((file) => `${file}\n${read(file)}`).join("\n");

  assert.doesNotMatch(source, /https?:\/\/[^"']+\.(?:png|jpe?g|webp|gif|svg|ttf|otf|woff2?)/i);
  assert.doesNotMatch(source, /base64,[A-Za-z0-9+/=]{200,}/);
  assert.doesNotMatch(source, /taro|uni-app|react|vue/i);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|SUPABASE_SERVICE_ROLE_KEY|ANALYTICS_HASH_SECRET|AppSecret/i);
  assert.doesNotMatch(source, /wx\.login|code2Session|openid|unionid|session_key/i);
  assert.doesNotMatch(source, /Authorization\s*:|Bearer\s+/i);
  assert.doesNotMatch(source, /\/chat\/completions|api\.deepseek\.com/i);
  assert.doesNotMatch(source, /产品行为统计|product-events|trackProductEvent/i);
});

test("mini program visual documentation records original asset and manual verification boundaries", () => {
  const docs = read("docs/MINIPROGRAM_VISUAL_LANGUAGE.md");
  assert.match(docs, /原创装饰资产清单/);
  assert.match(docs, /不依赖远程图片/);
  assert.match(docs, /微信开发者工具/);
  assert.match(docs, /尚未完成真机验收|真机验收/);
});
