import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { OFFLINE_PREVIEW } from '@/lib/offline-preview';

const SUPABASE_URL = "https://eujbgwltfdiwqatnvmik.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lZTXXBshapEigaBKiaXXCw_owu1-XSN";

// Do not construct a hosted client offline: construction can refresh stored sessions.
// Fail closed if any future screen accidentally attempts to use the hosted API.
export const supabase: SupabaseClient = OFFLINE_PREVIEW
  ? new Proxy({} as SupabaseClient, {
      get() { throw new Error("Supabase is unavailable in offline preview. No hosted request was made."); },
    })
  : createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    });
