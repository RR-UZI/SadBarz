// Workout mode: runs a routine block by block.
// ready -> running -> review (Done / Repeat / Skip / Finish) -> break -> ready ... -> summary
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { BlockRunner } from '../components/BlockRunner';
import { Badge, Button, Card, NumberField, Row, Screen, Txt } from '../components/ui';
import { useT } from '../i18n';
import { defaultEntries, totalReps } from '../lib/blocks';
import { confirm } from '../lib/confirm';
import { sounds, unlockAudio } from '../lib/sound';
import { useClock } from '../lib/useClock';
import { clock, uid } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { colors, radius, space } from '../theme';
import type { Block, BlockLog, LogEntry, Workout } from '../types';
import { BlockSummary } from './RoutinesScreen';

type Phase =
  | { kind: 'ready'; afterBreak?: boolean }
  | { kind: 'running'; run: number }
  | { kind: 'review'; durationSec: number }
  | { kind: 'pickBreak'; nextIndex: number }
  | { kind: 'break'; nextIndex: number; seconds: number }
  | { kind: 'summary' };

export function useKeepAwake(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    activateKeepAwakeAsync('sadbarz-workout').catch(() => {});
    return () => {
      // may reject if the lock never activated (e.g. browser refused it)
      Promise.resolve()
        .then(() => deactivateKeepAwake('sadbarz-workout'))
        .catch(() => {});
    };
  }, [enabled]);
}

