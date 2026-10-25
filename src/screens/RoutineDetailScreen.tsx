import React from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Row, Screen, Txt } from '../components/ui';
import { useT } from '../i18n';
import { blockDurationSec, cloneBlock } from '../lib/blocks';
import { confirm } from '../lib/confirm';
import { showPro, useRoutineLimit } from '../lib/plan';
import { clock, uid } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import { BlockSummary } from './RoutinesScreen';

export function RoutineDetailScreen({ id }: { id: string }) {
  const t = useT();
  const nav = useNav();
  const { routines, saveRoutine, deleteRoutine } = useApp();
  const routine = routines.find((r) => r.id === id);
  const limit = useRoutineLimit();

  if (!routine) {
    return (
      <Screen title="" onBack={nav.pop}>
        <Txt color={colors.muted}>—</Txt>
      </Screen>
    );
  }

  const timed = routine.blocks.reduce((s, b) => s + blockDurationSec(b), 0);

  const duplicate = () => {
    if (!limit.canAdd) return showPro('routineLimit');
    const now = Date.now();
    const copy = {
      ...routine,
      id: uid('rt'),
      name: `${routine.name} (${t('common.copy')})`,
      example: false,
      blocks: routine.blocks.map(cloneBlock),
      createdAt: now,
      updatedAt: now,
    };
    saveRoutine(copy);
    nav.replace({ name: 'routine', id: copy.id });
  };

  return (
    <Screen
      title={routine.name}
      onBack={nav.pop}
      right={<Button label={t('common.edit')} size="sm" variant="secondary" onPress={() => nav.push({ name: 'editRoutine', id: routine.id })} />}
      footer={<Button label={t('routines.startWorkout')} size="lg" onPress={() => nav.push({ name: 'workout', routineId: routine.id })} disabled={routine.blocks.length === 0} />}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="small" color={colors.muted}>
          {routine.blocks.length} {t('routines.blocks')}
          {timed > 0 ? ` · ~${clock(timed)}` : ''}
        </Txt>
        {routine.example ? <Badge label={t('common.example')} /> : null}
      </Row>
      {routine.note ? (
        <Txt color={colors.muted} style={{ marginTop: space.sm }}>
          {routine.note}
        </Txt>
      ) : null}

      <View style={{ gap: space.md, marginTop: space.lg }}>
        {routine.blocks.map((b, i) => (
          <Card key={b.id}>
            <BlockSummary block={b} index={i} />
            {b.restAfterSec ? (
              <Txt variant="tiny" color={colors.rest} style={{ marginTop: space.sm }}>
                {t('block.rest')}: {clock(b.restAfterSec)}
              </Txt>
            ) : null}
          </Card>
        ))}
        {routine.blocks.length === 0 ? <Txt color={colors.muted}>{t('routines.noBlocks')}</Txt> : null}
      </View>

      <Row style={{ marginTop: space.xl }}>
        <Button label={t('routines.duplicate')} variant="ghost" onPress={duplicate} flex />
        <Button
          label={t('common.delete')}
          variant="danger"
          flex
          onPress={() =>
            confirm(
              t('common.confirmDelete'),
              () => {
                deleteRoutine(routine.id);
                nav.pop();
              },
              t('common.delete'),
              t('common.cancel'),
            )
          }
        />
      </Row>
    </Screen>
  );
}
