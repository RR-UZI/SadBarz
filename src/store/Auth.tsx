// Who is signed in. Uses Supabase when it is configured; otherwise a preview
// mode keeps the account on this device so the screens can be tried end to end.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import type { Plan } from '../lib/plan';
import { asProfile } from '../lib/profile';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

export interface Account {
  id: string;
  email: string;
  name: string;
  /** Onboarding answers; null until onboarding is finished. */
  profile: Profile | null;
  /** The plan the app shows. For an admin it can be switched by hand to try the other one. */
  plan: Plan;
  /** Uzi's account: `admin: true` in app_metadata, which only the server can set. Sees the Free/Pro switch. */
  admin: boolean;
}

// Each maps to an 'auth.error.*' string.
export type AuthError =
  | 'invalidEmail'
  | 'weakPassword'
  | 'nameMissing'
  | 'wrongLogin'
  | 'emailTaken'
  | 'notConfirmed'
  | 'network'
  | 'linkFailed'
  | 'unknown';

export type AuthResult<T = void> = { ok: true; value: T } | { ok: false; error: AuthError };

export const MIN_PASSWORD = 8;

interface AuthValue {
  ready: boolean;
  user: Account | null;
  /** 'preview' = no accounts server yet, the account lives on this device. */
  mode: 'online' | 'preview';
  /** The user opened a password reset link and must choose a new password. */
  recovering: boolean;
  /** A sign in link (Google, email confirmation) came back with an error. */
  linkError: AuthError | null;
  clearLinkError: () => void;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** value is true when the account still needs its email confirmed. */
  signUp: (name: string, email: string, password: string) => Promise<AuthResult<boolean>>;
  /** Google sign in is available (web, with Supabase configured). */
  canUseGoogle: boolean;
  /** Leaves the page for Google and comes back signed in. */
  signInWithGoogle: () => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  setNewPassword: (password: string) => Promise<AuthResult>;
  /** Saves the onboarding answers to the account. */
  saveProfile: (profile: Profile) => Promise<AuthResult>;
  /** Notes on the account that the user asked for Pro (before payments exist), so they can be told when it opens. */
  markProInterest: () => Promise<AuthResult>;
  /** Admin only: show the app as Free or Pro on this device. Doesn't change the real plan. */
  setPlanView: (plan: Plan) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const PREVIEW_ACCOUNTS = 'sadbarz:preview-accounts';
const PREVIEW_SESSION = 'sadbarz:preview-session';
const PLAN_VIEW = 'sadbarz:plan-view';

type PreviewAccounts = Record<string, { id: string; name: string; hash: string; profile?: Profile; plan?: Plan }>;

export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function cleanEmail(email: string) {
  return email.trim().toLowerCase();
}

// Preview mode only: never keep the typed password itself on the device.
function hashPassword(email: string, password: string) {
  let h = 5381;
  for (const ch of `${email}:${password}:sadbarz`) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

function redirectUrl() {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined;
}

function fromSupabaseUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }): Account {
  const email = u.email ?? '';
  const meta = u.user_metadata ?? {};
  // Email sign up stores `name`; Google fills `full_name` and `name`.
  const fromMeta = [meta.name, meta.full_name].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  const name = fromMeta ?? email.split('@')[0];
  return {
    id: u.id,
    email,
    name,
    profile: asProfile(meta.profile),
    plan: u.app_metadata?.plan === 'pro' ? 'pro' : 'free',
    admin: u.app_metadata?.admin === true,
  };
}

