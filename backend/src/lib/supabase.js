import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

function createMissingConfigClient() {
  const throwConfigError = () => {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env."
    );
  };

  return {
    from() {
      throwConfigError();
    },
    storage: {
      async listBuckets() {
        throwConfigError();
      },
      from() {
        return {
          async createSignedUploadUrl() {
            throwConfigError();
          },
        };
      },
    },
  };
}

const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);

export const supabase = hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createMissingConfigClient();
