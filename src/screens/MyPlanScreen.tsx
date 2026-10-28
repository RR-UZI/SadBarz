// Mi plan: the athlete's approved coach plan. Today's routine with a Start
// button, the week's training days, and how far into the plan they are.
// The Home card shows today's part; the screen shows any day of the week.
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { longDate } from '../components/onboarding';
import { Button, Card, Row, Screen, Txt } from '../components/ui';
import { useT, type StringKey } from '../i18n';
import { cachedPlan, myPlan, onPlansChanged, planTiming, type MyPlan } from '../lib/coach';
import { weekday } from '../lib/profile';
import { isoDay } from '../lib/records';
import { startOfWeek } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, radius, space } from '../theme';
import type { Routine } from '../types';
import { BlockSummary } from './RoutinesScreen';

/** The approved plan: the device's copy first, then the server's. undefined = still loading. */
export function useMyPlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<MyPlan | null | undefined>(undefined);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setPlan(null);
      return;
    }
    let live = true;
    const load = () => {
      myPlan(userId)
        .then((p) => live && setPlan(p))
        .catch(() => live && setPlan((p) => p ?? null));
    };
    cachedPlan(userId).then((p) => live && setPlan((cur) => (cur === undefined ? p : cur)));
    load();
    const off = onPlansChanged(load);
    return () => {
      live = false;
      off();
    };
  }, [userId]);
  // Exercises the coach created for the plan exist only in his account: add them here so the routines show their names.
  const { exercises, addExercise } = useApp();
  useEffect(() => {
    plan?.exercises?.filter((e) => !exercises.some((x) => x.id === e.id)).forEach(addExercise);
  }, [plan, exercises, addExercise]);
  return plan;
}

/** Plan days done this week: a workout of that day's routine since Monday. */
function useDoneThisWeek() {
  const { workouts } = useApp();
  const monday = startOfWeek(Date.now());
  return (r: Routine) => workouts.some((w) => w.routineId === r.id && w.startedAt >= monday);
}

function todayIndex() {
  return weekday(new Date());
}

// The coach usually names routines "Lunes · ...": add the day only when the name doesn't start with it.
function withDay(name: string, day: string) {
  return name.toLowerCase().startsWith(day.toLowerCase()) ? name : `${day} · ${name}`;
}

// The next training day after `from` (wrapping to next week), for rest days.
function nextDay(plan: MyPlan, from: number) {
  return plan.days.find((d) => d.day > from) ?? plan.days[0];
}

