// Supabase client for accounts. The project address and publishable key below
// are public by design (they ship inside every copy of the app); access is
// controlled by Supabase Auth and row level security, never by hiding them.
// EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY override them, and
// EXPO_PUBLIC_ACCOUNTS=preview turns accounts off (preview mode keeps the
// account on this device only, see store/Auth.tsx).
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://tdfslnfurzqryyecxfik.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gFAiXSNtBtiwkLSJo4-Spw_KyotSBwo';

const previewOnly = process.env.EXPO_PUBLIC_ACCOUNTS === 'preview';
const url = previewOnly ? undefined : process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_URL;
const anonKey = previewOnly ? undefined : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // On web the confirmation / password reset links come back to the page with the session in the URL.
          detectSessionInUrl: Platform.OS === 'web',
        },
      })
    : null;