function mapError(e: { code?: string; message?: string; status?: number } | null | undefined): AuthError {
  if (!e) return 'unknown';
  const code = e.code ?? '';
  const msg = (e.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'wrongLogin';
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'notConfirmed';
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered')) return 'emailTaken';
  if (code === 'weak_password' || msg.includes('password')) return 'weakPassword';
  if (code === 'email_address_invalid' || msg.includes('email')) return 'invalidEmail';
  if (msg.includes('fetch') || msg.includes('network')) return 'network';
  return 'unknown';
}

// The preview keeps accounts only on this device, for trying the app, so every preview account gets the switch.
function previewUser(email: string, acc: PreviewAccounts[string]): Account {
  return { id: acc.id, email, name: acc.name, profile: asProfile(acc.profile), plan: acc.plan === 'pro' ? 'pro' : 'free', admin: true };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Account | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [linkError, setLinkError] = useState<AuthError | null>(null);
  const [planView, setPlanViewState] = useState<Plan | null>(null);
  const mode = supabase ? 'online' : 'preview';

  useEffect(() => {
    AsyncStorage.getItem(PLAN_VIEW)
      .then((v) => setPlanViewState(v === 'pro' || v === 'free' ? v : null))
      .catch(() => {});
  }, []);

  const setPlanView = useCallback((plan: Plan) => {
    setPlanViewState(plan);
    AsyncStorage.setItem(PLAN_VIEW, plan).catch(() => {});
  }, []);

  // What the screens see: an admin's switch overrides the plan; nobody else is affected.
  const shown = useMemo(() => (user?.admin && planView ? { ...user, plan: planView } : user), [user, planView]);

  useEffect(() => {
    if (supabase) {
      const client = supabase;
      // Google or an email link can come back with ?error=...&error_description=... (query or hash).
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const { search, hash, pathname } = window.location;
        const params = new URLSearchParams(`${search.slice(1)}&${hash.slice(1)}`);
        if (params.get('error') || params.get('error_description')) {
          setLinkError('linkFailed');
          window.history.replaceState(null, '', pathname);
        }
      }
      client.auth
        .getSession()
        .then(({ data }) => setUser(data.session ? fromSupabaseUser(data.session.user) : null))
        .catch(() => setUser(null))
        .finally(() => setReady(true));
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') setRecovering(true);
        setUser(session ? fromSupabaseUser(session.user) : null);
      });
      return () => data.subscription.unsubscribe();
    }
    (async () => {
      try {
        const email = await AsyncStorage.getItem(PREVIEW_SESSION);
        const accounts: PreviewAccounts = JSON.parse((await AsyncStorage.getItem(PREVIEW_ACCOUNTS)) ?? '{}');
        if (email && accounts[email]) setUser(previewUser(email, accounts[email]));
      } catch {
        // storage blocked: start signed out
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (rawEmail: string, password: string): Promise<AuthResult> => {
    const email = cleanEmail(rawEmail);
    if (!validEmail(email)) return { ok: false, error: 'invalidEmail' };
    if (!password) return { ok: false, error: 'wrongLogin' };
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, error: mapError(error) };
        setUser(fromSupabaseUser(data.user));
        return { ok: true, value: undefined };
      } catch {
        return { ok: false, error: 'network' };
      }
    }
    const accounts: PreviewAccounts = JSON.parse((await AsyncStorage.getItem(PREVIEW_ACCOUNTS)) ?? '{}');
    const acc = accounts[email];
    if (!acc || acc.hash !== hashPassword(email, password)) return { ok: false, error: 'wrongLogin' };
    await AsyncStorage.setItem(PREVIEW_SESSION, email);
    setUser(previewUser(email, acc));
    return { ok: true, value: undefined };
  }, []);

  const signUp = useCallback(async (rawName: string, rawEmail: string, password: string): Promise<AuthResult<boolean>> => {
    const name = rawName.trim();
    const email = cleanEmail(rawEmail);
    if (!name) return { ok: false, error: 'nameMissing' };
    if (!validEmail(email)) return { ok: false, error: 'invalidEmail' };
    if (password.length < MIN_PASSWORD) return { ok: false, error: 'weakPassword' };
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: redirectUrl() },
        });
        if (error) return { ok: false, error: mapError(error) };
        // With email confirmation on, an existing address comes back with no identities.
        if (data.user && data.user.identities?.length === 0) return { ok: false, error: 'emailTaken' };
        if (data.session) {
          setUser(fromSupabaseUser(data.session.user));
          return { ok: true, value: false };
        }
        return { ok: true, value: true };
      } catch {
        return { ok: false, error: 'network' };
      }
    }
    const accounts: PreviewAccounts = JSON.parse((await AsyncStorage.getItem(PREVIEW_ACCOUNTS)) ?? '{}');
    if (accounts[email]) return { ok: false, error: 'emailTaken' };
    const id = `local_${Date.now().toString(36)}`;
    accounts[email] = { id, name, hash: hashPassword(email, password) };
    await AsyncStorage.setItem(PREVIEW_ACCOUNTS, JSON.stringify(accounts));
    await AsyncStorage.setItem(PREVIEW_SESSION, email);
    setUser({ id, email, name, profile: null, plan: 'free', admin: true });
    return { ok: true, value: false };
  }, []);

  const canUseGoogle = !!supabase && Platform.OS === 'web';

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!supabase || Platform.OS !== 'web') return { ok: false, error: 'unknown' };
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
      if (error) return { ok: false, error: mapError(error) };
      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: 'network' };
    }
  }, []);

  const resetPassword = useCallback(async (rawEmail: string): Promise<AuthResult> => {
    const email = cleanEmail(rawEmail);
    if (!validEmail(email)) return { ok: false, error: 'invalidEmail' };
    if (supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
        if (error) return { ok: false, error: mapError(error) };
      } catch {
        return { ok: false, error: 'network' };
      }
    }
    // Same answer whether or not the address has an account, so nobody can probe for accounts.
    return { ok: true, value: undefined };
  }, []);

  const setNewPassword = useCallback(async (password: string): Promise<AuthResult> => {
    if (password.length < MIN_PASSWORD) return { ok: false, error: 'weakPassword' };
    if (!supabase) return { ok: false, error: 'unknown' };
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { ok: false, error: mapError(error) };
      setRecovering(false);
      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: 'network' };
    }
  }, []);

  const saveProfile = useCallback(
    async (profile: Profile): Promise<AuthResult> => {
      if (!user) return { ok: false, error: 'unknown' };
      if (supabase) {
        try {
          // Kept in the account's metadata, so it follows the user to every device and the coach can read it.
          const { data, error } = await supabase.auth.updateUser({ data: { profile } });
          if (error) return { ok: false, error: mapError(error) };
          setUser(fromSupabaseUser(data.user));
          return { ok: true, value: undefined };
        } catch {
          return { ok: false, error: 'network' };
        }
      }
      try {
        const accounts: PreviewAccounts = JSON.parse((await AsyncStorage.getItem(PREVIEW_ACCOUNTS)) ?? '{}');
        if (accounts[user.email]) {
          accounts[user.email].profile = profile;
          await AsyncStorage.setItem(PREVIEW_ACCOUNTS, JSON.stringify(accounts));
        }
      } catch {
        // storage blocked: keep it for this visit only
      }
      setUser({ ...user, profile });
      return { ok: true, value: undefined };
    },
    [user],
  );

  const markProInterest = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { ok: true, value: undefined };
    try {
      const { data, error } = await supabase.auth.updateUser({ data: { pro_interest_at: new Date().toISOString() } });
      if (error) return { ok: false, error: mapError(error) };
      setUser(fromSupabaseUser(data.user));
      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: 'network' };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    } else {
      await AsyncStorage.removeItem(PREVIEW_SESSION).catch(() => {});
    }
    setRecovering(false);
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ ready, user: shown, mode, recovering, linkError, clearLinkError: () => setLinkError(null), signIn, signUp, canUseGoogle, signInWithGoogle, resetPassword, setNewPassword, saveProfile, markProInterest, setPlanView, signOut }),
    [ready, shown, mode, recovering, linkError, signIn, signUp, canUseGoogle, signInWithGoogle, resetPassword, setNewPassword, saveProfile, markProInterest, setPlanView, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
