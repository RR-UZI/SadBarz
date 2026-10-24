import React from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Row, Screen, Txt } from '../components/ui';
import { useT } from '../i18n';
import { blockDurationSec, formatLabel, itemTarget, itemTurns } from '../lib/blocks';
import { clock } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import type { Block } from '../types';

export function RoutinesScreen() {
  const t = useT();
  const { routines } = useApp();
  const nav = useNav();

  return (
    <Screen title={t('routines.title')} mark right={<Button label="+" size="sm" onPress={() => nav.push({ name: 'editRoutine' })} />}>
      <Button label={t('routines.new')} variant="secondary" onPress={() => nav.push({ name: 'editRoutine' })} />
      <View style={{ gap: space.md, marginTop: space.lg }}>
        {routines.length === 0 ? <Txt color={colors.muted}>{t('routines.empty')}</Txt> : null}
        {routines.map((r) => (
          <Card key={r.id} onPress={() => nav.push({ name: 'routine', id: r.id })}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt style={{ fontWeight: '800', fontSize: 17 }}>{r.name}</Txt>
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
                  {formatLabel(b, t('common.rounds'), t('common.sets'))}
                </Txt>
              ))}
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

// Block summary used on the routine screen and in workout mode.
export function BlockSummary({ block, index }: { block: Block; index?: number }) {
  const t = useT();
  const { exerciseById } = useApp();
  const dur = blockDurationSec(block);
  const turns = itemTurns(block);
  const lines =
    block.format === 'sets'
      ? block.rows.map(
          (r) =>
            `${r.sets}x  ${r.items
              .map((it) => `${itemTarget(it, t('run.max'))} ${exerciseById(it.exerciseId)?.name ?? '?'}${it.weightKg ? ` +${it.weightKg}kg` : ''}`)
              .join('  +  ')}${r.restSec ? `   ·  ${t('block.rest').toLowerCase()} ${r.restSec}"` : ''}`,
        )
      : block.items.map(
          (it, i) =>
            `${block.perRound === 'rotate' ? `${t('common.round')} ${turns[i] + 1}: ` : ''}${itemTarget(it, t('run.max'))} ${exerciseById(it.exerciseId)?.name ?? '?'}${
              it.weightKg ? ` +${it.weightKg}kg` : ''
            }${it.note ? ` (${it.note})` : ''}`,
        );
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt style={{ fontWeight: '800' }} numberOfLines={1}>
          {index != null ? `${index + 1}. ` : ''}
          {block.title || formatLabel(block, t('common.rounds'), t('common.sets'))}
        </Txt>
        {dur > 0 && block.format !== 'sets' && block.format !== 'amrap' ? <Txt variant="small" color={colors.muted}>{clock(dur)}</Txt> : null}
      </Row>
      {block.title ? (
        <Txt variant="small" color={colors.accent}>
          {formatLabel(block, t('common.rounds'), t('common.sets'))}
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
