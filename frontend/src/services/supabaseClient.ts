import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getSupabaseUrl = (): string | undefined => import.meta.env?.VITE_SUPABASE_URL;
const getSupabaseAnonKey = (): string | undefined => import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(url && key && typeof url === 'string' && url.startsWith('http'));
};

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!clientInstance && url && key) {
    clientInstance = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return clientInstance;
}