export function WorkoutScreen({ routineId }: { routineId: string }) {
  const t = useT();
  const nav = useNav();
  const { routines, settings, saveWorkout } = useApp();
  const routine = routines.find((r) => r.id === routineId);
  const blocks = routine?.blocks ?? [];

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  const [logs, setLogs] = useState<BlockLog[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const startedAt = useRef(Date.now());
  const runCount = useRef(0);

  useKeepAwake(settings.keepAwake);

  const block = blocks[index];

  const statusOf = (b: Block) => {
    const mine = logs.filter((l) => l.blockId === b.id);
    if (mine.some((l) => l.status === 'done')) return 'done' as const;
    if (mine.some((l) => l.status === 'skipped')) return 'skipped' as const;
    return 'todo' as const;
  };

  const startBlock = () => {
    unlockAudio();
    runCount.current += 1;
    setPhase({ kind: 'running', run: runCount.current });
  };

  const addLog = (status: BlockLog['status'], durationSec: number, e: LogEntry[]) => {
    if (!block) return logs;
    const log: BlockLog = { blockId: block.id, title: block.title || '', format: block.format, status, durationSec, entries: e };
    const next = [...logs, log];
    setLogs(next);
    return next;
  };

  // After a block: go to a break (or straight on), or the summary if nothing is left.
  const afterBlock = (nextIndex: number, withBreak: boolean) => {
    if (nextIndex >= blocks.length) {
      setPhase({ kind: 'summary' });
      return;
    }
    if (!withBreak) {
      setIndex(nextIndex);
      setPhase({ kind: 'ready' });
      return;
    }
    if (settings.breakMode === 'fixed') startBreak(nextIndex, settings.fixedBreakSec);
    else setPhase({ kind: 'pickBreak', nextIndex });
  };

  const startBreak = (nextIndex: number, seconds: number) => {
    unlockAudio();
    setIndex(nextIndex);
    if (seconds <= 0) {
      setPhase({ kind: 'ready' });
      return;
    }
    setPhase({ kind: 'break', nextIndex, seconds });
  };

  const breakOver = () => {
    if (settings.autoStartNext) startBlock();
    else setPhase({ kind: 'ready', afterBreak: true });
  };

  const finishWorkout = (finalLogs: BlockLog[]) => {
    if (!routine) return;
    if (finalLogs.length === 0) {
      nav.pop();
      return;
    }
    const w: Workout = {
      id: uid('wo'),
      routineId: routine.id,
      routineName: routine.name,
      totalBlocks: blocks.length,
      startedAt: startedAt.current,
      finishedAt: Date.now(),
      blocks: finalLogs,
    };
    saveWorkout(w);
    nav.reset('history');
  };

  const exit = () => {
    if (phase.kind === 'summary') return finishWorkout(logs);
    if (logs.length === 0) return nav.pop();
    confirm(t('run.exitConfirm'), () => finishWorkout(logs), t('run.exit'), t('common.cancel'));
  };

  if (!routine || !block) {
    return (
      <Screen title="" onBack={nav.pop}>
        <Txt color={colors.muted}>—</Txt>
      </Screen>
    );
  }

  const title = t('run.blockOf', { n: index + 1, total: blocks.length });

  // ---- running ----
  if (phase.kind === 'running') {
    return (
      <Screen title={block.title || title} onBack={exit}>
        <Txt variant="small" color={colors.muted} style={{ textAlign: 'center', marginBottom: space.sm }}>
          {routine.name} · {title}
        </Txt>
        <BlockRunner
          key={phase.run}
          block={block}
          onFinish={(durationSec) => {
            setEntries(defaultEntries(block));
            setPhase({ kind: 'review', durationSec });
          }}
        />
      </Screen>
    );
  }

  // ---- review: Done / Repeat / Skip / Finish ----
  if (phase.kind === 'review') {
    return (
      <Screen title={t('run.blockFinished')} onBack={exit}>
        <Card style={{ borderColor: colors.success }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="h2">{block.title || title}</Txt>
            <Txt color={colors.muted}>{clock(phase.durationSec)}</Txt>
          </Row>
          <Txt variant="label" style={{ marginTop: space.lg, marginBottom: space.sm }}>
            {t('run.checkWhatYouDid')}
          </Txt>
          <EntryEditor entries={entries} onChange={setEntries} sets={block.format === 'sets'} />
        </Card>

        <Txt variant="label" style={{ marginTop: space.xl, marginBottom: space.sm }}>
          {t('run.whatNow')}
        </Txt>
        <View style={{ gap: space.sm }}>
          <Button
            label={`✓ ${t('run.markDone')}`}
            size="lg"
            onPress={() => {
              addLog('done', phase.durationSec, entries);
              afterBlock(index + 1, true);
            }}
          />
          <Row>
            <Button
              label={`↻ ${t('run.repeat')}`}
              variant="secondary"
              flex
              onPress={() => {
                addLog('done', phase.durationSec, entries);
                afterBlock(index, true);
              }}
            />
            <Button
              label={`⤼ ${t('run.skip')}`}
              variant="secondary"
              flex
              onPress={() => {
                addLog('skipped', phase.durationSec, []);
                afterBlock(index + 1, false);
              }}
            />
          </Row>
          <Button
            label={t('run.finishWorkout')}
            variant="ghost"
            onPress={() => {
              addLog('done', phase.durationSec, entries);
              setPhase({ kind: 'summary' });
            }}
          />
        </View>
      </Screen>
    );
  }

  // ---- pick a break: 1, 2, 3, 5 min (+ the routine's own rest) ----
  if (phase.kind === 'pickBreak') {
    const suggested = blocks[index]?.restAfterSec;
    const options = Array.from(new Set([60, 120, 180, 300, ...(suggested ? [suggested] : [])])).sort((a, b) => a - b);
    const next = blocks[phase.nextIndex];
    return (
      <Screen title={t('run.breakTitle')} onBack={exit}>
        <View style={{ gap: space.sm }}>
          {options.map((s) => {
            const isSuggested = s === suggested;
            return (
              <Button
                key={s}
                label={`${s % 60 === 0 ? `${s / 60} ${t('common.min')}` : clock(s)}${isSuggested ? `  ·  ${t('run.routineRest')}` : ''}`}
                variant={isSuggested ? 'rest' : 'secondary'}
                size="lg"
                onPress={() => startBreak(phase.nextIndex, s)}
              />
            );
          })}
          <Button label={t('run.skipBreak')} variant="ghost" onPress={() => startBreak(phase.nextIndex, 0)} />
        </View>
        {next ? (
          <Card style={{ marginTop: space.xl }}>
            <Txt variant="label" style={{ marginBottom: space.sm }}>
              {t('run.upNext')}
            </Txt>
            <BlockSummary block={next} />
          </Card>
        ) : null}
      </Screen>
    );
  }

  // ---- break countdown ----
  if (phase.kind === 'break') {
    return (
      <Screen title={t('run.rest')} onBack={exit}>
        <BreakCountdown seconds={phase.seconds} onDone={breakOver} />
        <Card style={{ marginTop: space.lg }}>
          <Txt variant="label" style={{ marginBottom: space.sm }}>
            {t('run.upNext')} · {title}
          </Txt>
          <BlockSummary block={block} />
        </Card>
      </Screen>
    );
  }

  // ---- summary ----
  if (phase.kind === 'summary') {
    const done = logs.filter((l) => l.status === 'done');
    const reps = done.reduce((s, l) => s + totalReps(l.entries), 0);
    const minutes = (Date.now() - startedAt.current) / 1000;
    return (
      <Screen
        title={t('run.summary')}
        footer={
          <Row>
            <Button
              label={t('run.discard')}
              variant="ghost"
              flex
              onPress={() => confirm(t('common.confirmDelete'), () => nav.pop(), t('run.discard'), t('common.cancel'))}
            />
            <Button label={t('run.saveWorkout')} flex onPress={() => finishWorkout(logs)} />
          </Row>
        }
      >
        <Txt variant="title" style={{ textAlign: 'center' }}>
          {routine.name}
        </Txt>
        <Row style={{ justifyContent: 'space-around', marginTop: space.xl }}>
          <Stat label={t('run.totalTime')} value={clock(minutes)} />
          <Stat label={t('run.blocksDone')} value={`${new Set(done.map((l) => l.blockId)).size}/${blocks.length}`} />
          <Stat label={t('run.totalReps')} value={String(reps)} />
        </Row>
        <View style={{ gap: space.sm, marginTop: space.xl }}>
          {blocks.map((b, i) => (
            <BlockStatusRow key={b.id} index={i} block={b} status={statusOf(b)} />
          ))}
        </View>
      </Screen>
    );
  }

  // ---- ready: waiting for Start ----
  return (
    <Screen
      title={routine.name}
      onBack={exit}
      footer={
        <View style={{ gap: space.sm }}>
          <Button label={`▶ ${t('common.start')}`} size="lg" onPress={startBlock} />
          <Row>
            <Button
              label={`⤼ ${t('run.skip')}`}
              variant="ghost"
              flex
              onPress={() => {
                addLog('skipped', 0, []);
                afterBlock(index + 1, false);
              }}
            />
            <Button label={t('run.finishWorkout')} variant="ghost" flex onPress={() => setPhase({ kind: 'summary' })} />
          </Row>
        </View>
      }
    >
      {phase.afterBreak ? (
        <Card style={{ borderColor: colors.rest, marginBottom: space.lg, alignItems: 'center' }}>
          <Txt variant="h2" color={colors.rest}>
            {t('run.breakOver')}
          </Txt>
        </Card>
      ) : null}
      <Txt variant="label">{title}</Txt>
      <Card style={{ marginTop: space.sm, borderColor: colors.accent }}>
        <BlockSummary block={block} />
      </Card>
      <Txt variant="small" color={colors.muted} style={{ textAlign: 'center', marginTop: space.md }}>
        {t('run.tapToStart')}
      </Txt>
      <View style={{ gap: space.sm, marginTop: space.xl }}>
        {blocks.map((b, i) => (
          <BlockStatusRow key={b.id} index={i} block={b} status={statusOf(b)} current={i === index} />
        ))}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Txt variant="title" color={colors.accent}>
        {value}
      </Txt>
      <Txt variant="small" color={colors.muted}>
        {label}
      </Txt>
    </View>
  );
}

function BlockStatusRow({ block, index, status, current }: { block: Block; index: number; status: 'done' | 'skipped' | 'todo'; current?: boolean }) {
  const t = useT();
  const color = status === 'done' ? colors.success : status === 'skipped' ? colors.warn : colors.surface2;
  const textColor = status === 'todo' ? colors.muted : colors.accentText;
  return (
    <Row
      style={{
        justifyContent: 'space-between',
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: current ? colors.surface2 : colors.surface,
        borderWidth: 1,
        borderColor: current ? colors.accent : colors.border,
      }}
    >
      <Txt numberOfLines={1} style={{ flex: 1 }}>
        {index + 1}. {block.title || block.format.toUpperCase()}
      </Txt>
      <Badge label={t(`run.status.${status}`)} color={color} textColor={textColor} />
    </Row>
  );
}

function EntryEditor({ entries, onChange, sets }: { entries: LogEntry[]; onChange: (e: LogEntry[]) => void; sets: boolean }) {
  const t = useT();
  const { exerciseById } = useApp();
  const update = (i: number, patch: Partial<LogEntry>) => onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <View style={{ gap: space.md }}>
      {entries.map((e, i) => {
        const ex = exerciseById(e.exerciseId);
        return (
          <View key={i} style={{ gap: 6, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Txt style={{ fontWeight: '700' }}>{ex?.name ?? '?'}</Txt>
            <Row gap={space.md} style={{ flexWrap: 'wrap' }}>
              <NumberField label={sets ? t('run.setsDone') : t('run.roundsDone')} value={e.rounds} width={44} onChange={(v) => update(i, { rounds: v ?? 0 })} />
              {ex?.kind === 'reps' ? <NumberField label={t('block.reps')} value={e.reps} width={48} allowEmpty onChange={(v) => update(i, { reps: v })} /> : null}
              {ex?.kind === 'hold' || e.seconds != null ? (
                <NumberField label={t('block.seconds')} value={e.seconds} width={48} allowEmpty step={5} onChange={(v) => update(i, { seconds: v })} />
              ) : null}
              {ex?.kind === 'distance' ? <NumberField label={t('block.meters')} value={e.meters} width={56} allowEmpty step={50} onChange={(v) => update(i, { meters: v })} /> : null}
              {ex?.kind === 'calories' ? <NumberField label={t('block.calories')} value={e.calories} width={48} allowEmpty onChange={(v) => update(i, { calories: v })} /> : null}
              <NumberField label={t('block.weight')} value={e.weightKg} width={44} allowEmpty step={5} onChange={(v) => update(i, { weightKg: v || undefined })} />
            </Row>
          </View>
        );
      })}
    </View>
  );
}

function BreakCountdown({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const t = useT();
  const { settings } = useApp();
  const c = useClock(100);
  const [dur, setDur] = useState(seconds);
  const lastTick = useRef('');
  const fired = useRef(false);

  useEffect(() => {
    c.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = dur - c.elapsedMs / 1000;

  useEffect(() => {
    if (remaining <= 0) {
      if (!fired.current) {
        fired.current = true;
        if (settings.endSound) sounds.end(settings.vibration);
        onDone();
      }
      return;
    }
    const whole = Math.ceil(remaining);
    if (settings.lastBeepsSec > 0 && whole <= settings.lastBeepsSec && `${whole}` !== lastTick.current) {
      lastTick.current = `${whole}`;
      sounds.tick(settings.vibration);
    }
  });

  const progress = useMemo(() => Math.max(0, Math.min(1, 1 - remaining / Math.max(1, dur))), [remaining, dur]);

  return (
    <View>
      <View style={{ height: 6, backgroundColor: colors.surface2, borderRadius: radius.pill, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${progress * 100}%`, backgroundColor: colors.rest }} />
      </View>
      <View style={{ alignItems: 'center', paddingVertical: space.lg }}>
        <Txt variant="label" color={colors.rest}>
          {t('run.rest')}
        </Txt>
        <Txt style={{ fontSize: 96, fontWeight: '900', color: colors.rest, lineHeight: 108, fontVariant: ['tabular-nums'] }}>{clock(Math.max(0, remaining))}</Txt>
      </View>
      <Row>
        <Button label={t('run.plus15')} variant="secondary" size="lg" flex onPress={() => setDur((d) => d + 15)} />
        <Button label={c.running ? t('common.pause') : t('common.resume')} variant="secondary" size="lg" flex onPress={() => (c.running ? c.pause() : c.start())} />
        <Button
          label={t('run.skipRest')}
          variant="rest"
          size="lg"
          flex
          onPress={() => {
            fired.current = true;
            onDone();
          }}
        />
      </Row>
    </View>
  );
}
