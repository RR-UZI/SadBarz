// "Entreno en curso": a workout left before it was finished, to pick up where it was.
import React from 'react';

import { useT } from '../i18n';
import { clearActiveWorkout, useActiveWorkout } from '../lib/activeWorkout';
import { confirm } from '../lib/confirm';
import { useNav } from '../navigation';
import { useAuth } from '../store/Auth';
import { colors, space } from '../theme';
import { Button, Card, Row, Txt } from './ui';

// routineId: only show it on that routine's page.
export function ActiveWorkoutCard({ routineId }: { routineId?: string }) {
  const t = useT();
  const nav = useNav();
  const { user } = useAuth();
  const active = useActiveWorkout(user?.id ?? null);
  if (!active || (routineId && active.routine.id !== routineId)) return null;
  const total = active.routine.blocks.length;
  const done = new Set(active.logs.map((l) => l.blockId)).size;
  const where = active.phase.kind === 'summary' ? t('active.finished') : t('active.where', { n: Math.min(active.index + 1, total), total, done });
  return (
    <Card style={{ borderColor: colors.accent, marginBottom: space.lg }}>
      <Txt variant="label" color={colors.accent}>
        {t('active.title')}
      </Txt>
      <Txt style={{ fontWeight: '800', marginTop: 4 }} numberOfLines={1}>
        {active.routine.name}
      </Txt>
      <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>
        {where}
      </Txt>
      <Row style={{ marginTop: space.md }}>
        <Button
          label={t('active.discard')}
          variant="ghost"
          flex
          onPress={() => confirm(t('active.discardConfirm'), clearActiveWorkout, t('active.discard'), t('common.cancel'))}
        />
        <Button
          label={`▶ ${t('active.continue')}`}
          flex
          onPress={() => nav.push({ name: 'workout', routineId: active.routine.id, routine: active.routine, resume: active })}
        />
      </Row>
    </Card>
  );
}