export function MyPlanHomeCard() {
  const t = useT();
  const nav = useNav();
  const { settings } = useApp();
  const plan = useMyPlan();
  const done = useDoneThisWeek();
  if (!plan) return null;
  const timing = planTiming(plan, isoDay(Date.now()));

  const today = todayIndex();
  const todays = plan.days.find((d) => d.day === today);
  const next = nextDay(plan, today);
  const open = () => nav.push({ name: 'myPlan' });

  return (
    // Sits above "This week" on Home, so it brings its own space below.
    <View style={{ marginBottom: space.xl }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
        <Txt variant="label">{t('myPlan.title')}</Txt>
        <Txt variant="small" color={colors.muted}>
          {timing.phase === 'active' ? t('myPlan.week', { n: timing.week, total: plan.weeks }) : t('myPlan.weeksTotal', { n: plan.weeks })}
        </Txt>
      </Row>
      <Card onPress={open} style={timing.phase === 'ended' ? undefined : { borderColor: colors.accent }}>
        {timing.phase === 'ended' ? (
          <Txt color={colors.muted}>{t('myPlan.endedHome', { date: longDate(timing.endDate, settings.language) })}</Txt>
        ) : timing.phase === 'upcoming' ? (
          <>
            <Txt variant="label" color={colors.accent}>
              {t('myPlan.startsOn', { date: longDate(plan.startDate, settings.language) })}
            </Txt>
            <Txt style={{ fontWeight: '700', marginTop: space.sm }}>{plan.days[0].routine.name}</Txt>
          </>
        ) : todays ? (
          <>
            <Txt variant="label" color={colors.accent}>
              {t('myPlan.today')}
            </Txt>
            <Txt variant="h2" style={{ marginTop: space.xs }}>
              {todays.routine.name}
            </Txt>
            <Txt variant="small" color={colors.muted} numberOfLines={2} style={{ marginTop: space.xs }}>
              {todays.routine.blocks.map((b) => b.title).filter(Boolean).join(' · ')}
            </Txt>
            {done(todays.routine) ? (
              <Txt color={colors.success} style={{ fontWeight: '700', marginTop: space.md }}>
                ✓ {t('myPlan.doneToday')}
              </Txt>
            ) : (
              <Button label={t('myPlan.startToday')} style={{ marginTop: space.md }} onPress={() => nav.push({ name: 'workout', routineId: todays.routine.id, routine: todays.routine })} />
            )}
          </>
        ) : (
          <>
            <Txt variant="label" color={colors.accent}>
              {t('myPlan.restToday')}
            </Txt>
            <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
              {t('myPlan.next', { name: withDay(next.routine.name, t(`dayLong.${next.day}` as StringKey)) })}
            </Txt>
          </>
        )}
        <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
          <Txt variant="tiny" color={colors.faint}>
            {timing.phase === 'active' ? t(timing.daysLeft === 1 ? 'myPlan.dayLeft' : 'myPlan.daysLeft', { n: timing.daysLeft }) : ''}
          </Txt>
          <Txt variant="small" color={colors.accent} style={{ fontWeight: '700' }}>
            {t('myPlan.open')} ›
          </Txt>
        </Row>
      </Card>
    </View>
  );
}

export function MyPlanScreen() {
  const t = useT();
  const nav = useNav();
  const { settings } = useApp();
  const plan = useMyPlan();
  const done = useDoneThisWeek();
  const today = todayIndex();
  const [picked, setPicked] = useState<number | null>(null);

  if (!plan) {
    return (
      <Screen title={t('myPlan.title')} onBack={nav.pop}>
        <Txt color={colors.muted}>{plan === undefined ? '…' : t('myPlan.none')}</Txt>
      </Screen>
    );
  }

  const timing = planTiming(plan, isoDay(Date.now()));
  const training = new Map(plan.days.map((d) => [d.day, d.routine]));
  // Today when it's a training day, otherwise the next one.
  const selected = picked ?? (training.has(today) ? today : nextDay(plan, today).day);
  const routine = training.get(selected);
  const status =
    timing.phase === 'upcoming'
      ? t('myPlan.startsOn', { date: longDate(plan.startDate, settings.language) })
      : timing.phase === 'ended'
        ? t('myPlan.endedOn', { date: longDate(timing.endDate, settings.language) })
        : `${t('myPlan.week', { n: timing.week, total: plan.weeks })} · ${t(timing.daysLeft === 1 ? 'myPlan.dayLeft' : 'myPlan.daysLeft', { n: timing.daysLeft })}`;

  return (
    <Screen
      title={t('myPlan.title')}
      onBack={nav.pop}
      footer={
        routine ? (
          <Button
            label={selected === today ? t('myPlan.startToday') : t('myPlan.startDay', { day: t(`dayLong.${selected}` as StringKey) })}
            size="lg"
            disabled={routine.blocks.length === 0}
            onPress={() => nav.push({ name: 'workout', routineId: routine.id, routine })}
          />
        ) : undefined
      }
    >
      <Txt color={timing.phase === 'ended' ? colors.warn : colors.accent} style={{ fontWeight: '700' }}>
        {status}
      </Txt>

      <Row style={{ justifyContent: 'space-between', marginTop: space.lg }}>
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const r = training.get(d);
          const on = d === selected;
          const ok = r ? done(r) : false;
          return (
            <Pressable
              key={d}
              onPress={() => setPicked(d)}
              accessibilityRole="button"
              accessibilityLabel={t(`dayLong.${d}` as StringKey)}
              accessibilityState={{ selected: on }}
              style={{ alignItems: 'center', gap: 4 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: r ? colors.accent : colors.border,
                  backgroundColor: on ? (r ? colors.accent : colors.surface2) : 'transparent',
                }}
              >
                <Txt style={{ fontWeight: '800' }} color={on && r ? colors.accentText : r ? colors.text : colors.faint}>
                  {t(`day.${d}` as StringKey)}
                </Txt>
              </View>
              <Txt variant="tiny" color={ok ? colors.success : d === today ? colors.accent : 'transparent'}>
                {ok ? '✓' : '•'}
              </Txt>
            </Pressable>
          );
        })}
      </Row>

      {routine ? (
        <>
          <Txt variant="label" style={{ marginTop: space.lg }}>
            {t(`dayLong.${selected}` as StringKey)}
            {selected === today ? ` · ${t('myPlan.todayShort')}` : ''}
          </Txt>
          <Txt variant="h2" style={{ marginTop: space.xs }}>
            {routine.name}
          </Txt>
          {done(routine) ? (
            <Txt color={colors.success} style={{ fontWeight: '700', marginTop: space.xs }}>
              ✓ {t('myPlan.doneThisWeek')}
            </Txt>
          ) : null}
          {routine.note ? (
            <Txt color={colors.muted} style={{ marginTop: space.sm }}>
              {routine.note}
            </Txt>
          ) : null}
          <View style={{ gap: space.md, marginTop: space.md }}>
            {routine.blocks.map((b, i) => (
              <Card key={b.id}>
                <BlockSummary block={b} index={i} />
              </Card>
            ))}
          </View>
        </>
      ) : (
        <Card style={{ marginTop: space.lg }}>
          <Txt variant="label">
            {t(`dayLong.${selected}` as StringKey)}
            {selected === today ? ` · ${t('myPlan.todayShort')}` : ''}
          </Txt>
          <Txt variant="h2" style={{ marginTop: space.xs }}>
            {t('myPlan.rest')}
          </Txt>
          <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
            {t('myPlan.restBody')}
          </Txt>
        </Card>
      )}

      {plan.progression ? (
        <Card style={{ marginTop: space.xl }}>
          <Txt variant="label">{t('myPlan.progression')}</Txt>
          <Txt style={{ marginTop: space.sm }}>{plan.progression}</Txt>
        </Card>
      ) : null}
    </Screen>
  );
}
