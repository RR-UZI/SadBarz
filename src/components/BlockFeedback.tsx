// Optional feedback on the block just finished, filled in during the rest: how it felt, whether the
// clock had to be paused, and a free note. Nothing here is required. It's saved with the workout and
// the AI coach reads it when it writes the next plan.
import React, { useState } from 'react';
import { View } from 'react-native';

import { useT } from '../i18n';
import { colors, space } from '../theme';
import type { BlockFeel, BlockLog } from '../types';
import { Badge, Button, Card, Chip, Field, Row, Txt } from './ui';

export const FEELS: { id: BlockFeel; color: string }[] = [
  { id: 'easy', color: colors.success },
  { id: 'good', color: colors.accent },
  { id: 'hard', color: colors.warn },
  { id: 'max', color: colors.danger },
];

export function BlockFeedback({ log, onChange }: { log: BlockLog; onChange: (patch: Partial<Pick<BlockLog, 'feel' | 'paused' | 'note'>>) => void }) {
  const t = useT();
  const [writing, setWriting] = useState(!!log.note);
  return (
    <Card style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="label" style={{ flex: 1 }}>
          {t('feel.title', { block: log.title || log.format.toUpperCase() })}
        </Txt>
        <Badge label={t('common.optional')} />
      </Row>
      <Row style={{ flexWrap: 'wrap', gap: space.xs }}>
        {FEELS.map((f) => (
          <Chip key={f.id} label={t(`feel.${f.id}`)} color={f.color} active={log.feel === f.id} onPress={() => onChange({ feel: log.feel === f.id ? undefined : f.id })} />
        ))}
      </Row>
      <Row style={{ flexWrap: 'wrap', gap: space.xs }}>
        <Chip label={t('feel.paused')} color={colors.warn} active={!!log.paused} onPress={() => onChange({ paused: log.paused ? undefined : true })} />
      </Row>
      {writing ? (
        <Field value={log.note ?? ''} onChangeText={(v) => onChange({ note: v || undefined })} placeholder={t('feel.notePlaceholder')} multiline />
      ) : (
        <View style={{ alignItems: 'flex-start' }}>
          <Button label={`✎ ${t('feel.addNote')}`} variant="ghost" size="sm" onPress={() => setWriting(true)} />
        </View>
      )}
    </Card>
  );
}

// One line for history: "Duro · pausé · the note".
export function feedbackText(t: ReturnType<typeof useT>, b: Pick<BlockLog, 'feel' | 'paused' | 'note'>) {
  return [b.feel ? t(`feel.${b.feel}`) : '', b.paused ? t('feel.pausedShort') : '', b.note?.trim() ?? ''].filter(Boolean).join(' · ');
}
