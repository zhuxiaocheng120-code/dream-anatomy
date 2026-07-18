const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.join(__dirname, "..");

function readProjectFile(filePath) {
  return fs.readFileSync(path.join(rootDir, filePath), "utf8");
}

test("dream_records migrations enforce per-user RLS policies", () => {
  const baseMigration = readProjectFile("supabase/migrations/20260711000000_create_dream_records.sql");
  const syncMigration = readProjectFile("supabase/migrations/20260711001000_add_dream_record_sync_fields.sql");

  assert.match(baseMigration, /user_id uuid not null references auth\.users\(id\) on delete cascade/);
  assert.match(baseMigration, /alter table public\.dream_records enable row level security/);
  assert.match(baseMigration, /alter table public\.dream_records force row level security/);
  assert.match(baseMigration, /for select\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)/s);
  assert.match(baseMigration, /for insert\s+to authenticated\s+with check \(auth\.uid\(\) = user_id\)/s);
  assert.match(baseMigration, /for update\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)\s+with check \(auth\.uid\(\) = user_id\)/s);
  assert.match(baseMigration, /for delete\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)/s);
  assert.doesNotMatch(baseMigration, /to anon/);
  assert.match(syncMigration, /create unique index if not exists dream_records_user_local_record_id_idx\s+on public\.dream_records \(user_id, local_record_id\)/s);
});

test("browser runtime environment exposes only public Supabase settings", () => {
  const runtimeWriter = readProjectFile("scripts/writeRuntimeEnv.js");
  const gitignore = readProjectFile(".gitignore");
  const envExample = readProjectFile(".env.example");

  assert.match(runtimeWriter, /SUPABASE_URL: process\.env\.SUPABASE_URL \|\| ""/);
  assert.match(runtimeWriter, /SUPABASE_ANON_KEY: process\.env\.SUPABASE_ANON_KEY \|\| ""/);
  assert.doesNotMatch(runtimeWriter, /DEEPSEEK_API_KEY|SERVICE_ROLE|service_role|SUPABASE_SERVICE|refresh_token|access_token/);
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^src\/runtime-env\.js$/m);
  assert.match(gitignore, /^src\/vendor\/supabase\.js$/m);
  assert.match(envExample, /^DEEPSEEK_API_KEY=$/m);
  assert.doesNotMatch(envExample, /sk-[A-Za-z0-9_-]{16,}|sb_secret/i);
  assert.doesNotMatch(envExample, /^SUPABASE_SERVICE_ROLE_KEY=.+$/m);
});

test("ai_usage_events migration creates protected analytics table", () => {
  const migration = readProjectFile("supabase/migrations/20260717000000_create_ai_usage_events.sql");

  assert.match(migration, /create table if not exists public\.ai_usage_events/);
  assert.match(migration, /request_id uuid not null unique/);
  assert.match(migration, /principal_hash text not null/);
  assert.match(migration, /constraint ai_usage_events_principal_type_check/);
  assert.match(migration, /constraint ai_usage_events_outcome_check/);
  assert.match(migration, /alter table public\.ai_usage_events enable row level security/);
  assert.match(migration, /alter table public\.ai_usage_events force row level security/);
  assert.match(migration, /revoke all on public\.ai_usage_events from anon/);
  assert.match(migration, /revoke all on public\.ai_usage_events from authenticated/);
  assert.doesNotMatch(migration, /create policy[\s\S]+ai_usage_events/i);
});

test("product analytics migration protects preferences and server-only events", () => {
  const migration = readProjectFile("supabase/migrations/20260719000000_create_product_analytics.sql");

  assert.match(migration, /create table if not exists public\.product_analytics_preferences/);
  assert.match(migration, /create table if not exists public\.product_events/);
  assert.match(migration, /event_id uuid not null unique/);
  for (const table of ["product_analytics_preferences", "product_events"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
  }
  assert.match(migration, /for select\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)/s);
  assert.match(migration, /for insert\s+to authenticated\s+with check \(auth\.uid\(\) = user_id\)/s);
  assert.match(migration, /for update\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)\s+with check \(auth\.uid\(\) = user_id\)/s);
  const productEventsSection = migration.slice(migration.indexOf("create table if not exists public.product_events"));
  assert.match(productEventsSection, /revoke all on table public\.product_events from anon/);
  assert.match(productEventsSection, /revoke all on table public\.product_events from authenticated/);
  assert.doesNotMatch(productEventsSection, /create policy/i);
  assert.doesNotMatch(migration, /ttl|retention|delete\s+from\s+public\.product_events/i);
});

