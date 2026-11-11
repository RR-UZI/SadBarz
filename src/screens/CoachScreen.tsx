// Coach tab: the athlete's chat with the AI coach (Pro). Free accounts see what it is and how to get it.
// The coach only talks about training, exercise and the mental side of sport (see supabase/functions/coach-chat).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Card, Row, Screen, Txt, styles as ui } from '../components/ui';
import { useT } from '../i18n';
import {
  type ChatError,
  type ChatMessage,
  type CoachNotes,
  cachedChat,
  checkIn,
  clearChat,
  clearNotes,
  loadChat,
  loadNotes,
  MAX_MESSAGE,
  type ProposalError,
  sendProposal,
  sendToCoach,
} from '../lib/coachChat';
import { confirm } from '../lib/confirm';
import { showPro } from '../lib/plan';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, radius, space } from '../theme';

const SUGGESTIONS = ['coachChat.try1', 'coachChat.try2', 'coachChat.try3', 'coachChat.try4'] as const;

export function CoachScreen() {
  const { user } = useAuth();
  const pro = !!user && (user.plan === 'pro' || user.admin);
  if (!user) return null;
  if (!pro) return <CoachPromo />;
  return <CoachChat userId={user.id} name={user.name} />;
}

function CoachChat({ userId, name }: { userId: string; name: string }) {
  const t = useT();
  const { settings, exercises } = useApp();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  // A proposal being sent, and why the last one couldn't be (by message id).
  const [proposing, setProposing] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<{ id: string; error: ProposalError } | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<ChatError | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  // The coach catching up with workouts it hasn't seen (shown as "looking at your training" after a moment).
  const [catchingUp, setCatchingUp] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const nav = useNav();

  useEffect(() => {
    let live = true;
    cachedChat(userId).then((c) => live && setMessages((m) => m ?? c));
    (async () => {
      const loaded = await loadChat(userId);
      if (!live) return;
      if (loaded) setMessages(loaded);
      const slow = setTimeout(() => live && setCatchingUp(true), 700);
      const note = await checkIn(userId, loaded ?? (await cachedChat(userId)), settings.language);
      clearTimeout(slow);
      if (!live) return;
      setCatchingUp(false);
      if (note) setMessages((m) => (m?.some((x) => x.id === note.id) ? m : [...(m ?? []), note]));
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  const toEnd = useCallback(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, []);
  useEffect(toEnd, [messages?.length, sending, catchingUp, toEnd]);

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, MAX_MESSAGE);
    if (!text || sending) return;
    const before = messages ?? [];
    const mine: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content: text, at: Date.now() };
    setMessages([...before, mine]);
    setDraft('');
    setProblem(null);
    setSending(true);
    const res = await sendToCoach(userId, before, text, settings.language);
    setSending(false);
    if (res.ok) {
      setMessages((m) => [...(m ?? []), res.reply]);
      setLeft(res.left);
    } else {
      // Not answered: take the message back into the box so it can be sent again.
      setMessages(before);
      setDraft(text);
      setProblem(res.error);
    }
  };

  const propose = async (m: ChatMessage) => {
    if (proposing || !messages) return;
    setProposing(m.id);
    setProposalError(null);
    const res = await sendProposal(userId, messages, m, exercises, settings.language);
    setProposing(null);
    if (res.ok) setMessages(res.messages);
    else setProposalError({ id: m.id, error: res.error });
  };

  const clear = () =>
    confirm(
      t('coachChat.clearAsk'),
      () => {
        clearChat(userId).then((ok) => ok && setMessages([]));
      },
      t('coachChat.clear'),
      t('common.cancel'),
    );

  const list = messages ?? [];
  return (
    <Screen
      title={t('tab.coach')}
      mark
      scroll={false}
      right={list.length ? <Button label={t('coachChat.clearShort')} variant="ghost" size="sm" onPress={clear} /> : undefined}
      footer={
        <View style={{ gap: space.sm }}>
          {problem ? (
            <Txt variant="small" color={problem === 'limit' ? colors.warn : colors.danger}>
              {t(`coachChat.error.${problem}`)}
            </Txt>
          ) : left !== null && left <= 5 ? (
            <Txt variant="small" color={colors.muted}>
              {t('coachChat.left', { n: left })}
            </Txt>
          ) : null}
          <Row style={{ alignItems: 'flex-end' }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('coachChat.placeholder')}
              placeholderTextColor={colors.faint}
              multiline
              maxLength={MAX_MESSAGE}
              style={[ui.input, { flex: 1, minHeight: 44, maxHeight: 120 }]}
            />
            <Button label={t('coachChat.send')} disabled={!draft.trim() || sending} onPress={() => send(draft)} />
          </Row>
        </View>
      }
    >
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.sm }} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => nav.push({ name: 'coachNotes' })}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md, marginBottom: space.xs }}
        >
          <Txt variant="small" color={colors.muted} style={{ flex: 1 }}>
            {t('coachNotes.link')}
          </Txt>
          <Txt variant="small" color={colors.accent} style={{ fontWeight: '700' }}>
            {t('coachNotes.open')}
          </Txt>
        </Pressable>
        <Bubble role="assistant" text={t('coachChat.hello', { name: name.split(' ')[0] })} />
        {messages === null ? <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} /> : null}
        {list.map((m) => (
          <View key={m.id} style={{ gap: space.sm }}>
            <Bubble role={m.role} text={m.content} />
            {m.role === 'assistant' && m.proposal ? (
              <ProposalCard
                message={m}
                sending={proposing === m.id}
                error={proposalError?.id === m.id ? proposalError.error : null}
                onSend={() => propose(m)}
              />
            ) : null}
          </View>
        ))}
        {sending || catchingUp ? (
          <Txt variant="small" color={colors.muted} style={{ marginLeft: space.xs }}>
            {t(sending ? 'coachChat.typing' : 'coachChat.catchingUp')}
          </Txt>
        ) : null}
        {messages !== null && !list.length && !sending && !catchingUp ? (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <Txt variant="label">{t('coachChat.tryTitle')}</Txt>
            {SUGGESTIONS.map((k) => (
              <Pressable
                key={k}
                onPress={() => send(t(k))}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md }}
              >
                <Txt color={colors.text}>{t(k)}</Txt>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const me = role === 'user';
  return (
    <View
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        backgroundColor: me ? colors.accent : colors.surface2,
        borderRadius: radius.lg,
        borderBottomRightRadius: me ? radius.sm : radius.lg,
        borderBottomLeftRadius: me ? radius.lg : radius.sm,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
      }}
    >
      <Txt color={me ? colors.accentText : colors.text}>{text}</Txt>
    </View>
  );
}

