import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isSupabaseConfigured, getSupabaseClient } from '../supabaseClient';

describe('supabaseClient', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false and null client when environment variables are not set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });

  it('returns false when URL does not start with http', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'invalid-url');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123');
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });

  it('returns false when anon key is missing', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });

  it('returns true and creates client instance when environment variables are valid', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123');
    expect(isSupabaseConfigured()).toBe(true);
    const client = getSupabaseClient();
    expect(client).not.toBeNull();
    // Subsequent calls return memoized instance
    expect(getSupabaseClient()).toBe(client);
  });
});
