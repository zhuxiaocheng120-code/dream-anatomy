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
  assert.doesNotMatch(envExample, /sk-[A-Za-z0-9_-]{16,}|sb_secret|service_role/i);
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
