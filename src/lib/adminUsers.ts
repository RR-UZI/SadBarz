// Admins: list accounts and give or take away Pro (Home → Usuarios).
// On Supabase it goes through admin-only SQL functions (supabase/migrations/20261103010000_admin_users.sql).
// In the preview build the accounts live on this device, so it changes those.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import type { Plan } from './plan';

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  plan: Plan;
  admin: boolean;
  coach: boolean;
  createdAt?: string;
  lastSignInAt?: string;
}

const PREVIEW_ACCOUNTS = 'sadbarz:preview-accounts';
type PreviewAccounts = Record<string, { id: string; name: string; plan?: Plan }>;

async function previewAccounts(): Promise<PreviewAccounts> {
  return JSON.parse((await AsyncStorage.getItem(PREVIEW_ACCOUNTS)) ?? '{}') as PreviewAccounts;
}

export async function listUsers(search: string): Promise<AdminUser[]> {
  const q = search.trim();
  if (supabase) {
    const { data, error } = await supabase.rpc('admin_list_users', { search: q, max_rows: 100 });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      email: (r.email as string | null) ?? '',
      name: (r.name as string | null) ?? undefined,
      plan: r.plan === 'pro' ? 'pro' : 'free',
      admin: r.admin === true,
      coach: r.coach === true,
      createdAt: (r.created_at as string | null) ?? undefined,
      lastSignInAt: (r.last_sign_in_at as string | null) ?? undefined,
    }));
  }
  const accounts = await previewAccounts();
  const low = q.toLowerCase();
  return Object.entries(accounts)
    .filter(([email, a]) => !low || email.includes(low) || a.name.toLowerCase().includes(low))
    .map(([email, a]) => ({ id: a.id, email, name: a.name, plan: a.plan === 'pro' ? 'pro' : 'free', admin: true, coach: false }));
}

export async function setUserPlan(id: string, plan: Plan): Promise<void> {
  if (supabase) {
    const { error } = await supabase.rpc('admin_set_plan', { target: id, new_plan: plan });
    if (error) throw error;
    return;
  }
  const accounts = await previewAccounts();
  const email = Object.keys(accounts).find((e) => accounts[e].id === id);
  if (!email) throw new Error('no such account');
  accounts[email] = { ...accounts[email], plan };
  await AsyncStorage.setItem(PREVIEW_ACCOUNTS, JSON.stringify(accounts));
}
