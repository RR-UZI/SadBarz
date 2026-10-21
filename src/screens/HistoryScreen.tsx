import React from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Row, Screen, Txt } from '../components/ui';
import { useT } from '../i18n';
import { totalReps } from '../lib/blocks';
import { confirm } from '../lib/confirm';
import { clock, DAY_MS, startOfDay } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import type { Workout } from '../types';

// Free plan shows the last 2 weeks; Pro will show everything.
const FREE_HISTORY_DAYS = 14;

function useDayLabel() {
  const t = useT();
  const { settings } = useApp();
  return (ts: number) => {
    const today = startOfDay(Date.now());
    const day = startOfDay(ts);
    if (day === today) return t('history.today');
    if (day === today - DAY_MS) return t('history.yesterday');
    return new Date(ts).toLocaleDateString(settings.language === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', day: 'numeric', month: 'short' });
  };
}

export function WorkoutCard({ workout }: { workout: Workout }) {
  const t = useT();
  const nav = useNav();
  const dayLabel = useDayLabel();
  const done = workout.blocks.filter((b) => b.status === 'done');
  const reps = done.reduce((s, b) => s + totalReps(b.entries), 0);
  const total = workout.totalBlocks ?? new Set(workout.blocks.map((b) => b.blockId)).size;
  return (
    <Card onPress={() => nav.push({ name: 'workoutDetail', id: workout.id })}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt style={{ fontWeight: '800', flex: 1 }} numberOfLines={1}>
          {workout.routineName}
        </Txt>
        <Txt variant="small" color={colors.muted}>
          {clock((workout.finishedAt - workout.startedAt) / 1000)}
        </Txt>
      </Row>
      <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>
        {dayLabel(workout.startedAt)} · {t('history.blocks', { done: new Set(done.map((b) => b.blockId)).size, total })} · {reps} reps
      </Txt>
    </Card>
  );
}

export function HistoryScreen() {
  const t = useT();
  const { workouts } = useApp();
  const cutoff = startOfDay(Date.now()) - (FREE_HISTORY_DAYS - 1) * DAY_MS;
  const visible = workouts.filter((w) => w.startedAt >= cutoff);

  return (
    <Screen title={t('history.title')}>
      <Card style={{ borderStyle: 'dashed', borderColor: colors.faint }}>
        <Txt variant="small">{t('history.free')}</Txt>
        <Row style={{ marginTop: 6 }}>
          <Badge label="PRO" color={colors.accent} textColor={colors.accentText} />
          <Txt variant="small" color={colors.muted} style={{ flex: 1 }}>
            {t('history.pro')}
          </Txt>
        </Row>
      </Card>
      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {visible.length === 0 ? <Txt color={colors.muted}>{t('history.empty')}</Txt> : null}
        {visible.map((w) => (
          <WorkoutCard key={w.id} workout={w} />
        ))}
      </View>
    </Screen>
  );
}

export function WorkoutDetailScreen({ id }: { id: string }) {
  const t = useT();
  const nav = useNav();
  const { workouts, exerciseById, deleteWorkout } = useApp();
  const dayLabel = useDayLabel();
  const w = workouts.find((x) => x.id === id);
  if (!w) {
    return (
      <Screen title="" onBack={nav.pop}>
        <Txt color={colors.muted}>—</Txt>
      </Screen>
    );
  }
  return (
    <Screen title={w.routineName} onBack={nav.pop}>
      <Txt color={colors.muted}>
        {dayLabel(w.startedAt)} · {new Date(w.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {clock((w.finishedAt - w.startedAt) / 1000)}
      </Txt>
      <View style={{ gap: space.md, marginTop: space.lg }}>
        {w.blocks.map((b, i) => (
          <Card key={i} style={b.status === 'skipped' ? { opacity: 0.6 } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt style={{ fontWeight: '800', flex: 1 }}>{b.title || b.format.toUpperCase()}</Txt>
              <Badge
                label={t(`run.status.${b.status}`)}
                color={b.status === 'done' ? colors.success : colors.warn}
                textColor={colors.accentText}
              />
            </Row>
            {b.durationSec ? (
              <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>
                {clock(b.durationSec)}
              </Txt>
            ) : null}
            <View style={{ marginTop: space.sm, gap: 2 }}>
              {b.entries.map((e, j) => (
                <Txt key={j} variant="small">
                  {e.rounds} x {e.reps ?? ''}
                  {e.seconds ? `${e.seconds}"` : ''}
                  {e.meters ? `${e.meters} m` : ''}
                  {e.calories ? `${e.calories} cal` : ''} {exerciseById(e.exerciseId)?.name ?? '?'}
                  {e.weightKg ? <Txt variant="small" color={colors.accent}>{` +${e.weightKg}kg`}</Txt> : null}
                </Txt>
              ))}
            </View>
          </Card>
        ))}
      </View>
      <Button
        label={t('common.delete')}
        variant="danger"
        style={{ marginTop: space.xl }}
        onPress={() =>
          confirm(
            t('common.confirmDelete'),
            () => {
              deleteWorkout(w.id);
              nav.pop();
            },
            t('common.delete'),
            t('common.cancel'),
          )
        }
      />
    </Screen>
  );
}