test("service role and analytics secrets stay out of browser runtime config", () => {
  const runtimeWriter = readProjectFile("scripts/writeRuntimeEnv.js");
  const envExample = readProjectFile(".env.example");

  assert.doesNotMatch(runtimeWriter, /SUPABASE_SERVICE_ROLE_KEY|ADMIN_USER_IDS|ANALYTICS_HASH_SECRET/);
  assert.match(envExample, /^SUPABASE_SERVICE_ROLE_KEY=$/m);
  assert.match(envExample, /^ADMIN_USER_IDS=$/m);
  assert.match(envExample, /^ANALYTICS_HASH_SECRET=$/m);
  assert.match(envExample, /^AI_INPUT_COST_PER_1M_TOKENS=$/m);
  assert.match(envExample, /^AI_OUTPUT_COST_PER_1M_TOKENS=$/m);
});

test("server auth clients avoid persisted sessions and service role keys", () => {
  const aiAuth = readProjectFile("server/aiAuth.js");
  const helper = readProjectFile("lib/supabaseClient.js");

  for (const source of [aiAuth, helper]) {
    assert.match(source, /persistSession:\s*false/);
    assert.match(source, /autoRefreshToken:\s*false/);
    assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE|sb_secret/i);
  }
});

test("AI API responses disable caching and do not enable wildcard CORS", () => {
  const server = readProjectFile("server.js");

  assert.match(server, /response\.set\("Cache-Control", "no-store"\)/);
  assert.doesNotMatch(server, /cors\(\s*\)|Access-Control-Allow-Origin["']?\s*,\s*["']\*/);
});

test("admin analytics setup document explains secrets and long-term retention", () => {
  const docs = readProjectFile("docs/ADMIN_ANALYTICS_SETUP.md");

  assert.match(docs, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(docs, /ADMIN_USER_IDS/);
  assert.match(docs, /ANALYTICS_HASH_SECRET/);
  assert.match(docs, /AI 使用统计将在实现产品运营分析和服务改进目的所必要的期限内长期保存/);
  assert.match(docs, /当前版本不执行自动清理/);
  assert.match(docs, /不要随意轮换 ANALYTICS_HASH_SECRET/);
  assert.doesNotMatch(docs, /180 天|永久保存|永不删除/);
});

test("legal consent migration creates current-user RLS policies", () => {
  const migration = readProjectFile("supabase/migrations/20260717001000_create_legal_consents.sql");

  assert.match(migration, /create table if not exists public\.legal_consents/);
  assert.match(migration, /user_id uuid primary key references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /privacy_policy_version text not null/);
  assert.match(migration, /terms_version text not null/);
  assert.match(migration, /ai_disclaimer_version text not null/);
  assert.match(migration, /alter table public\.legal_consents enable row level security/);
  assert.match(migration, /alter table public\.legal_consents force row level security/);
  assert.match(migration, /for select\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)/s);
  assert.match(migration, /for insert\s+to authenticated\s+with check \(auth\.uid\(\) = user_id\)/s);
  assert.match(migration, /for update\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)\s+with check \(auth\.uid\(\) = user_id\)/s);
  assert.doesNotMatch(migration, /to anon/);
});

test("public support email is exposed without exposing secrets", () => {
  const runtimeWriter = readProjectFile("scripts/writeRuntimeEnv.js");
  const envExample = readProjectFile(".env.example");

  assert.match(runtimeWriter, /PUBLIC_SUPPORT_EMAIL: process\.env\.PUBLIC_SUPPORT_EMAIL \|\| ""/);
  assert.doesNotMatch(runtimeWriter, /SUPABASE_SERVICE_ROLE_KEY|ANALYTICS_HASH_SECRET|DEEPSEEK_API_KEY/);
  assert.match(envExample, /^PUBLIC_SUPPORT_EMAIL=$/m);
});

test("privacy data controls setup documents deletion and legal boundaries", () => {
  const docs = readProjectFile("docs/PRIVACY_DATA_CONTROLS_SETUP.md");

  assert.match(docs, /20260717001000_create_legal_consents\.sql/);
  assert.match(docs, /PUBLIC_SUPPORT_EMAIL/);
  assert.match(docs, /正式发布前.*专业法律/);
  assert.match(docs, /authenticated AI 使用统计/);
  assert.match(docs, /guest AI 使用统计不会被删除/);
  assert.match(docs, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(docs, /ANALYTICS_HASH_SECRET/);
  assert.match(docs, /注销账户/);
  assert.doesNotMatch(docs, /永久保存|永不删除|完全匿名|已通过律师审核/);
});
