import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { RedeemCard, useCodeRoutineUpdates } from '../components/PlanCode';
import { Badge, Button, Card, Row, Screen, Txt } from '../components/ui';
import { useT } from '../i18n';
import { blockDurationSec, formatLabel, itemTarget, itemTurns } from '../lib/blocks';
import { showPro, useRoutineLimit } from '../lib/plan';
import { clock } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import type { Block, Routine } from '../types';
import { usePlanRoutines } from './MyPlanScreen';

export function RoutinesScreen() {
  useCodeRoutineUpdates();
  const t = useT();
  const { routines } = useApp();
  const nav = useNav();
  const limit = useRoutineLimit();
  // Free accounts at their limit get the Pro pop-up instead of a new routine.
  const newRoutine = () => (limit.canAdd ? nav.push({ name: 'editRoutine' }) : showPro('routineLimit'));
  // With a real plan (coach plan or plan code) the plan goes first and the examples fold away at the bottom.
  const plan = usePlanRoutines();
  const [showExamples, setShowExamples] = useState(false);
  const coachDays = plan.filter((p) => p.coach);
  const examples = plan.length ? routines.filter((r) => r.example) : [];
  const listed = plan.length ? routines.filter((r) => !r.example) : routines;

  return (
    <Screen title={t('routines.title')} mark right={<Button label="+" size="sm" onPress={newRoutine} />}>
      <Button label={t('routines.new')} variant="secondary" onPress={newRoutine} />
      {!limit.isPro ? (
        <Pressable accessibilityRole="button" onPress={() => showPro('info')} style={{ marginTop: space.sm }}>
          <Txt variant="small" color={limit.canAdd ? colors.muted : colors.warn} style={{ textAlign: 'center' }}>
            {t('routines.limitCount', { used: limit.used, limit: limit.limit })}
            <Txt variant="small" color={colors.accent} style={{ fontWeight: '700' }}>{`  ·  ${t('settings.seePro')}`}</Txt>
          </Txt>
        </Pressable>
      ) : null}
      <RedeemCard />
      {coachDays.length ? (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          <Txt variant="label">{t('myPlan.title')}</Txt>
          {coachDays.map((p) => (
            <RoutineCard key={p.routine.id} routine={p.routine} name={p.name} highlight onPress={() => nav.push({ name: 'myPlan' })} />
          ))}
        </View>
      ) : null}
      <View style={{ gap: space.md, marginTop: space.lg }}>
        {listed.length === 0 && !coachDays.length ? <Txt color={colors.muted}>{t('routines.empty')}</Txt> : null}
        {listed.map((r) => (
          <RoutineCard key={r.id} routine={r} onPress={() => nav.push({ name: 'routine', id: r.id })} />
        ))}
      </View>
      {examples.length ? (
        <View style={{ gap: space.md, marginTop: space.xl }}>
          <Pressable accessibilityRole="button" onPress={() => setShowExamples((v) => !v)} hitSlop={8}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="label">{t('routines.examples', { n: examples.length })}</Txt>
              <Txt color={colors.accent} style={{ fontWeight: '700' }}>
                {showExamples ? t('routines.hideExamples') : t('routines.showExamples')}
              </Txt>
            </Row>
          </Pressable>
          {showExamples ? examples.map((r) => <RoutineCard key={r.id} routine={r} onPress={() => nav.push({ name: 'routine', id: r.id })} />) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function RoutineCard({ routine: r, name, highlight, onPress }: { routine: Routine; name?: string; highlight?: boolean; onPress: () => void }) {
  const t = useT();
  return (
    <Card onPress={onPress} style={highlight ? { borderColor: colors.accent } : undefined}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt style={{ fontWeight: '800', fontSize: 17 }}>{name ?? r.name}</Txt>
          <Txt variant="small" color={colors.muted}>
            {r.blocks.length} {t('routines.blocks')}
          </Txt>
        </View>
        {r.example ? <Badge label={t('common.example')} /> : null}
      </Row>
      <View style={{ marginTop: space.sm, gap: 2 }}>
        {r.blocks.slice(0, 4).map((b) => (
          <Txt key={b.id} variant="small" color={colors.muted} numberOfLines={1}>
            • {b.title ? `${b.title}: ` : ''}
            {formatLabel(b, t('common.rounds'), t('common.sets'), t('common.cap'))}
          </Txt>
        ))}
      </View>
    </Card>
  );
}

// Block summary used on the routine screen and in workout mode.
// names: exercise names the app doesn't have (an athlete's own exercises in a coach plan).
export function BlockSummary({ block, index, names }: { block: Block; index?: number; names?: Record<string, string> }) {
  const t = useT();
  const { exerciseById } = useApp();
  const dur = blockDurationSec(block);
  const turns = itemTurns(block);
  const lines =
    block.format === 'sets'
      ? block.rows.map(
          (r) =>
            `${r.sets}x  ${r.items
              .map(
                (it) =>
                  `${itemTarget(it, t('run.max'))} ${exerciseById(it.exerciseId)?.name ?? names?.[it.exerciseId] ?? '?'}${it.weightKg ? ` +${it.weightKg}kg` : ''}${it.band ? ` · ${t(`band.${it.band}`).toLowerCase()}` : ''}${it.note ? ` (${it.note})` : ''}`,
              )
              .join('  +  ')}${r.restSec ? `   ·  ${t('block.rest').toLowerCase()} ${r.restSec}"` : ''}`,
        )
      : block.items.map(
          (it, i) =>
            `${block.perRound === 'rotate' ? `${t('common.round')} ${turns[i] + 1}: ` : ''}${itemTarget(it, t('run.max'))} ${exerciseById(it.exerciseId)?.name ?? names?.[it.exerciseId] ?? '?'}${
              it.weightKg ? ` +${it.weightKg}kg` : ''
            }${it.band ? ` · ${t(`band.${it.band}`).toLowerCase()}` : ''}${it.note ? ` (${it.note})` : ''}`,
        );
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt style={{ fontWeight: '800' }} numberOfLines={1}>
          {index != null ? `${index + 1}. ` : ''}
          {block.title || formatLabel(block, t('common.rounds'), t('common.sets'), t('common.cap'))}
        </Txt>
        {dur > 0 && block.format !== 'sets' && block.format !== 'amrap' && block.format !== 'fortime' ? <Txt variant="small" color={colors.muted}>{clock(dur)}</Txt> : null}
      </Row>
      {block.title ? (
        <Txt variant="small" color={colors.accent}>
          {formatLabel(block, t('common.rounds'), t('common.sets'), t('common.cap'))}
          {block.format === 'emom' && block.perRound === 'rotate' ? ` · ${t('block.perRound.rotate').toLowerCase()}` : ''}
        </Txt>
      ) : null}
      {lines.map((l, i) => (
        <Txt key={i} variant="small" color={colors.muted}>
          {l}
        </Txt>
      ))}
      {block.note ? (
        <Txt variant="small" color={colors.faint}>
          {block.note}
        </Txt>
      ) : null}
    </View>
  );
}
