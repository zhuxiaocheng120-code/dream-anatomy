const assert = require("node:assert/strict");
const test = require("node:test");

const { createAdminAuth, parseAdminUserIds } = require("../server/adminAuth");
const { createAdminSupabaseClient, isAnalyticsConfigured } = require("../server/adminSupabase");

test("parseAdminUserIds trims comma separated ids", () => {
  assert.deepEqual(parseAdminUserIds(" user-a, user-b ,, "), ["user-a", "user-b"]);
});

test("missing ADMIN_USER_IDS rejects all authenticated users", async () => {
  const adminAuth = createAdminAuth({
    env: { ADMIN_USER_IDS: "" },
    aiAuthResolver: {
      resolveIdentity: async () => ({
        type: "authenticated",
        userId: "user-a",
        rateLimitKey: "user:user-a"
      })
    }
  });

  await assert.rejects(
    () => adminAuth.requireAdminIdentity({ headers: { authorization: "Bearer token" } }),
    {
      code: "AUTH_FORBIDDEN",
      status: 403
    }
  );
});

test("admin user id is accepted only after bearer auth verification", async () => {
  const adminAuth = createAdminAuth({
    env: { ADMIN_USER_IDS: "user-a" },
    aiAuthResolver: {
      resolveIdentity: async () => ({
        type: "authenticated",
        userId: "user-a",
        rateLimitKey: "user:user-a"
      })
    }
  });

  const identity = await adminAuth.requireAdminIdentity({ headers: { authorization: "Bearer token" } });

  assert.equal(identity.userId, "user-a");
});

test("authenticated non-admin user receives AUTH_FORBIDDEN", async () => {
  const adminAuth = createAdminAuth({
    env: { ADMIN_USER_IDS: "admin-user" },
    aiAuthResolver: {
      resolveIdentity: async () => ({
        type: "authenticated",
        userId: "normal-user",
        rateLimitKey: "user:normal-user"
      })
    }
  });

  await assert.rejects(
    () => adminAuth.requireAdminIdentity({ headers: { authorization: "Bearer token" } }),
    {
      code: "AUTH_FORBIDDEN",
      status: 403
    }
  );
});

test("guest admin request returns AUTH_INVALID", async () => {
  const adminAuth = createAdminAuth({
    env: { ADMIN_USER_IDS: "user-a" },
    aiAuthResolver: {
      resolveIdentity: async () => ({
        type: "guest",
        userId: "",
        rateLimitKey: "guest:203.0.113.24"
      })
    }
  });

  await assert.rejects(
    () => adminAuth.requireAdminIdentity({ headers: {} }),
    {
      code: "AUTH_INVALID",
      status: 401
    }
  );
});

test("service role client uses server-only auth settings", () => {
  const calls = [];
  const client = createAdminSupabaseClient({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test"
    },
    createClient(url, key, options) {
      calls.push({ url, key, options });
      return { from: () => ({}) };
    }
  });

  assert.ok(client);
  assert.equal(calls[0].url, "https://example.supabase.co");
  assert.equal(calls[0].key, "service-role-test");
  assert.deepEqual(calls[0].options.auth, {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  });
});

test("analytics config requires url and service role key", () => {
  assert.equal(isAnalyticsConfigured({ SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "y" }), true);
  assert.equal(isAnalyticsConfigured({ SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "" }), false);
  assert.equal(isAnalyticsConfigured({ SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "y" }), false);
});
