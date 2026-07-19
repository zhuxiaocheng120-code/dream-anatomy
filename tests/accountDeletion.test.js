const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAccountDeletionService,
  createAuthenticatedPrincipalHash
} = require("../server/accountDeletion");

const verifiedUserId = "00000000-0000-4000-8000-000000000001";

function createRequest({ headers = {}, body = {} } = {}) {
  return { headers, body, ip: "127.0.0.1" };
}

function createFakeAdminClient(options = {}) {
  const state = {
    deletes: [],
    authDeletes: [],
    events: [],
    productEvents: options.productEvents ? options.productEvents.map((event) => ({ ...event })) : [],
    failTable: options.failTable || "",
    failAuthDelete: Boolean(options.failAuthDelete),
    omitAuthAdmin: Boolean(options.omitAuthAdmin)
  };

  const client = {
    state,
    from(tableName) {
      return {
        delete() {
          const filters = [];
          return {
            eq(column, value) {
              filters.push({ column, value });
              return this;
            },
            async then(resolve) {
              state.deletes.push({ tableName, filters });
              state.events.push(`delete:${tableName}`);

              if (state.failTable === tableName) {
                return resolve({ data: null, error: new Error("delete failed") });
              }

              if (tableName === "product_events") {
                state.productEvents = state.productEvents.filter((event) => {
                  return !filters.every((filter) => event[filter.column] === filter.value);
                });
              }

              return resolve({ data: null, error: null });
            }
          };
        }
      };
    },
    auth: {
      admin: {
        async deleteUser(userId) {
          state.authDeletes.push(userId);
          state.events.push(`auth:${userId}`);

          if (state.failAuthDelete) {
            return { data: null, error: new Error("auth failed") };
          }

          return { data: { user: { id: userId } }, error: null };
        }
      }
    }
  };

  if (state.omitAuthAdmin) {
    client.auth = {};
  }

  return client;
}

function createService(options = {}) {
  const adminClient = options.adminClient || createFakeAdminClient();
  const service = createAccountDeletionService({
    aiAuthResolver: {
      resolveIdentity: async () => options.identity || { type: "authenticated", userId: verifiedUserId }
    },
    env: {
      ANALYTICS_HASH_SECRET: "analytics-secret"
    },
    getAdminClient: () => options.adminClient === null ? null : adminClient,
    requestIdFactory: () => "request-1"
  });

  return { adminClient, service };
}

test("guest account deletion is rejected", async () => {
  const { service } = createService({ identity: { type: "guest", userId: "" } });

  await assert.rejects(
    () => service.deleteAccount(createRequest({ body: { confirmation: "注销账户" } })),
    (error) => error.code === "AUTH_INVALID" && error.status === 401
  );
});

test("wrong confirmation is rejected before service role operations", async () => {
  const { adminClient, service } = createService();

  await assert.rejects(
    () => service.deleteAccount(createRequest({ body: { confirmation: "wrong" } })),
    (error) => error.code === "INVALID_REQUEST" && error.status === 400
  );

  assert.equal(adminClient.state.deletes.length, 0);
  assert.equal(adminClient.state.authDeletes.length, 0);
});

test("deletes only data for the verified user and ignores body identity fields", async () => {
  const matchingHash = createAuthenticatedPrincipalHash(verifiedUserId, "analytics-secret");
  const adminClient = createFakeAdminClient({
    productEvents: [
      { principal_type: "authenticated", principal_hash: matchingHash },
      { principal_type: "guest", principal_hash: matchingHash }
    ]
  });
  const { service } = createService({
    adminClient,
    identity: { type: "authenticated", userId: verifiedUserId }
  });

  const result = await service.deleteAccount(createRequest({
    body: {
      confirmation: "注销账户",
      userId: "attacker-user",
      email: "private@example.com"
    }
  }));

  assert.equal(result.ok, true);
  assert.equal(result.requestId, "request-1");
  assert.deepEqual(adminClient.state.deletes.map((item) => item.tableName), [
    "ai_usage_events",
    "product_events",
    "product_analytics_preferences",
    "legal_consents",
    "dream_records"
  ]);
  assert.deepEqual(adminClient.state.events, [
    "delete:ai_usage_events",
    "delete:product_events",
    `auth:${verifiedUserId}`,
    "delete:product_analytics_preferences",
    "delete:legal_consents",
    "delete:dream_records"
  ]);
  assert.deepEqual(adminClient.state.deletes[0].filters.map((filter) => filter.column), ["principal_type", "principal_hash"]);
  assert.equal(adminClient.state.deletes[0].filters[0].value, "authenticated");
  assert.notEqual(adminClient.state.deletes[0].filters[1].value, "guest:verified-user");
  assert.deepEqual(adminClient.state.deletes[1].filters.map((filter) => filter.column), ["principal_type", "principal_hash"]);
  assert.equal(adminClient.state.deletes[1].filters[0].value, "authenticated");
  assert.notEqual(adminClient.state.deletes[1].filters[1].value, "guest:verified-user");
  assert.deepEqual(adminClient.state.productEvents, [
    { principal_type: "guest", principal_hash: matchingHash }
  ]);
  assert.equal(adminClient.state.deletes[2].filters[0].value, verifiedUserId);
  assert.equal(adminClient.state.deletes[3].filters[0].value, verifiedUserId);
  assert.equal(adminClient.state.deletes[4].filters[0].value, verifiedUserId);
  assert.deepEqual(adminClient.state.authDeletes, [verifiedUserId]);
});

