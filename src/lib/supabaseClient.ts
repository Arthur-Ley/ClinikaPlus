import { createClient } from '@supabase/supabase-js';
import { clearAuthSession } from '../services/authApi';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
        },
      })
    : null;

export function installSupabaseSessionListener(): void {
  if (!supabase) return;

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      clearAuthSession();
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const encodedCurrentPath = encodeURIComponent(currentPath);
        window.location.replace(`/login?redirect=${encodedCurrentPath}`);
      }
    }
  });
}

