import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

function createMissingConfigClient() {
  const throwConfigError = () => {
    throw new Error(
      "Supabase Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env."
    );
  };

  return {
    auth: {
      async signInWithPassword() {
        throwConfigError();
      },
      async signUp() {
        throwConfigError();
      },
      async resetPasswordForEmail() {
        throwConfigError();
      },
    },
  };
}

const hasSupabaseAuthConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const supabaseAuth = hasSupabaseAuthConfig
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createMissingConfigClient();
