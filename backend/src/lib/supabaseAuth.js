import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const AUTH_REQUEST_TIMEOUT_MS = 30000;
const AUTH_RETRYABLE_ERROR_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

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

function isRetryableAuthError(error) {
  const code = error?.cause?.code || error?.code || "";
  return AUTH_RETRYABLE_ERROR_CODES.has(code) || error?.message === "fetch failed";
}

async function authFetch(input, init) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      const abortedByTimeout = error?.name === "AbortError";
      if (attempt === 1 || (!abortedByTimeout && !isRetryableAuthError(error))) {
        throw error;
      }
    }
  }

  throw lastError;
}

const hasSupabaseAuthConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const supabaseAuth = hasSupabaseAuthConfig
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: authFetch,
      },
    })
  : createMissingConfigClient();
