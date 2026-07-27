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
    "@keyframes miniCloudOutlineWave",
    ".archive-cloud-mark",
    ".mini-cloud-outline-mark",
    ".mini-cloud-outline-base",
    ".mini-cloud-outline-wave",
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
    home: ["data-visual=\"home-archive\"", "mini-cloud-outline-mark", "mini-cloud-outline-wave", "不急着解释，先把它留下来"],
    quick: ["data-visual=\"quick-workbench\"", "结果仅供记录和回顾"],
    result: ["data-visual=\"result-report\"", "记录卡片预览"],
    journal: ["data-visual=\"journal-archive\"", "私人梦境档案"],
    detail: ["data-visual=\"detail-manuscript\"", "手稿记录"],
    privacy: ["data-visual=\"privacy-ledger\"", "档案文书"],
    profile: ["data-visual=\"profile-seal\"", "mini-cloud-outline-mark", "mini-cloud-outline-wave", "本机游客档案"]
  };

  Object.entries(expected).forEach(([page, needles]) => {
    const source = read(`miniprogram/pages/${page}/index.wxml`);
    needles.forEach((needle) => assert.match(source, new RegExp(escapeRegExp(needle))));
    assert.match(source, /aria-hidden="true"/, `${page} decorative visual should be hidden`);
  });
});

test("mini program cloud mark uses static outline plus wavy line states", () => {
  const appWxss = read("miniprogram/app.wxss");
  const home = read("miniprogram/pages/home/index.wxml");
  const profile = read("miniprogram/pages/profile/index.wxml");

  assert.match(appWxss, /@keyframes miniCloudOutlineWave[\s\S]*opacity/);
  assert.doesNotMatch(appWxss.match(/@keyframes miniCloudOutlineWave[\s\S]*?\n\}/)[0], /translateY|scale|rotate/);

  const baseRule = appWxss.match(/\.mini-cloud-outline-base\s*\{([^}]*)\}/)?.[1] || "";
  const waveRule = appWxss.match(/\.mini-cloud-outline-wave\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(baseRule, /opacity:\s*1/);
  assert.match(waveRule, /animation:\s*miniCloudOutlineWave\s+[3456](?:\.\d+)?s\s+ease-in-out\s+infinite/);
  assert.match(waveRule, /opacity:\s*0/);
  assert.doesNotMatch(waveRule, /transform\s*:/);

  [home, profile].forEach((source) => {
    assert.doesNotMatch(source, /<svg\b|<path\b/);
    assert.match(source, /<view\b[^>]*class="[^"]*\bmini-cloud-outline-mark\b/);
    assert.match(source, /<image\b[^>]*class="[^"]*\bmini-cloud-outline-layer\b[^"]*\bmini-cloud-outline-base\b/);
    assert.match(source, /src="\/assets\/brand\/mini-cloud-outline-base\.svg"/);
    assert.match(source, /class="[^"]*\bmini-cloud-outline-base\b/);
    assert.match(source, /class="[^"]*\bmini-cloud-outline-wave\b/);
    assert.match(source, /src="\/assets\/brand\/mini-cloud-outline-wave-a\.svg"/);
    assert.match(source, /src="\/assets\/brand\/mini-cloud-outline-wave-b\.svg"/);
    assert.match(source, /aria-hidden="true"/);
    assert.doesNotMatch(source, /mini-cloud-breath|mini-line-drift|mini-cloud-outline-flow/);
  });

  const baseAsset = read("miniprogram/assets/brand/mini-cloud-outline-base.svg");
  assert.match(baseAsset, /stroke="#5f6549"/);
  assert.match(baseAsset, /stroke-width="2"/);
  assert.doesNotMatch(baseAsset, /stroke-dash/);

  ["a", "b"].forEach((suffix) => {
    const frame = read(`miniprogram/assets/brand/mini-cloud-outline-wave-${suffix}.svg`);
    assert.match(frame, /stroke="#765329"/);
    const baseWidth = Number(baseAsset.match(/stroke-width="([0-9.]+)"/)?.[1]);
    const waveWidth = Number(frame.match(/stroke-width="([0-9.]+)"/)?.[1]);
    assert.ok(waveWidth > baseWidth, "mini wave line should be visibly stronger than the static outline");
    assert.ok(waveWidth <= baseWidth * 1.6, "mini wave line should stay restrained");
    assert.doesNotMatch(frame, /stroke-dash/);
    assert.doesNotMatch(frame, /<script|onload=|onclick=|(?:href|src)=["']https?:|url\(["']?https?:|base64|<style/i);
    assert.notEqual(
      frame.match(/d="([^"]+)"/)?.[1],
      baseAsset.match(/d="([^"]+)"/)?.[1],
      "wave asset must use a slightly different cloud outline path instead of the same path with dash offsets"
    );
  });
});

test("mini program visual refresh keeps local asset and WeChat auth boundaries", () => {
  const files = listFiles("miniprogram", (file) => /\.(js|json|wxml|wxss)$/.test(file));
  const source = files.map((file) => `${file}\n${read(file)}`).join("\n");
  const jsSource = listFiles("miniprogram", (file) => /\.js$/.test(file))
    .map((file) => `${file}\n${read(file)}`)
    .join("\n");
  const authAdapter = read("miniprogram/services/authAdapter.js");
  const quickApiClient = read("miniprogram/services/apiClient.js");

  assert.doesNotMatch(source, /https?:\/\/[^"']+\.(?:png|jpe?g|webp|gif|svg|ttf|otf|woff2?)/i);
  assert.doesNotMatch(source, /base64,[A-Za-z0-9+/=]{200,}/);
  assert.doesNotMatch(jsSource, /requestAnimationFrame|setInterval/);
  assert.doesNotMatch(source, /taro|uni-app|react|vue/i);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|SUPABASE_SERVICE_ROLE_KEY|ANALYTICS_HASH_SECRET|WECHAT_MINIPROGRAM_APP_SECRET|WECHAT_IDENTITY_HASH_SECRET|WECHAT_SESSION_HASH_SECRET|AppSecret/i);
  assert.doesNotMatch(source, /code2Session|openid|unionid|session_key/i);
  assert.match(authAdapter, /wxRef\.login|wx\.login/);
  assert.match(authAdapter, /Authorization|Bearer/);
  assert.doesNotMatch(quickApiClient, /Authorization\s*:|Bearer\s+/i);
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
