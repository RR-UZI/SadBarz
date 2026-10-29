import React, { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '../components/Logo';
import { Badge, Button, Card, Row, Screen, Txt } from '../components/ui';
import { useT } from '../i18n';
import { forTimeText, totalReps } from '../lib/blocks';
import { confirm } from '../lib/confirm';
import { clock, DAY_MS, startOfDay } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { colors, radius, space } from '../theme';
import type { Workout } from '../types';
import { BlockStatusRow, Stat } from './WorkoutScreen';

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
    <Screen title={t('history.title')} mark>
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
        {visible.length === 0 ? (
          <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
            <LogoMark size={64} style={{ opacity: 0.35 }} />
            <Txt color={colors.muted} style={{ textAlign: 'center' }}>
              {t('history.empty')}
            </Txt>
          </View>
        ) : null}
        {visible.map((w) => (
          <WorkoutCard key={w.id} workout={w} />
        ))}
      </View>
    </Screen>
  );
}

// Opens on the same summary the athlete saw when they finished; "Ver rutina" pops up every block with what was logged.
export function WorkoutDetailScreen({ id }: { id: string }) {
  const t = useT();
  const nav = useNav();
  const { workouts, deleteWorkout } = useApp();
  const dayLabel = useDayLabel();
  const [showBlocks, setShowBlocks] = useState(false);
  const w = workouts.find((x) => x.id === id);
  if (!w) {
    return (
      <Screen title="" onBack={nav.pop}>
        <Txt color={colors.muted}>—</Txt>
      </Screen>
    );
  }
  const done = w.blocks.filter((b) => b.status === 'done');
  const reps = done.reduce((s, b) => s + totalReps(b.entries), 0);
  // One row per block, in the order they were first logged; done wins over skipped when a block was repeated.
  const rows: { blockId: string; title: string; status: 'done' | 'skipped' }[] = [];
  for (const b of w.blocks) {
    const row = rows.find((r) => r.blockId === b.blockId);
    if (!row) rows.push({ blockId: b.blockId, title: b.title || b.format.toUpperCase(), status: b.status });
    else if (b.status === 'done') row.status = 'done';
  }
  const total = w.totalBlocks ?? rows.length;
  return (
    <Screen
      title={t('run.summary')}
      onBack={nav.pop}
      footer={
        <Row>
          <Button
            label={t('common.delete')}
            variant="danger"
            flex
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
          <Button label={t('history.viewRoutine')} flex onPress={() => setShowBlocks(true)} />
        </Row>
      }
    >
      <View style={{ alignItems: 'center', marginBottom: space.md }}>
        <LogoMark size={80} />
      </View>
      <Txt variant="title" style={{ textAlign: 'center' }}>
        {w.routineName}
      </Txt>
      <Txt color={colors.muted} style={{ textAlign: 'center', marginTop: 4 }}>
        {dayLabel(w.startedAt)} · {new Date(w.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Txt>
      <Row style={{ justifyContent: 'space-around', marginTop: space.xl }}>
        <Stat label={t('run.totalTime')} value={clock((w.finishedAt - w.startedAt) / 1000)} />
        <Stat label={t('run.blocksDone')} value={`${new Set(done.map((b) => b.blockId)).size}/${total}`} />
        <Stat label={t('run.totalReps')} value={String(reps)} />
      </Row>
      <View style={{ gap: space.sm, marginTop: space.xl }}>
        {rows.map((r, i) => (
          <BlockStatusRow key={r.blockId} index={i} title={r.title} status={r.status} />
        ))}
      </View>
      <WorkoutBlocksSheet workout={w} visible={showBlocks} onClose={() => setShowBlocks(false)} />
    </Screen>
  );
}

function WorkoutBlocksSheet({ workout: w, visible, onClose }: { workout: Workout; visible: boolean; onClose: () => void }) {
  const t = useT();
  const { exerciseById } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.lg,
          paddingTop: space.lg + insets.top,
          paddingBottom: space.lg + insets.bottom,
        }}
      >
        <View
          style={{
            backgroundColor: colors.bg,
            borderRadius: radius.lg,
            maxHeight: '100%',
            width: '100%',
            maxWidth: 520,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <Row style={{ justifyContent: 'space-between', padding: space.lg }}>
            <Txt variant="h2" style={{ flex: 1 }} numberOfLines={1}>
              {w.routineName}
            </Txt>
            <Button label={t('history.close')} size="sm" variant="ghost" onPress={onClose} />
          </Row>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.lg }}>
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
                {b.score ? (
                  <Txt style={{ fontWeight: '800', marginTop: 2 }} color={colors.accent}>
                    {`AMRAP · ${t('run.score', { rounds: b.score.rounds, reps: b.score.reps })}`}
                  </Txt>
                ) : null}
                {b.forTime ? (
                  <Txt style={{ fontWeight: '800', marginTop: 2 }} color={colors.accent}>
                    {`For time · ${forTimeText(t, b.forTime)}`}
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