// A change to the plan the coach proposed: the athlete sends it, the coach rewrites the plan and Uzi reviews it.
function ProposalCard({ message, sending, error, onSend }: { message: ChatMessage; sending: boolean; error: ProposalError | null; onSend: () => void }) {
  const t = useT();
  const nav = useNav();
  const p = message.proposal!;
  return (
    <Card style={{ alignSelf: 'flex-start', maxWidth: '85%', borderColor: colors.accent, gap: space.sm }}>
      <Txt variant="label" color={colors.accent}>
        {t('coachChat.proposalTitle')}
      </Txt>
      <Txt style={{ fontWeight: '700' }}>{p.summary}</Txt>
      {p.planId ? (
        <>
          <Txt variant="small" color={colors.success}>
            ✓ {t('coachChat.proposalSent')}
          </Txt>
          <Pressable onPress={() => nav.push({ name: 'myPlan' })} hitSlop={6} accessibilityRole="button">
            <Txt variant="small" color={colors.accent} style={{ fontWeight: '700' }}>
              {t('coachChat.proposalMyPlan')}
            </Txt>
          </Pressable>
        </>
      ) : (
        <>
          <Txt variant="small" color={colors.muted}>
            {t('coachChat.proposalHint')}
          </Txt>
          {error ? (
            <Txt variant="small" color={error === 'busy' ? colors.warn : colors.danger}>
              {t(`coachChat.proposalError.${error}`)}
            </Txt>
          ) : null}
          <Button label={sending ? t('coachChat.proposalSending') : t('coachChat.proposalSend')} size="sm" disabled={sending} onPress={onSend} />
        </>
      )}
    </Card>
  );
}

// What the coach has learned about the athlete: read-only, and the athlete can delete it.
export function CoachNotesScreen() {
  const t = useT();
  const nav = useNav();
  const { user } = useAuth();
  const { settings } = useApp();
  const [notes, setNotes] = useState<CoachNotes | null | undefined>(undefined);
  const [problem, setProblem] = useState(false);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    loadNotes(userId)
      .then((n) => live && setNotes(n))
      .catch(() => live && setNotes(null));
    return () => {
      live = false;
    };
  }, [userId]);
  const remove = () =>
    confirm(
      t('coachNotes.clearAsk'),
      () => {
        if (!userId) return;
        clearNotes(userId).then((ok) => (ok ? setNotes(null) : setProblem(true)));
      },
      t('coachNotes.clear'),
      t('common.cancel'),
    );
  const when = notes ? new Date(notes.updatedAt).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'long' }) : '';
  return (
    <Screen title={t('coachNotes.title')} onBack={nav.pop}>
      <Txt color={colors.muted}>{t('coachNotes.intro')}</Txt>
      {notes === undefined ? <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} /> : null}
      {notes === null ? (
        <Card style={{ marginTop: space.md }}>
          <Txt color={colors.muted}>{t('coachNotes.empty')}</Txt>
        </Card>
      ) : null}
      {notes ? (
        <>
          <Card style={{ marginTop: space.md, gap: space.sm }}>
            {notes.notes.split('\n').map((line, i) =>
              /^[^-•].*:$/.test(line.trim()) ? (
                <Txt key={i} variant="label" color={colors.accent} style={{ marginTop: i ? space.sm : 0 }}>
                  {line.trim().slice(0, -1)}
                </Txt>
              ) : line.trim() ? (
                <Txt key={i}>{line.trim()}</Txt>
              ) : null,
            )}
            <Txt variant="tiny" color={colors.muted}>
              {t('coachNotes.updated', { d: when })}
            </Txt>
          </Card>
          <Txt variant="small" color={colors.muted} style={{ marginTop: space.md }}>
            {t('coachNotes.fix')}
          </Txt>
          {problem ? (
            <Txt variant="small" color={colors.danger} style={{ marginTop: space.sm }}>
              {t('coachNotes.clearError')}
            </Txt>
          ) : null}
          <View style={{ marginTop: space.md, alignItems: 'flex-start' }}>
            <Button label={t('coachNotes.clear')} variant="ghost" size="sm" onPress={remove} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function CoachPromo() {
  const t = useT();
  return (
    <Screen title={t('tab.coach')} mark>
      <Card style={{ borderColor: colors.accent, gap: space.md }}>
        <Txt variant="h2">{t('coachChat.promoTitle')}</Txt>
        <Txt color={colors.muted}>{t('coachChat.promoBody')}</Txt>
        <View style={{ gap: 6 }}>
          {(['coachChat.promo1', 'coachChat.promo2', 'coachChat.promo3'] as const).map((k) => (
            <Txt key={k}>✓ {t(k)}</Txt>
          ))}
        </View>
        <Button label={t('pro.cta')} onPress={() => showPro()} />
      </Card>
    </Screen>
  );
}
