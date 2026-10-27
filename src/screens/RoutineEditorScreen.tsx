import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BlockEditor } from '../components/BlockEditor';
import { Button, Card, Field, Row, Screen, Txt } from '../components/ui';
import { useT } from '../i18n';
import { newBlock } from '../lib/blocks';
import { showPro, useRoutineLimit } from '../lib/plan';
import { uid } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import type { Block, Routine } from '../types';
import { BlockSummary } from './RoutinesScreen';

// With draft + onSave it edits a routine the app doesn't keep (a coach plan's day) and hands it back.
export function RoutineEditorScreen({ id, draft: given, onSave }: { id?: string; draft?: Routine; onSave?: (r: Routine) => void }) {
  const t = useT();
  const nav = useNav();
  const { routines, saveRoutine } = useApp();
  const existing = given ?? (id ? routines.find((r) => r.id === id) : undefined);

  const [draft, setDraft] = useState<Routine>(
    () =>
      existing ?? {
        id: uid('rt'),
        name: '',
        blocks: [newBlock('emom')],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
  );
  const limit = useRoutineLimit();
  const [openId, setOpenId] = useState<string | null>(existing ? null : draft.blocks[0]?.id ?? null);

  const setBlock = (b: Block) => setDraft((d) => ({ ...d, blocks: d.blocks.map((x) => (x.id === b.id ? b : x)) }));
  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const blocks = [...d.blocks];
      const j = index + dir;
      if (j < 0 || j >= blocks.length) return d;
      [blocks[index], blocks[j]] = [blocks[j], blocks[index]];
      return { ...d, blocks };
    });

  const save = () => {
    if (onSave) {
      onSave({ ...draft, name: draft.name.trim() || t('routines.untitled'), updatedAt: Date.now() });
      return nav.pop();
    }
    // A new routine past the free limit (e.g. one added on another device meanwhile) isn't saved.
    if (!existing && !limit.canAdd) return showPro('routineLimit');
    saveRoutine({ ...draft, name: draft.name.trim() || t('routines.untitled') });
    if (existing) nav.pop();
    else nav.replace({ name: 'routine', id: draft.id });
  };

  return (
    <Screen
      title={existing ? t('common.edit') : t('routines.new')}
      onBack={nav.pop}
      right={<Button label={t('common.save')} size="sm" onPress={save} />}
      footer={<Button label={t('common.save')} onPress={save} />}
    >
      <Field label={t('routines.name')} value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder={t('routines.namePlaceholder')} />
      <View style={{ height: space.md }} />
      <Field label={t('routines.note')} value={draft.note ?? ''} onChangeText={(v) => setDraft((d) => ({ ...d, note: v }))} multiline />

      <View style={{ gap: space.md, marginTop: space.xl }}>
        {draft.blocks.map((b, i) => {
          const open = openId === b.id;
          return (
            <Card key={b.id} style={open ? { borderColor: colors.accent } : undefined}>
              <Pressable onPress={() => setOpenId(open ? null : b.id)}>
                {open ? (
                  <Txt variant="label" color={colors.accent}>
                    #{i + 1} {b.title || ''}
                  </Txt>
                ) : (
                  <BlockSummary block={b} index={i} />
                )}
              </Pressable>
              {open ? (
                <View style={{ marginTop: space.lg }}>
                  <BlockEditor block={b} onChange={setBlock} />
                  <Row style={{ marginTop: space.lg, flexWrap: 'wrap' }}>
                    <Button label={`↑ ${t('routines.moveUp')}`} variant="ghost" size="sm" onPress={() => move(i, -1)} disabled={i === 0} />
                    <Button label={`↓ ${t('routines.moveDown')}`} variant="ghost" size="sm" onPress={() => move(i, 1)} disabled={i === draft.blocks.length - 1} />
                    <View style={{ flex: 1 }} />
                    <Button
                      label={t('common.delete')}
                      variant="danger"
                      size="sm"
                      onPress={() => setDraft((d) => ({ ...d, blocks: d.blocks.filter((x) => x.id !== b.id) }))}
                    />
                    <Button label={t('common.done')} size="sm" onPress={() => setOpenId(null)} />
                  </Row>
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>

      <Button
        label={`+ ${t('routines.addBlock')}`}
        variant="secondary"
        style={{ marginTop: space.lg }}
        onPress={() => {
          const b = newBlock('emom');
          setDraft((d) => ({ ...d, blocks: [...d.blocks, b] }));
          setOpenId(b.id);
        }}
      />
    </Screen>
  );
}
