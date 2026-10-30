import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '../i18n';
import { uid } from '../lib/util';
import { useApp } from '../store/AppStore';
import { colors, radius, space } from '../theme';
import type { Category, Exercise, ExerciseKind } from '../types';
import { Button, Chip, Field, Row, Segmented, Txt, styles as ui } from './ui';

const CATEGORIES: Category[] = ['push', 'pull', 'tubos', 'legs', 'core', 'skills', 'cardio'];

export function ExercisePicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { exercises, addExercise, updateExercise } = useApp();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  // An exercise the user made, open for fixing its name or group (its kind stays: routines already use it).
  const [editing, setEditing] = useState<Exercise | null>(null);
  const inForm = creating || editing !== null;
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<ExerciseKind>('reps');
  const [newCat, setNewCat] = useState<Category>('push');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => (!cat || e.category === cat) && (!q || e.name.toLowerCase().includes(q)));
  }, [exercises, query, cat]);

  const startEdit = (ex: Exercise) => {
    setEditing(ex);
    setNewName(ex.name);
    setNewCat(ex.category);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setNewName('');
  };

  const create = () => {
    if (!newName.trim()) return;
    if (editing) {
      updateExercise({ ...editing, name: newName.trim(), category: newCat });
      return closeForm();
    }
    const ex: Exercise = { id: uid('ex'), name: newName.trim(), kind: newKind, category: newCat, custom: true };
    addExercise(ex);
    setCreating(false);
    setNewName('');
    onPick(ex);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            maxHeight: '88%',
            minHeight: '70%',
            paddingBottom: insets.bottom,
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Row style={{ justifyContent: 'space-between', padding: space.lg }}>
            <Txt variant="h2">{editing ? t('exercise.edit') : creating ? t('exercise.new') : t('exercise.pick')}</Txt>
            <Button label={t('common.cancel')} size="sm" variant="ghost" onPress={() => (inForm ? closeForm() : onClose())} />
          </Row>

          {inForm ? (
            <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
              <Field label={t('exercise.name')} value={newName} onChangeText={setNewName} placeholder="Ej. Tubo con lastre" />
              {editing ? null : (
                <View style={{ gap: 6 }}>
                  <Txt variant="small" color={colors.muted}>
                    {t('exercise.kind')}
                  </Txt>
                  <Segmented
                    small
                    value={newKind}
                    onChange={setNewKind}
                    options={(['reps', 'hold', 'distance', 'calories'] as ExerciseKind[]).map((k) => ({ value: k, label: t(`exercise.kind.${k}`) }))}
                  />
                </View>
              )}
              <View style={{ gap: 6 }}>
                <Txt variant="small" color={colors.muted}>
                  {t('exercise.category')}
                </Txt>
                <Row style={{ flexWrap: 'wrap' }}>
                  {CATEGORIES.map((c) => (
                    <Chip key={c} label={t(`cat.${c}`)} active={newCat === c} onPress={() => setNewCat(c)} />
                  ))}
                </Row>
              </View>
              {editing ? (
                <Txt variant="tiny" color={colors.faint}>
                  {t('exercise.editHint')}
                </Txt>
              ) : null}
              <Button label={t('common.save')} onPress={create} disabled={!newName.trim()} />
            </View>
          ) : (
            <>
              <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
                <TextInput value={query} onChangeText={setQuery} placeholder={t('exercise.search')} placeholderTextColor={colors.faint} style={ui.input} />
                <Row style={{ flexWrap: 'wrap' }}>
                  {CATEGORIES.map((c) => (
                    <Chip key={c} label={t(`cat.${c}`)} active={cat === c} onPress={() => setCat(cat === c ? null : c)} />
                  ))}
                </Row>
              </View>
              <FlatList
                data={list}
                keyExtractor={(e) => e.id}
                style={{ marginTop: space.sm }}
                contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={<Button label={`+ ${t('exercise.new')}`} variant="ghost" onPress={() => setCreating(true)} style={{ marginTop: space.md }} />}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => onPick(item)}
                    style={({ pressed }) => [
                      { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Txt style={{ flex: 1 }}>{item.name}</Txt>
                    <Row gap={space.md}>
                      <Txt variant="small" color={colors.muted}>
                        {t(`cat.${item.category}`)}
                      </Txt>
                      {item.custom ? (
                        <Pressable onPress={() => startEdit(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${t('exercise.rename')}: ${item.name}`}>
                          <Txt variant="small" color={colors.accent}>
                            ✎
                          </Txt>
                        </Pressable>
                      ) : null}
                    </Row>
                  </Pressable>
                )}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
