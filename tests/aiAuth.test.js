const assert = require("node:assert/strict");
const test = require("node:test");

const { createAiAuthResolver } = require("../server/aiAuth");

function createRequest(headers = {}, overrides = {}) {
  return {
    headers,
    ip: overrides.ip || "203.0.113.24",
    body: overrides.body || {}
  };
}

function createSupabaseFactory(assertions = {}) {
  const calls = [];
  const createClient = (url, anonKey, options) => {
    calls.push({ url, anonKey, options });
    return {
      auth: {
        async getUser(token) {
          if (assertions.onGetUser) {
            return assertions.onGetUser(token);
          }

          return {
            data: { user: { id: "user-123", email: "private@example.com" } },
            error: null
          };
        }
      }
    };
  };

  return { calls, createClient };
}

test("missing Authorization header resolves to guest identity by request ip", async () => {
  const factory = createSupabaseFactory();
  const resolver = createAiAuthResolver({
    createClient: factory.createClient,
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key"
    }
  });

  const identity = await resolver.resolveIdentity(createRequest());

  assert.equal(identity.type, "guest");
  assert.equal(identity.userId, "");
  assert.equal(identity.rateLimitKey, "guest:203.0.113.24");
  assert.equal(factory.calls.length, 0);
});

test("valid Bearer token resolves authenticated user with server Supabase client options", async () => {
  const factory = createSupabaseFactory({
    onGetUser(token) {
      assert.equal(token, "access-token");
      return {
        data: { user: { id: "auth-user-1", email: "private@example.com" } },
        error: null
      };
    }
  });
  const resolver = createAiAuthResolver({
    createClient: factory.createClient,
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key"
    }
  });

  const identity = await resolver.resolveIdentity(createRequest({
    authorization: "Bearer access-token"
  }, {
    body: { userId: "forged-user" }
  }));

  assert.equal(identity.type, "authenticated");
  assert.equal(identity.userId, "auth-user-1");
  assert.equal(identity.rateLimitKey, "user:auth-user-1");
  assert.equal(factory.calls.length, 1);
  assert.equal(factory.calls[0].url, "https://example.supabase.co");
  assert.equal(factory.calls[0].anonKey, "anon-key");
  assert.deepEqual(factory.calls[0].options.auth, {
    persistSession: false,
    autoRefreshToken: false
  });
});

test("invalid token returns AUTH_INVALID without falling back to guest", async () => {
  const factory = createSupabaseFactory({
    onGetUser() {
      return { data: { user: null }, error: new Error("expired") };
    }
  });
  const resolver = createAiAuthResolver({
    createClient: factory.createClient,
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key"
    }
  });

  await assert.rejects(
    () => resolver.resolveIdentity(createRequest({ authorization: "Bearer expired-token" })),
    (error) => {
      assert.equal(error.code, "AUTH_INVALID");
      assert.equal(error.status, 401);
      return true;
    }
  );
});

test("malformed Authorization header returns AUTH_INVALID", async () => {
  const factory = createSupabaseFactory();
  const resolver = createAiAuthResolver({
    createClient: factory.createClient,
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key"
    }
  });

  await assert.rejects(
    () => resolver.resolveIdentity(createRequest({ authorization: "Token abc" })),
    (error) => {
      assert.equal(error.code, "AUTH_INVALID");
      assert.equal(error.status, 401);
      return true;
    }
  );
  assert.equal(factory.calls.length, 0);
});
