// Uzi's review (admins only): every plan the coach writes waits here until he
// approves it, edits it, or sends it back with a note for the coach to rewrite.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { PlanCodeCard } from '../components/PlanCode';
import { Badge, Button, Card, Field, Row, Screen, Section, Txt } from '../components/ui';
import { useT, type StringKey } from '../i18n';
import {
  approvePlan,
  loadPlan,
  onPlansChanged,
  plansChanged,
  reviewList,
  saveApprovedEdits,
  sendBack,
  type CoachPlan,
  type CoachStatus,
  type ReviewItem,
  type ReviewPlan,
} from '../lib/coach';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, space } from '../theme';
import type { Routine } from '../types';
import { detailsSummary } from './OnboardingScreen';
import { BlockSummary } from './RoutinesScreen';

const POLL_MS = 15_000;

// Uzi's edits per plan, kept outside the screen: the plan screen closes while the editor is open.
const edits = new Map<string, CoachPlan>();

function useDate() {
  const { settings } = useApp();
  return (iso: string) =>
    new Date(iso).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ status }: { status: CoachStatus }) {
  const t = useT();
  const strong = status === 'review';
  return (
    <Badge
      label={t(`review.status.${status}` as StringKey)}
      color={strong ? colors.accent : status === 'failed' ? colors.danger : colors.surface2}
      textColor={strong ? colors.accentText : status === 'failed' ? colors.text : colors.muted}
    />
  );
}

// ---------- The list ----------

