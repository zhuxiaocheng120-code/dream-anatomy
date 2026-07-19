const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const miniRoot = path.join(root, "miniprogram");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function listFiles(dir, matcher = () => true) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const nested = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(nested, matcher) : (matcher(nested) ? [nested] : []);
  });
}

test("mini program app shell registers required native pages and uses no extra framework", () => {
  assert.equal(exists("miniprogram/app.js"), true);
  assert.equal(exists("miniprogram/app.json"), true);
  assert.equal(exists("miniprogram/app.wxss"), true);
  assert.equal(exists("miniprogram/sitemap.json"), true);

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
  assert.doesNotMatch(JSON.stringify(appJson), /taro|uni-app|react|vue/i);
});

test("mini program pages expose guest core loop and disabled deep guidance", () => {
  const requiredPages = ["home", "quick", "result", "journal", "detail", "privacy", "profile"];
  for (const page of requiredPages) {
    for (const ext of ["js", "json", "wxml", "wxss"]) {
      assert.equal(exists(`miniprogram/pages/${page}/index.${ext}`), true, `${page}.${ext} missing`);
    }
  }

  const home = read("miniprogram/pages/home/index.wxml");
  assert.match(home, /析梦 Dream Anatomy/);
  assert.match(home, /快速解析/);
  assert.match(home, /深度引导/);
  assert.match(home, /正在开发中/);
  assert.match(home, /梦境日记/);

  const quick = read("miniprogram/pages/quick/index.wxml");
  assert.match(quick, /我已阅读并同意/);
  assert.match(quick, /用户协议/);
  assert.match(quick, /隐私政策/);
  assert.match(quick, /AI 使用说明/);
  assert.doesNotMatch(quick, /Authorization|Bearer|登录后/i);

  const result = read("miniprogram/pages/result/index.wxml");
  assert.match(result, /梦境画像/);
  assert.match(result, /梦境原型/);
  assert.match(result, /一句话洞察/);
  assert.match(result, /分享卡片预览/);
  assert.match(result, /梦境画像暂未生成/);

  assert.match(read("miniprogram/pages/journal/index.wxml"), /本机梦境日记/);
  assert.match(read("miniprogram/pages/detail/index.wxml"), /删除这条梦境/);
  assert.match(read("miniprogram/pages/privacy/index.wxml"), /隐私与数据/);
  assert.match(read("miniprogram/pages/profile/index.wxml"), /游客模式/);
});

test("mini program reusable components exist and avoid rich-text rendering", () => {
  const components = ["loading-state", "error-state", "confirmation-modal", "legal-document", "result-card"];
  for (const component of components) {
    for (const ext of ["js", "json", "wxml", "wxss"]) {
      assert.equal(exists(`miniprogram/components/${component}/index.${ext}`), true, `${component}.${ext} missing`);
    }
  }

  const wxmlFiles = listFiles("miniprogram", (file) => file.endsWith(".wxml"));
  assert.ok(wxmlFiles.length > 0);
  for (const file of wxmlFiles) {
    assert.doesNotMatch(read(file), /<\s*rich-text\b/i, `${file} uses rich-text`);
    assert.doesNotMatch(read(file), /innerHTML|dangerouslySetInnerHTML/i, `${file} uses unsafe HTML`);
  }
});

test("mini program source does not include forbidden secrets or disallowed platform calls", () => {
  const files = listFiles("miniprogram", (file) => /\.(js|json|wxml|wxss)$/.test(file));
  const source = files.map((file) => `${file}\n${read(file)}`).join("\n");

  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|SUPABASE_SERVICE_ROLE_KEY|ANALYTICS_HASH_SECRET|AppSecret/i);
  assert.doesNotMatch(source, /wx\.login|code2Session|openid|unionid|session_key/i);
  assert.doesNotMatch(source, /\/chat\/completions|api\.deepseek\.com/i);
  assert.doesNotMatch(source, /Authorization\s*:/i);
  assert.doesNotMatch(source, /product-events|product_analytics|trackProductEvent/i);
  assert.doesNotMatch(source, /\.\.\/\.\.\/src\//);
});

test("mini program docs and private config boundaries are explicit", () => {
  assert.equal(exists("docs/MINIPROGRAM_SETUP.md"), true);
  assert.equal(exists("docs/MINIPROGRAM_ARCHITECTURE.md"), true);
  assert.equal(exists("miniprogram/project.config.example.json"), true);

  const gitignore = read(".gitignore");
  assert.match(gitignore, /miniprogram\/project\.config\.json/);
  assert.match(gitignore, /miniprogram\/config\/config\.js/);

  const setup = read("docs/MINIPROGRAM_SETUP.md");
  assert.match(setup, /微信开发者工具/);
  assert.match(setup, /AppID/);
  assert.match(setup, /request 合法域名/);
  assert.match(setup, /API_BASE_URL/);
  assert.match(setup, /开发版/);
  assert.match(setup, /体验版/);
  assert.match(setup, /正式版/);
  assert.match(setup, /不要在小程序中配置 AppSecret/);
  assert.match(setup, /尚未完成真机验收/);

  const architecture = read("docs/MINIPROGRAM_ARCHITECTURE.md");
  assert.match(architecture, /游客版核心闭环/);
  assert.match(architecture, /不调用 DeepSeek/);
  assert.match(architecture, /不接入微信登录/);
  assert.match(architecture, /本机存储/);
  assert.match(architecture, /dream_anatomy_guest_records_v1/);
  assert.match(architecture, /深度引导.*正在开发中/);
});
