const assert = require("node:assert/strict");
const test = require("node:test");

const LegalDocuments = require("../src/legalDocuments");
const { createLegalConsentVerifier, hasCurrentLegalConsent } = require("../server/legalConsent");

function createRequest(headers = {}) {
  return { headers };
}

function createSupabaseFactory(row) {
  const calls = [];
  const createClient = (url, anonKey, options) => {
    calls.push({ url, anonKey, options });
    return {
      from(tableName) {
        assert.equal(tableName, "legal_consents");
        return {
          select(columns) {
            calls.push({ select: columns });
            return {
              eq(column, value) {
                calls.push({ column, value });
                return {
                  async maybeSingle() {
                    return { data: row, error: null };
                  }
                };
              }
            };
          }
        };
      }
    };
  };
  return { calls, createClient };
}

test("legal consent verifier allows guests without querying Supabase", async () => {
  const factory = createSupabaseFactory(null);
  const verifier = createLegalConsentVerifier({
    createClient: factory.createClient,
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon" }
  });

  assert.equal(await verifier.ensureAccepted({ request: createRequest(), identity: { type: "guest" } }), true);
  assert.equal(factory.calls.length, 0);
});

test("legal consent verifier checks current authenticated legal and cross-border versions through RLS", async () => {
  const versions = LegalDocuments.getLegalVersions();
  const row = {
    privacy_policy_version: versions.privacyPolicyVersion,
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion,
    cross_border_consent_version: versions.crossBorderConsentVersion
  };
  const factory = createSupabaseFactory(row);
  const verifier = createLegalConsentVerifier({
    createClient: factory.createClient,
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon" }
  });

  assert.equal(await verifier.ensureAccepted({
    request: createRequest({ authorization: "Bearer access-token" }),
    identity: { type: "authenticated", userId: "user-1" }
  }), true);

  assert.equal(factory.calls[0].url, "https://example.supabase.co");
  assert.equal(factory.calls[0].anonKey, "anon");
  assert.deepEqual(factory.calls[0].options.auth, {
    persistSession: false,
    autoRefreshToken: false
  });
  assert.deepEqual(factory.calls[0].options.global.headers, {
    Authorization: "Bearer access-token"
  });
  assert.deepEqual(factory.calls.at(-1), { column: "user_id", value: "user-1" });
});

test("legal consent verifier rejects stale or missing cross-border consent", async () => {
  const versions = LegalDocuments.getLegalVersions();
  const factory = createSupabaseFactory({
    privacy_policy_version: versions.privacyPolicyVersion,
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion,
    cross_border_consent_version: "old"
  });
  const verifier = createLegalConsentVerifier({
    createClient: factory.createClient,
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon" }
  });

  await assert.rejects(
    () => verifier.ensureAccepted({
      request: createRequest({ authorization: "Bearer access-token" }),
      identity: { type: "authenticated", userId: "user-1" }
    }),
    (error) => {
      assert.equal(error.code, "LEGAL_CONSENT_REQUIRED");
      assert.equal(error.status, 403);
      return true;
    }
  );
});

test("hasCurrentLegalConsent requires all current versions", () => {
  const versions = LegalDocuments.getLegalVersions();
  assert.equal(hasCurrentLegalConsent({
    privacy_policy_version: versions.privacyPolicyVersion,
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion,
    cross_border_consent_version: versions.crossBorderConsentVersion
  }), true);
  assert.equal(hasCurrentLegalConsent({
    privacy_policy_version: versions.privacyPolicyVersion,
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion
  }), false);
});
