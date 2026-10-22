// Supabase client for accounts. Set EXPO_PUBLIC_SUPABASE_URL and
// EXPO_PUBLIC_SUPABASE_ANON_KEY (in .env locally, or in Vercel's Environment
// Variables) to turn it on. Without them the app runs in preview mode and keeps
// the account on this device only (see store/Auth.tsx).
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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
