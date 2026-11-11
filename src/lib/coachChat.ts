// The Coach tab's chat with the AI coach (Pro). Answers come from the Edge Function `coach-chat`,
// which saves both messages in the table coach_messages; the app reads the chat from there and keeps
// a copy on the device so it shows at once. In the preview build the coach isn't connected: it answers
// with a fixed note, kept on the device.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Exercise, Language } from '../types';
import { plansChanged } from './coach';
import { isoDay } from './records';
import { supabase } from './supabase';

/** A change to the athlete's plan the coach proposed; planId once the athlete sent it (for Uzi's review). */
export type Proposal = { summary: string; change: string; planId?: string; sentAt?: string };
export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; at: number; proposal?: Proposal };
export type ChatError = 'limit' | 'pro' | 'long' | 'notReady' | 'offline' | 'failed';
export type SendResult = { ok: true; reply: ChatMessage; left: number | null } | { ok: false; error: ChatError; detail: string };

export const MAX_MESSAGE = 1000; // the same limit as the function
const KEEP = 100; // messages shown (and kept on the device)
const cacheKey = (userId: string) => `sadbarz:coach-chat:${userId}`;

export async function cachedChat(userId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function keep(userId: string, list: ChatMessage[]) {
  const last = list.slice(-KEEP);
  AsyncStorage.setItem(cacheKey(userId), JSON.stringify(last)).catch(() => {});
  return last;
}

/** The chat from the server (null when it can't be read: offline, or the table isn't there yet). */
export async function loadChat(userId: string): Promise<ChatMessage[] | null> {
  if (!supabase) return cachedChat(userId);
  const { data, error } = await supabase
    .from('coach_messages')
    .select('id, role, content, proposal, created_at')
    .eq('user_id', userId) // admins can read every chat: only this athlete's
    .order('created_at', { ascending: false })
    .limit(KEEP);
  if (error || !data) return null;
  const list = (data as { id: number; role: 'user' | 'assistant'; content: string; proposal: Proposal | null; created_at: string }[])
    .reverse()
    .map((m) => ({ id: String(m.id), role: m.role, content: m.content, at: new Date(m.created_at).getTime(), ...(m.proposal ? { proposal: m.proposal } : {}) }));
  return keep(userId, list);
}

export async function sendToCoach(userId: string, before: ChatMessage[], text: string, language: Language): Promise<SendResult> {
  const mine: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content: text, at: Date.now() };
  if (!supabase) {
    await new Promise((r) => setTimeout(r, 700));
    const reply: ChatMessage = {
      id: `local-${Date.now()}-c`,
      role: 'assistant',
      content:
        language === 'en'
          ? 'Preview: in the real app the SadBarz coach answers here, knowing your profile, your workouts and your plan.'
          : 'Vista previa: en la app real aquí te contesta el coach de SadBarz, con tu perfil, tus entrenos y tu plan.',
      at: Date.now() + 1,
    };
    keep(userId, [...before, mine, reply]);
    return { ok: true, reply, left: null };
  }
  try {
    const { data, error } = await supabase.functions.invoke('coach-chat', { body: { message: text, language } });
    if (!error && data && typeof (data as { reply?: unknown }).reply === 'string') {
      const d = data as { reply: string; left: number | null; id?: number | null; proposal?: Proposal | null };
      const reply: ChatMessage = {
        id: d.id ? String(d.id) : `local-${Date.now()}-c`,
        role: 'assistant',
        content: d.reply,
        at: Date.now() + 1,
        ...(d.proposal ? { proposal: d.proposal } : {}),
      };
      keep(userId, [...before, mine, reply]);
      return { ok: true, reply, left: d.left ?? null };
    }
    // The function answers { error: 'limit' | 'pro' | 'long' | ..., detail? } with the status code.
    const res = (error as { context?: Response } | null)?.context;
    let answer: { error?: string; detail?: string; message?: string } = {};
    if (res && typeof res.text === 'function') {
      const raw = await res.text().catch(() => '');
      try {
        answer = JSON.parse(raw);
      } catch {
        answer = { message: raw.slice(0, 200) };
      }
    }
    const code = answer.error;
    const detail = [res?.status, code, answer.detail ?? answer.message ?? (res ? undefined : error?.message)].filter(Boolean).join(' · ');
    if (code === 'limit' || code === 'pro' || code === 'long') return { ok: false, error: code, detail };
    if (res?.status === 404) return { ok: false, error: 'notReady', detail }; // the function isn't deployed yet
    if (!res) return { ok: false, error: 'offline', detail };
    return { ok: false, error: 'failed', detail };
  } catch (e) {
    return { ok: false, error: 'offline', detail: String(e instanceof Error ? e.message : e) };
  }
}

export type ProposalError = 'busy' | 'limit' | 'noplan' | 'offline' | 'failed';

/** The athlete sends the coach's proposal: coach-plan writes the changed plan, which waits for Uzi's review. */
export async function sendProposal(
  userId: string,
  messages: ChatMessage[],
  message: ChatMessage,
  exercises: Exercise[],
  language: Language,
): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; error: ProposalError; detail: string }> {
  if (!message.proposal) return { ok: false, error: 'failed', detail: 'no proposal' };
  const sent = (planId: string) => {
    const next = messages.map((m) => (m.id === message.id && m.proposal ? { ...m, proposal: { ...m.proposal, planId, sentAt: new Date().toISOString() } } : m));
    keep(userId, next);
    plansChanged();
    return { ok: true as const, messages: next };
  };
  if (!supabase) return sent('preview');
  try {
    const { data, error } = await supabase.functions.invoke('coach-plan', {
      body: {
        change: message.proposal.change,
        messageId: /^\d+$/.test(message.id) ? Number(message.id) : undefined,
        today: isoDay(Date.now()),
        language,
        exercises: exercises.map(({ id, name, kind, category }) => ({ id, name, kind, category })),
      },
    });
    if (!error && data && typeof (data as { id?: unknown }).id === 'string') return sent((data as { id: string }).id);
    const res = (error as { context?: Response } | null)?.context;
    let answer: { error?: string; detail?: string; message?: string } = {};
    if (res && typeof res.text === 'function') {
      const raw = await res.text().catch(() => '');
      try {
        answer = JSON.parse(raw);
      } catch {
        answer = { message: raw.slice(0, 200) };
      }
    }
    const code = answer.error;
    const detail = [res?.status, code, answer.detail ?? answer.message ?? (res ? undefined : error?.message)].filter(Boolean).join(' · ');
    if (code === 'busy' || code === 'limit' || code === 'noplan') return { ok: false, error: code, detail };
    return { ok: false, error: res ? 'failed' : 'offline', detail };
  } catch (e) {
    return { ok: false, error: 'offline', detail: String(e instanceof Error ? e.message : e) };
  }
}

export async function clearChat(userId: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase.from('coach_messages').delete().eq('user_id', userId);
    if (error) return false;
  }
  await AsyncStorage.removeItem(cacheKey(userId)).catch(() => {});
  return true;
}
