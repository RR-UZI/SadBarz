// Who is signed in. Uses Supabase when it is configured; otherwise a preview
// mode keeps the account on this device so the screens can be tried end to end.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';

export interface Account {
  id: string;
  email: string;
  name: string;
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
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** value is true when the account still needs its email confirmed. */
  signUp: (name: string, email: string, password: string) => Promise<AuthResult<boolean>>;
  resetPassword: (email: string) => Promise<AuthResult>;
  setNewPassword: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const PREVIEW_ACCOUNTS = 'sadbarz:preview-accounts';
const PREVIEW_SESSION = 'sadbarz:preview-session';

type PreviewAccounts = Record<string, { id: string; name: string; hash: string }>;

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

function fromSupabaseUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): Account {
  const email = u.email ?? '';
  const name = typeof u.user_metadata?.name === 'string' && u.user_metadata.name ? u.user_metadata.name : email.split('@')[0];
  return { id: u.id, email, name };
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Account | null>(null);
  const [recovering, setRecovering] = useState(false);
  const mode = supabase ? 'online' : 'preview';

  useEffect(() => {
    if (supabase) {
      const client = supabase;
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
        if (email && accounts[email]) setUser({ id: accounts[email].id, email, name: accounts[email].name });
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
    setUser({ id: acc.id, email, name: acc.name });
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
    setUser({ id, email, name });
    return { ok: true, value: false };
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
    () => ({ ready, user, mode, recovering, signIn, signUp, resetPassword, setNewPassword, signOut }),
    [ready, user, mode, recovering, signIn, signUp, resetPassword, setNewPassword, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