export function CoachReviewScreen() {
  const t = useT();
  const nav = useNav();
  const date = useDate();
  const [list, setList] = useState<{ pending: ReviewItem[]; recent: ReviewItem[] } | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    reviewList()
      .then((l) => {
        setList(l);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const off = onPlansChanged(refresh);
    return () => {
      clearInterval(timer);
      off();
    };
  }, [refresh]);

  const row = (p: ReviewItem) => (
    <Pressable key={p.id} onPress={() => nav.push({ name: 'coachPlan', id: p.id })} accessibilityRole="button">
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt style={{ fontWeight: '800', flex: 1 }} numberOfLines={1}>
            {p.name || t('review.athlete')}
          </Txt>
          <StatusBadge status={p.status} />
        </Row>
        <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>
          {[p.goal ? t(`onb.goal.${p.goal}`) : null, t(`coach.weeks${p.weeks}`), date(p.createdAt)].filter(Boolean).join(' · ')}
        </Txt>
      </Card>
    </Pressable>
  );

  return (
    <Screen title={t('review.title')} onBack={nav.pop}>
      {!list ? (
        failed ? <Txt color={colors.danger}>{t('review.saveError')}</Txt> : <ActivityIndicator color={colors.accent} />
      ) : (
        <>
          <Section title={t('review.pending')}>
            <View style={{ gap: space.sm }}>
              {list.pending.length ? list.pending.map(row) : <Txt color={colors.muted}>{t('review.empty')}</Txt>}
            </View>
          </Section>
          {list.recent.length ? (
            <Section title={t('review.recent')}>
              <View style={{ gap: space.sm }}>{list.recent.map(row)}</View>
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}

// ---------- One plan ----------

export function CoachPlanScreen({ id }: { id: string }) {
  const t = useT();
  const nav = useNav();
  const date = useDate();
  const { user } = useAuth();
  const { exercises } = useApp();
  const [plan, setPlan] = useState<ReviewPlan | null | undefined>(undefined);
  // Uzi's working copy of the week; set once he edits a day.
  const [edited, setEditedState] = useState<CoachPlan | null>(() => edits.get(id) ?? null);
  const setEdited = (p: CoachPlan | null) => {
    if (p) edits.set(id, p);
    else edits.delete(id);
    setEditedState(p);
  };
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadPlan(id)
      .then(setPlan)
      .catch(() => setPlan((p) => p ?? null));
  }, [id]);
  useEffect(refresh, [refresh]);
  // While the coach rewrites it, check back.
  useEffect(() => {
    if (plan?.status !== 'writing') return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [plan?.status, refresh]);

  if (plan === undefined) {
    return (
      <Screen title="" onBack={nav.pop}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (!plan) {
    return (
      <Screen title="" onBack={nav.pop}>
        <Txt color={colors.muted}>—</Txt>
      </Screen>
    );
  }

  const week = edited ?? plan.approvedPlan ?? plan.plan;
  const canReview = plan.status === 'review';
  // An approved plan can still be fixed: edits stay here until Uzi saves them.
  const canFix = plan.status === 'approved';
  const names = Object.fromEntries((plan.input.exercises ?? []).map((e) => [e.id, e.name]));

  const editDay = (index: number, routine: Routine) => {
    if (!week) return;
    nav.push({
      name: 'editRoutine',
      draft: routine,
      // The plan screen opens again after the editor and reads its edits back from `edits`.
      onSave: (r) => edits.set(id, { ...week, days: week.days.map((d, i) => (i === index ? { ...d, routine: r } : d)) }),
    });
  };

  const approve = async () => {
    if (!user) return;
    setBusy(true);
    setProblem(null);
    try {
      await approvePlan(plan, user.id, edited, exercises);
      edits.delete(id);
      plansChanged();
      nav.pop();
    } catch (e) {
      setProblem(`${t('review.saveError')} ${e instanceof Error ? e.message : ''}`.trim());
    } finally {
      setBusy(false);
    }
  };

  const saveFix = async () => {
    if (!edited) return;
    setBusy(true);
    setProblem(null);
    try {
      await saveApprovedEdits(plan, edited, exercises);
      setEdited(null);
      plansChanged();
      refresh();
    } catch (e) {
      setProblem(`${t('review.saveError')} ${e instanceof Error ? e.message : ''}`.trim());
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!note.trim()) return;
    setBusy(true);
    setProblem(null);
    const res = await sendBack(plan.id, note.trim(), exercises);
    setBusy(false);
    if (!res.ok) return setProblem(`${t('review.saveError')} ${res.detail}`);
    setNote('');
    setNoteOpen(false);
    setEdited(null);
    plansChanged();
    refresh();
  };

  return (
    <Screen
      title={plan.name || t('review.athlete')}
      onBack={nav.pop}
      right={<StatusBadge status={plan.status} />}
      footer={
        canReview ? (
          <View style={{ gap: space.sm }}>
            {problem ? (
              <Txt variant="small" color={colors.danger}>
                {problem}
              </Txt>
            ) : null}
            {noteOpen ? (
              <>
                <Field value={note} onChangeText={setNote} placeholder={t('review.notePlaceholder')} multiline />
                <Row>
                  <Button label={t('common.cancel')} variant="ghost" flex onPress={() => setNoteOpen(false)} />
                  <Button label={t('review.send')} flex disabled={busy || !note.trim()} onPress={send} />
                </Row>
              </>
            ) : (
              <Row>
                <Button label={t('review.sendBack')} variant="secondary" flex onPress={() => setNoteOpen(true)} disabled={busy} />
                <Button label={edited ? t('review.approveEdited') : t('review.approve')} flex onPress={approve} disabled={busy || !week} />
              </Row>
            )}
          </View>
        ) : canFix && edited ? (
          <View style={{ gap: space.sm }}>
            {problem ? (
              <Txt variant="small" color={colors.danger}>
                {problem}
              </Txt>
            ) : null}
            <Txt variant="small" color={colors.muted}>
              {t('review.fixNote')}
            </Txt>
            <Row>
              <Button label={t('review.discard')} variant="secondary" flex onPress={() => setEdited(null)} disabled={busy} />
              <Button label={busy ? t('review.saving') : t('review.saveFix')} flex onPress={saveFix} disabled={busy} />
            </Row>
          </View>
        ) : undefined
      }
    >
      <Txt variant="small" color={colors.muted}>
        {t('review.planOf', { weeks: t(`coach.weeks${plan.weeks}`), date: date(plan.createdAt) })}
      </Txt>

      {plan.status === 'writing' ? (
        <Card style={{ marginTop: space.md, borderColor: colors.accent }}>
          <Txt>{t('review.writing')}</Txt>
        </Card>
      ) : null}
      {plan.status === 'approved' ? (
        <Txt color={colors.accent} style={{ marginTop: space.md }}>
          {t('review.approvedNote')}
        </Txt>
      ) : null}
      {plan.status === 'approved' && plan.code ? <PlanCodeCard code={plan.code} body={t('code.adminBody')} style={{ marginTop: space.md }} /> : null}
      {plan.status === 'approved' && !plan.code ? (
        <Txt variant="small" color={colors.warn} style={{ marginTop: space.md }}>
          {t('code.loadError', { e: plan.codeError ?? '' })}
        </Txt>
      ) : null}
      {plan.status === 'failed' ? (
        <Txt color={colors.danger} style={{ marginTop: space.md }}>
          {t('review.failedNote', { e: plan.error ?? '' })}
        </Txt>
      ) : null}
      {plan.reviewNote ? (
        <Card style={{ marginTop: space.md }}>
          <Txt variant="label" color={colors.muted}>
            {t('review.lastNote')}
          </Txt>
          <Txt style={{ marginTop: 4 }}>{plan.reviewNote}</Txt>
        </Card>
      ) : null}

      <Answers plan={plan} />

      {week ? (
        <>
          <Section title={t('review.coach')} right={edited ? <Badge label={t('review.edited')} color={colors.accent} textColor={colors.accentText} /> : undefined}>
            <Card>
              {week.summary ? <Txt>{week.summary}</Txt> : null}
              {week.progression ? (
                <Txt variant="small" color={colors.accent} style={{ marginTop: space.sm }}>
                  {t('review.progression')}: {week.progression}
                </Txt>
              ) : null}
            </Card>
          </Section>
          {week.days.map((d, i) => (
            <Section
              key={d.routine.id}
              title={t(`dayLong.${d.day}` as StringKey)}
              right={canReview || canFix ? <Button label={t('common.edit')} size="sm" variant="ghost" onPress={() => editDay(i, d.routine)} /> : undefined}
            >
              <Card>
                <Txt style={{ fontWeight: '800' }}>{d.routine.name}</Txt>
                {d.routine.note ? (
                  <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>
                    {d.routine.note}
                  </Txt>
                ) : null}
                <View style={{ gap: space.md, marginTop: space.md }}>
                  {d.routine.blocks.map((b, j) => (
                    <BlockSummary key={b.id} block={b} index={j} names={names} />
                  ))}
                </View>
              </Card>
            </Section>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

// What the athlete answered and how much they trained: what Uzi needs to judge the plan.
function Answers({ plan }: { plan: ReviewPlan }) {
  const t = useT();
  const p = plan.input.profile;
  if (!p) return null;
  const rows: [StringKey, string][] = [
    ['onb.review.goal', p.goal ? t(`onb.goal.${p.goal}`) : '–'],
    ['onb.review.level', p.level ? t(`level.${p.level}`) : '–'],
    ['onb.review.details', detailsSummary(p.goal, p.details ?? {}, t)],
    ['onb.review.equipment', (p.equipment ?? []).map((e) => t(`equipment.${e}`)).join(', ') || '–'],
    ['onb.review.days', [...(p.trainingDays ?? [])].sort((a, b) => a - b).map((x) => t(`dayLong.${x}` as StringKey).slice(0, 3)).join(' · ') || '–'],
    ['onb.review.session', p.sessionMin == null ? '–' : p.sessionMin ? `${p.sessionMin} min` : t('onb.session.noCap')],
    ['onb.review.body', `${p.age != null ? t('onb.years', { n: p.age }) : '–'} · ${p.weightKg != null ? `${p.weightKg} kg` : '–'}`],
    [
      'onb.review.injuries',
      [(p.injuries ?? []).map((i) => t(`injury.${i}`)).join(', ') || t('onb.injuries.none'), p.injuryNote].filter(Boolean).join(' · '),
    ],
  ];
  if (p.maxReps) {
    const m = p.maxReps;
    rows.splice(2, 0, [
      'review.maxReps',
      `${m.pullUps} ${t('onb.test.pullUps').toLowerCase()} · ${m.dips} ${t('onb.test.dips').toLowerCase()} · ${m.pushUps} ${t('onb.test.pushUps').toLowerCase()} · ${m.muscleUps} muscle ups`,
    ]);
  }
  return (
    <Section title={t('review.answers')}>
      <Card>
        <View style={{ gap: space.sm }}>
          {rows.map(([label, value]) => (
            <Row key={label} style={{ alignItems: 'flex-start' }}>
              <Txt variant="small" color={colors.muted} style={{ width: 100 }}>
                {t(label)}
              </Txt>
              <Txt variant="small" style={{ flex: 1, fontWeight: '700' }}>
                {value}
              </Txt>
            </Row>
          ))}
        </View>
        <Txt variant="tiny" color={colors.muted} style={{ marginTop: space.md }}>
          {t('review.training', { w: plan.input.recentWorkouts?.length ?? 0, r: plan.input.records?.length ?? 0 })}
        </Txt>
      </Card>
    </Section>
  );
}

// ---------- Home card (admins only) ----------

export function ReviewHomeCard() {
  const t = useT();
  const nav = useNav();
  const [waiting, setWaiting] = useState<number | null>(null);
  useEffect(() => {
    const load = () =>
      reviewList()
        .then((l) => setWaiting(l.pending.filter((p) => p.status === 'review').length))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    const off = onPlansChanged(load);
    return () => {
      clearInterval(timer);
      off();
    };
  }, []);
  return (
    <Section title={t('review.title')} right={waiting ? <Badge label={String(waiting)} color={colors.accent} textColor={colors.accentText} /> : undefined}>
      <Card>
        <Txt>{waiting ? t('review.homeBody', { n: waiting }) : t('review.homeNone')}</Txt>
        <Button label={t('review.open')} size="sm" variant={waiting ? 'primary' : 'secondary'} style={{ marginTop: space.md }} onPress={() => nav.push({ name: 'coachReview' })} />
      </Card>
    </Section>
  );
}
