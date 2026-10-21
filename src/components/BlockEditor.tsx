// Edit one block of a routine: format, timing, exercises and targets.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useT } from '../i18n';
import { blockDurationSec, newItem, newRow } from '../lib/blocks';
import { clock, shortDuration } from '../lib/util';
import { useApp } from '../store/AppStore';
import { colors, radius, space } from '../theme';
import type { Block, BlockFormat, BlockItem, Exercise, SetRow } from '../types';
import { ExercisePicker } from './ExercisePicker';
import { Button, Chip, Field, NumberField, Row, Segmented, Txt } from './ui';

const INTERVALS = [20, 30, 40, 45, 50, 60, 90, 120];
const BREAKS = [0, 60, 120, 180, 240, 300];

export function BlockEditor({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const t = useT();
  // Where a picked exercise goes: the block's item list, or a row of sets.
  const [pickFor, setPickFor] = useState<null | { kind: 'items' } | { kind: 'row'; rowId: string }>(null);
  const { exerciseById } = useApp();

  const set = (patch: Partial<Block>) => onChange({ ...block, ...patch });

  const setFormat = (format: BlockFormat) => {
    const patch: Partial<Block> = { format };
    if (format === 'sets' && block.rows.length === 0) {
      // carry exercises over as one row each
      patch.rows = block.items.length ? block.items.map((it) => ({ ...newRow(), items: [it] })) : [newRow()];
    }
    if (format !== 'sets' && block.items.length === 0 && block.rows.length > 0) {
      patch.items = block.rows.flatMap((r) => r.items);
    }
    if (format === 'tabata' && block.format !== 'tabata') patch.rounds = 8;
    set(patch);
  };

  const onPick = (ex: Exercise) => {
    const item = newItem(ex.id, ex.kind);
    if (pickFor?.kind === 'items') set({ items: [...block.items, item] });
    if (pickFor?.kind === 'row') set({ rows: block.rows.map((r) => (r.id === pickFor.rowId ? { ...r, items: [...r.items, item] } : r)) });
    setPickFor(null);
  };

  const updateItem = (list: BlockItem[], item: BlockItem) => list.map((x) => (x.id === item.id ? item : x));
  const removeItem = (list: BlockItem[], id: string) => list.filter((x) => x.id !== id);
  const updateRow = (row: SetRow) => set({ rows: block.rows.map((r) => (r.id === row.id ? row : r)) });

  const formats: BlockFormat[] = ['emom', 'tabata', 'sets', 'circuit'];
  const dur = blockDurationSec(block);

  return (
    <View style={{ gap: space.lg }}>
      <Field label={t('block.title')} value={block.title ?? ''} onChangeText={(v) => set({ title: v })} placeholder={t('block.titlePlaceholder')} />

      <View style={{ gap: 6 }}>
        <Txt variant="small" color={colors.muted}>
          {t('block.format')}
        </Txt>
        <Segmented small value={block.format} onChange={setFormat} options={formats.map((f) => ({ value: f, label: t(`block.format.${f}`) }))} />
        <Txt variant="tiny" color={colors.faint}>
          {t(`block.format.${block.format}.help`)}
        </Txt>
      </View>

      {block.format === 'emom' && (
        <View style={{ gap: space.md }}>
          <Txt variant="small" color={colors.muted}>
            {t('block.every')}
          </Txt>
          <Row style={{ flexWrap: 'wrap' }}>
            {INTERVALS.map((s) => (
              <Chip key={s} label={shortDuration(s)} active={block.intervalSec === s} onPress={() => set({ intervalSec: s })} />
            ))}
          </Row>
          <Row gap={space.lg} style={{ flexWrap: 'wrap' }}>
            <NumberField label={`${t('block.every')} (s)`} value={block.intervalSec} min={5} max={600} step={5} onChange={(v) => set({ intervalSec: v ?? 60 })} />
            <NumberField label={t('block.rounds')} value={block.rounds} min={1} max={200} onChange={(v) => set({ rounds: v ?? 1 })} />
            <View style={{ gap: 4 }}>
              <Txt variant="tiny" color={colors.muted}>
                {t('block.totalTime')}
              </Txt>
              <Txt style={{ fontWeight: '800', paddingVertical: 8 }}>{clock(dur)}</Txt>
            </View>
          </Row>
        </View>
      )}

      {block.format === 'tabata' && (
        <Row gap={space.lg} style={{ flexWrap: 'wrap' }}>
          <NumberField label={`${t('block.work')} (s)`} value={block.workSec} min={1} max={600} step={5} onChange={(v) => set({ workSec: v ?? 20 })} />
          <NumberField label={`${t('block.rest')} (s)`} value={block.restSec} min={0} max={600} step={5} onChange={(v) => set({ restSec: v ?? 0 })} />
          <NumberField label={t('block.rounds')} value={block.rounds} min={1} max={200} onChange={(v) => set({ rounds: v ?? 1 })} />
          <View style={{ gap: 4 }}>
            <Txt variant="tiny" color={colors.muted}>
              {t('block.totalTime')}
            </Txt>
            <Txt style={{ fontWeight: '800', paddingVertical: 8 }}>{clock(dur)}</Txt>
          </View>
        </Row>
      )}

      {block.format === 'circuit' && <NumberField label={t('block.rounds')} value={block.rounds} min={1} max={100} onChange={(v) => set({ rounds: v ?? 1 })} />}

      {(block.format === 'emom' || block.format === 'tabata') && (
        <View style={{ gap: 6 }}>
          <Txt variant="small" color={colors.muted}>
            {t('block.perRound')}
          </Txt>
          <Segmented
            small
            value={block.perRound}
            onChange={(v) => set({ perRound: v })}
            options={[
              { value: 'all', label: t('block.perRound.all') },
              { value: 'rotate', label: t('block.perRound.rotate') },
            ]}
          />
        </View>
      )}

      {block.format !== 'sets' ? (
        <View style={{ gap: space.sm }}>
          <Txt variant="small" color={colors.muted}>
            {t('block.exercises')}
          </Txt>
          {block.items.length === 0 ? <Txt variant="small" color={colors.faint}>{t('block.noExercises')}</Txt> : null}
          {block.items.map((it, i) => (
            <ItemEditor
              key={it.id}
              item={it}
              prefix={block.perRound === 'rotate' && block.format !== 'circuit' ? `${t('common.round')} ${i + 1}` : undefined}
              exerciseName={exerciseById(it.exerciseId)?.name ?? '?'}
              kind={exerciseById(it.exerciseId)?.kind ?? 'reps'}
              onChange={(n) => set({ items: updateItem(block.items, n) })}
              onRemove={() => set({ items: removeItem(block.items, it.id) })}
            />
          ))}
          <Button label={`+ ${t('block.addExercise')}`} variant="ghost" size="sm" onPress={() => setPickFor({ kind: 'items' })} />
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          {block.rows.map((row, i) => (
            <View key={row.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="small" style={{ fontWeight: '800' }}>
                  #{i + 1}
                </Txt>
                <Button label={t('block.remove')} variant="ghost" size="sm" onPress={() => set({ rows: block.rows.filter((r) => r.id !== row.id) })} />
              </Row>
              <Row gap={space.lg} style={{ flexWrap: 'wrap' }}>
                <NumberField label={t('common.sets')} value={row.sets} min={1} max={50} onChange={(v) => updateRow({ ...row, sets: v ?? 1 })} />
                <NumberField label={`${t('block.restBetween')} (s)`} value={row.restSec} min={0} max={900} step={10} onChange={(v) => updateRow({ ...row, restSec: v ?? 0 })} />
              </Row>
              {row.items.map((it) => (
                <ItemEditor
                  key={it.id}
                  item={it}
                  exerciseName={exerciseById(it.exerciseId)?.name ?? '?'}
                  kind={exerciseById(it.exerciseId)?.kind ?? 'reps'}
                  onChange={(n) => updateRow({ ...row, items: updateItem(row.items, n) })}
                  onRemove={() => updateRow({ ...row, items: removeItem(row.items, it.id) })}
                />
              ))}
              <Button label={`+ ${t('block.addExercise')}`} variant="ghost" size="sm" onPress={() => setPickFor({ kind: 'row', rowId: row.id })} />
            </View>
          ))}
          <Txt variant="tiny" color={colors.faint}>
            {t('block.pairHint')}
          </Txt>
          <Button label={`+ ${t('block.addRow')}`} variant="secondary" size="sm" onPress={() => set({ rows: [...block.rows, newRow()] })} />
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Txt variant="small" color={colors.muted}>
          {t('block.restAfter')}
        </Txt>
        <Row style={{ flexWrap: 'wrap' }}>
          {BREAKS.map((s) => (
            <Chip
              key={s}
              label={s === 0 ? '—' : `${s / 60} ${t('common.min')}`}
              active={(block.restAfterSec ?? 0) === s}
              color={colors.rest}
              onPress={() => set({ restAfterSec: s || undefined })}
            />
          ))}
        </Row>
      </View>

      <Field label={t('routines.note')} value={block.note ?? ''} onChangeText={(v) => set({ note: v })} placeholder={t('block.notePlaceholder')} />

      <ExercisePicker visible={pickFor !== null} onClose={() => setPickFor(null)} onPick={onPick} />
    </View>
  );
}

function ItemEditor({
  item,
  exerciseName,
  kind,
  prefix,
  onChange,
  onRemove,
}: {
  item: BlockItem;
  exerciseName: string;
  kind: Exercise['kind'];
  prefix?: string;
  onChange: (i: BlockItem) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [showNote, setShowNote] = useState(!!item.note);
  return (
    <View style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          {prefix ? (
            <Txt variant="tiny" color={colors.accent}>
              {prefix}
            </Txt>
          ) : null}
          <Txt style={{ fontWeight: '700' }}>{exerciseName}</Txt>
        </View>
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={t('block.remove')}>
          <Txt color={colors.muted} style={{ fontSize: 20 }}>
            ×
          </Txt>
        </Pressable>
      </Row>
      <Row gap={space.md} style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {kind === 'reps' && !item.max ? (
          <NumberField label={t('block.reps')} value={item.reps} width={52} onChange={(v) => onChange({ ...item, reps: v })} allowEmpty />
        ) : null}
        {kind === 'hold' || item.seconds != null ? (
          <NumberField label={t('block.seconds')} value={item.seconds} width={52} step={5} onChange={(v) => onChange({ ...item, seconds: v })} allowEmpty />
        ) : null}
        {kind === 'distance' ? (
          <NumberField label={t('block.meters')} value={item.meters} width={60} step={50} onChange={(v) => onChange({ ...item, meters: v })} allowEmpty />
        ) : null}
        {kind === 'calories' ? (
          <NumberField label={t('block.calories')} value={item.calories} width={52} onChange={(v) => onChange({ ...item, calories: v })} allowEmpty />
        ) : null}
        <NumberField label={t('block.weight')} value={item.weightKg} width={48} step={5} onChange={(v) => onChange({ ...item, weightKg: v || undefined })} allowEmpty />
        {kind === 'reps' ? <Chip label={t('block.max')} active={!!item.max} onPress={() => onChange({ ...item, max: !item.max })} /> : null}
        {!showNote ? <Chip label={t('block.addNote')} onPress={() => setShowNote(true)} /> : null}
      </Row>
      {showNote ? <Field value={item.note ?? ''} onChangeText={(v) => onChange({ ...item, note: v || undefined })} placeholder={t('block.notePlaceholder')} /> : null}
    </View>
  );
}