test("missing service role client returns a safe unavailable error", async () => {
  const { service } = createService({ adminClient: null });

  await assert.rejects(
    () => service.deleteAccount(createRequest({ body: { confirmation: "注销账户" } })),
    (error) => error.code === "ANALYTICS_UNAVAILABLE" && error.status === 503
  );
});

test("missing analytics secret skips usage event deletion but still deletes account data", async () => {
  const adminClient = createFakeAdminClient();
  const service = createAccountDeletionService({
    aiAuthResolver: {
      resolveIdentity: async () => ({ type: "authenticated", userId: verifiedUserId })
    },
    env: {},
    getAdminClient: () => adminClient,
    requestIdFactory: () => "request-1"
  });

  const result = await service.deleteAccount(createRequest({ body: { confirmation: "注销账户" } }));

  assert.equal(result.ok, true);
  assert.deepEqual(adminClient.state.deletes.map((item) => item.tableName), [
    "product_analytics_preferences",
    "legal_consents",
    "dream_records"
  ]);
  assert.deepEqual(adminClient.state.events, [
    `auth:${verifiedUserId}`,
    "delete:product_analytics_preferences",
    "delete:legal_consents",
    "delete:dream_records"
  ]);
  assert.deepEqual(adminClient.state.authDeletes, [verifiedUserId]);
});

test("missing auth admin support fails before deleting account data", async () => {
  const adminClient = createFakeAdminClient({ omitAuthAdmin: true });
  const { service } = createService({ adminClient });

  await assert.rejects(
    () => service.deleteAccount(createRequest({ body: { confirmation: "注销账户" } })),
    (error) => error.code === "ACCOUNT_DELETION_FAILED"
      && error.requestId === "request-1"
  );

  assert.deepEqual(adminClient.state.deletes, []);
  assert.deepEqual(adminClient.state.authDeletes, []);
});

test("auth deletion failure preserves dream and legal records for retry", async () => {
  const adminClient = createFakeAdminClient({ failAuthDelete: true });
  const { service } = createService({ adminClient });

  await assert.rejects(
    () => service.deleteAccount(createRequest({ body: { confirmation: "注销账户" } })),
    (error) => error.code === "ACCOUNT_DELETION_FAILED"
      && error.requestId === "request-1"
      && !String(error.message).includes("verified-user")
  );

  assert.deepEqual(adminClient.state.deletes.map((item) => item.tableName), ["ai_usage_events", "product_events"]);
  assert.deepEqual(adminClient.state.authDeletes, [verifiedUserId]);
  assert.deepEqual(adminClient.state.events, [
    "delete:ai_usage_events",
    "delete:product_events",
    `auth:${verifiedUserId}`
  ]);
});

test("post-auth cleanup failure returns a safe request id without false success", async () => {
  const adminClient = createFakeAdminClient({ failTable: "dream_records" });
  const { service } = createService({ adminClient });

  await assert.rejects(
    () => service.deleteAccount(createRequest({ body: { confirmation: "注销账户" } })),
    (error) => error.code === "ACCOUNT_DELETION_FAILED"
      && error.requestId === "request-1"
      && !String(error.message).includes("verified-user")
  );

  assert.deepEqual(adminClient.state.authDeletes, [verifiedUserId]);
});
