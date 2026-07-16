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
