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
  assert.equal(appJson.window.navigationBarTitleText, "Dream Anatomy 梦境手札");
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
  assert.match(home, /Dream Anatomy 梦境手札/);
  assert.match(home, /AI 整理梦境/);
  assert.doesNotMatch(home, /析梦|快速解析/);
  assert.match(home, /深度记录/);
  assert.match(home, /正在开发中/);
  assert.match(home, /梦境日记/);

  const quick = read("miniprogram/pages/quick/index.wxml");
  assert.match(quick, /AI 整理梦境/);
  assert.match(quick, /保存并整理/);
  assert.match(quick, /我已阅读并同意/);
  assert.match(quick, /用户协议/);
  assert.match(quick, /隐私政策/);
  assert.match(quick, /AI 使用说明/);
  assert.doesNotMatch(quick, /快速解析|保存并解析|正在解析|解析失败|梦境含义|预示/);
  assert.doesNotMatch(quick, /Authorization|Bearer|登录后/i);

  const result = read("miniprogram/pages/result/index.wxml");
  assert.match(result, /AI 整理结果/);
  assert.match(result, /梦境线索卡/);
  assert.match(result, /文字线索整理/);
  assert.match(result, /记录卡片预览/);
  assert.doesNotMatch(result, /梦境画像|梦境原型|核心解析/);

  assert.match(read("miniprogram/pages/journal/index.wxml"), /本机梦境日记/);
  const detail = read("miniprogram/pages/detail/index.wxml");
  assert.match(detail, /记录详情/);
  assert.match(detail, /AI 辅助整理/);
  assert.match(detail, /删除这条记录/);
  assert.doesNotMatch(detail, /梦境详情|AI 分析|删除这条梦境/);
  assert.match(read("miniprogram/pages/privacy/index.wxml"), /隐私与数据/);
  const profile = read("miniprogram/pages/profile/index.wxml");
  assert.match(profile, /游客模式/);
  assert.match(profile, /使用微信身份继续/);
  assert.match(profile, /微信身份已建立/);
  assert.match(profile, /现阶段梦境仍只保存在本机/);
  assert.match(profile, /退出当前身份/);
  assert.doesNotMatch(profile, /openid|unionid|已跨设备同步|已绑定 Web 账户/i);
});

test("mini program user-facing source avoids high-risk filing copy", () => {
  const scannedFiles = listFiles("miniprogram", (file) => (
    /\.(wxml|json)$/.test(file)
      || /miniprogram\/pages\/[^/]+\/index\.js$/.test(file)
      || /miniprogram\/components\/[^/]+\/index\.js$/.test(file)
      || /miniprogram\/services\/errorMessages\.js$/.test(file)
      || /miniprogram\/services\/resultCard\.js$/.test(file)
  ) && !file.endsWith("services/legalDocuments.js")
    && !file.endsWith("utils/complianceText.js"));
  const forbidden = /析梦|解梦|算命|占卜|吉凶|预示|预测未来|通灵|命运判断|固定含义|梦境解析|AI 解梦|核心解析|梦境画像|梦境原型|象征含义|潜意识告诉你|弗洛伊德|荣格/u;

  for (const file of scannedFiles) {
    assert.doesNotMatch(read(file), forbidden, `${file} contains high-risk visible copy`);
  }
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

  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|SUPABASE_SERVICE_ROLE_KEY|ANALYTICS_HASH_SECRET|WECHAT_MINIPROGRAM_APP_SECRET|WECHAT_IDENTITY_HASH_SECRET|WECHAT_SESSION_HASH_SECRET|AppSecret/i);
  assert.doesNotMatch(source, /code2Session|openid|unionid|session_key/i);
  assert.doesNotMatch(source, /\/chat\/completions|api\.deepseek\.com/i);
  assert.doesNotMatch(source, /product-events|product_analytics|trackProductEvent/i);
  assert.doesNotMatch(source, /\.\.\/\.\.\/src\//);

  const authAdapter = read("miniprogram/services/authAdapter.js");
  assert.match(authAdapter, /wxRef\.login|wx\.login/);
  assert.match(authAdapter, /Authorization/);
  assert.doesNotMatch(read("miniprogram/services/apiClient.js"), /Authorization\s*:/i);
});

test("wechat auth migration keeps identity tables server-only", () => {
  const migrationPath = "supabase/migrations/20260720000000_create_wechat_auth.sql";
  assert.equal(exists(migrationPath), true);
  const sql = read(migrationPath);

  assert.match(sql, /create table if not exists public\.wechat_accounts/i);
  assert.match(sql, /create table if not exists public\.wechat_sessions/i);
  assert.match(sql, /openid_hash text not null/i);
  assert.match(sql, /unionid_hash text/i);
  assert.match(sql, /token_hash text not null unique/i);
  assert.doesNotMatch(sql, /\bopenid\b text|\bunionid\b text|session_key|wechat_code/i);
  assert.match(sql, /alter table public\.wechat_accounts enable row level security/i);
  assert.match(sql, /alter table public\.wechat_accounts force row level security/i);
  assert.match(sql, /alter table public\.wechat_sessions enable row level security/i);
  assert.match(sql, /alter table public\.wechat_sessions force row level security/i);
  assert.match(sql, /revoke all on table public\.wechat_accounts from anon/i);
  assert.match(sql, /revoke all on table public\.wechat_accounts from authenticated/i);
  assert.match(sql, /revoke all on table public\.wechat_sessions from anon/i);
  assert.match(sql, /revoke all on table public\.wechat_sessions from authenticated/i);
});

