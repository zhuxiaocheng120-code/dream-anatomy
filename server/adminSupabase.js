const { createClient: defaultCreateClient } = require("@supabase/supabase-js");

function isAnalyticsConfigured(env = process.env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function createAdminSupabaseClient({ createClient = defaultCreateClient, env = process.env } = {}) {
  if (!isAnalyticsConfigured(env)) {
    return null;
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

module.exports = {
  createAdminSupabaseClient,
  isAnalyticsConfigured
};