test("wechat auth server-only env vars are documented without public exposure", () => {
  const envExample = read(".env.example");
  assert.match(envExample, /WECHAT_MINIPROGRAM_APP_ID=/);
  assert.match(envExample, /WECHAT_MINIPROGRAM_APP_SECRET=/);
  assert.match(envExample, /WECHAT_IDENTITY_HASH_SECRET=/);
  assert.match(envExample, /WECHAT_SESSION_HASH_SECRET=/);

  const runtimeWriter = read("scripts/writeRuntimeEnv.js");
  assert.doesNotMatch(runtimeWriter, /WECHAT_MINIPROGRAM_APP_SECRET|WECHAT_IDENTITY_HASH_SECRET|WECHAT_SESSION_HASH_SECRET/);
});

test("mini program docs and private config boundaries are explicit", () => {
  assert.equal(exists("docs/MINIPROGRAM_SETUP.md"), true);
  assert.equal(exists("docs/MINIPROGRAM_ARCHITECTURE.md"), true);
  assert.equal(exists("docs/WECHAT_AUTH_SETUP.md"), true);
  assert.equal(exists("docs/WECHAT_AUTH_ARCHITECTURE.md"), true);
  assert.equal(exists("miniprogram/project.config.example.json"), true);

  const gitignore = read(".gitignore");
  assert.match(gitignore, /miniprogram\/project\.config\.json/);
  assert.match(gitignore, /miniprogram\/config\/config\.js/);

  const setup = read("docs/MINIPROGRAM_SETUP.md");
  assert.match(setup, /Dream Anatomy 梦境手札/);
  assert.match(setup, /AI 辅助文字整理工具/);
  assert.match(setup, /MINIPROGRAM_COMPLIANCE_COPY/);
  assert.match(setup, /微信开发者工具/);
  assert.match(setup, /AppID/);
  assert.match(setup, /request 合法域名/);
  assert.match(setup, /API_BASE_URL/);
  assert.match(setup, /开发版/);
  assert.match(setup, /体验版/);
  assert.match(setup, /正式版/);
  assert.match(setup, /不要在小程序中配置 AppSecret/);
  assert.match(setup, /使用微信身份继续/);
  assert.match(setup, /WECHAT_MINIPROGRAM_APP_ID/);
  assert.match(setup, /尚未完成真机验收/);

  const architecture = read("docs/MINIPROGRAM_ARCHITECTURE.md");
  assert.match(architecture, /梦境记录、睡眠感受记录与 AI 辅助文字整理工具/);
  assert.match(architecture, /梦境线索卡/);
  assert.match(architecture, /游客版核心闭环/);
  assert.match(architecture, /不调用 DeepSeek/);
  assert.match(architecture, /微信身份桥接/);
  assert.match(architecture, /不伪造 Supabase Session/);
  assert.match(architecture, /不做云同步/);
  assert.match(architecture, /本机存储/);
  assert.match(architecture, /dream_anatomy_guest_records_v1/);
  assert.match(architecture, /深度记录.*正在开发中/);

  const wechatSetup = read("docs/WECHAT_AUTH_SETUP.md");
  assert.match(wechatSetup, /20260720000000_create_wechat_auth\.sql/);
  assert.match(wechatSetup, /WECHAT_MINIPROGRAM_APP_SECRET/);
  assert.match(wechatSetup, /WECHAT_IDENTITY_HASH_SECRET/);
  assert.match(wechatSetup, /WECHAT_SESSION_HASH_SECRET/);
  assert.match(wechatSetup, /Render Dashboard/);
  assert.match(wechatSetup, /微信开发者工具/);
  assert.match(wechatSetup, /当前没有云同步/);

  const wechatArchitecture = read("docs/WECHAT_AUTH_ARCHITECTURE.md");
  assert.match(wechatArchitecture, /不透明 Session Token/);
  assert.match(wechatArchitecture, /不返回 openid、unionid 或 session_key/);
  assert.match(wechatArchitecture, /不创建假的 Supabase Session/);
  assert.match(wechatArchitecture, /cloudSyncAvailable: false/);
  assert.match(wechatArchitecture, /退出当前 Session/);
});

test("mini program compliance copy document includes filing review note", () => {
  assert.equal(exists("docs/MINIPROGRAM_COMPLIANCE_COPY.md"), true);
  const docs = read("docs/MINIPROGRAM_COMPLIANCE_COPY.md");

  assert.match(docs, /个人梦境记录、睡眠感受记录与 AI 辅助文字整理工具/);
  assert.match(docs, /摘要整理、情绪词识别、意象关键词整理/);
  assert.match(docs, /不提供解梦、算命、占卜、吉凶判断、未来预测、通灵/);
  assert.match(docs, /不对梦境符号作固定含义解释/);
  assert.match(docs, /不是医疗、心理诊断或心理治疗服务/);
});
