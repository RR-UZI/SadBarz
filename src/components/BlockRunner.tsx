// Runs one block with its timer: EMOM / interval, Tabata, sets with rest, circuit or AMRAP.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { useT } from '../i18n';
import { buildTimeline, capLabel, DEFAULT_AMRAP_SEC, flattenSets, itemTarget, itemsForRound, segmentAt, timelineLength } from '../lib/blocks';
import { sounds, speak, unlockAudio } from '../lib/sound';
import { useClock } from '../lib/useClock';
import { clock } from '../lib/util';
import { useApp } from '../store/AppStore';
import { colors, radius, space } from '../theme';
import type { AmrapScore, Block, BlockItem, Settings } from '../types';
import { Button, NumberField, Row, Txt } from './ui';

type Props = { block: Block; onFinish: (durationSec: number, score?: AmrapScore) => void };

// The lead-in counts down silently and beeps only on its last seconds (3, 2, 1).
const LEAD_BEEPS = 3;

export function BlockRunner(props: Props) {
  if (props.block.format === 'sets') return <SetsRunner {...props} />;
  if (props.block.format === 'circuit') return <CircuitRunner {...props} />;
  if (props.block.format === 'amrap') return <AmrapRunner {...props} />;
  return <TimedRunner {...props} />;
}

// ---------- shared pieces ----------

function useCues(settings: Settings) {
  const t = useT();
  return useMemo(
    () => ({
      tick: () => sounds.tick(settings.vibration),
      start: () => {
        if (settings.startSound) sounds.start(settings.vibration);
        if (settings.voice) speak(t('voice.go'), settings.language);
      },
      round: (n: number) => {
        if (settings.roundSound) sounds.round(settings.vibration);
        if (settings.voice) speak(t('voice.round', { n }), settings.language);
      },
      rest: () => {
        if (settings.roundSound) sounds.rest(settings.vibration);
        if (settings.voice) speak(t('voice.rest'), settings.language);
      },
      end: () => {
        if (settings.endSound) sounds.end(settings.vibration);
        if (settings.voice) speak(t('voice.done'), settings.language);
      },
      say: (text: string) => {
        if (settings.voice) speak(text, settings.language);
      },
    }),
    [settings, t],
  );
}

function BigClock({ seconds, color, label, sub }: { seconds: number; color: string; label: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.lg }}>
      <Txt variant="label" color={color}>
        {label}
      </Txt>
      <Txt style={{ fontSize: 96, fontWeight: '900', color, fontVariant: ['tabular-nums'], lineHeight: 108 }}>{clock(seconds)}</Txt>
      {sub ? (
        <Txt variant="h2" color={colors.text}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={{ height: 6, backgroundColor: colors.surface2, borderRadius: radius.pill, overflow: 'hidden' }}>
      <View style={{ height: 6, width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: color }} />
    </View>
  );
}

function ItemLines({ items, big, dim }: { items: BlockItem[]; big?: boolean; dim?: boolean }) {
  const t = useT();
  const { exerciseById } = useApp();
  return (
    <View style={{ gap: big ? 6 : 2, alignItems: 'center' }}>
      {items.map((it) => (
        <Txt
          key={it.id}
          style={{ fontSize: big ? 26 : 15, fontWeight: big ? '800' : '600', textAlign: 'center' }}
          color={dim ? colors.muted : colors.text}
        >
          {itemTarget(it, t('run.max'))} {exerciseById(it.exerciseId)?.name ?? '?'}
          {it.weightKg ? <Txt style={{ fontSize: big ? 26 : 15, fontWeight: '800' }} color={colors.accent}>{` +${it.weightKg}kg`}</Txt> : null}
          {it.note ? <Txt style={{ fontSize: big ? 16 : 13 }} color={colors.muted}>{`  (${it.note})`}</Txt> : null}
        </Txt>
      ))}
    </View>
  );
}

function Controls({ running, onToggle, onFinish }: { running: boolean; onToggle: () => void; onFinish: () => void }) {
  const t = useT();
  return (
    <Row style={{ marginTop: space.xl }}>
      <Button label={running ? t('common.pause') : t('common.resume')} variant="secondary" size="lg" onPress={onToggle} flex />
      <Button label={t('run.finishBlock')} variant="ghost" size="lg" onPress={onFinish} flex />
    </Row>
  );
}

// ---------- EMOM / interval and Tabata ----------

function TimedRunner({ block, onFinish }: Props) {
  const t = useT();
  const { settings } = useApp();
  const cues = useCues(settings);
  const c = useClock(100);
  const segs = useMemo(() => buildTimeline(block, settings.leadInSec), [block, settings.leadInSec]);
  const total = timelineLength(segs);
  const leadIn = settings.leadInSec;

  const tSec = c.elapsedMs / 1000;
  const idx = segmentAt(segs, tSec);
  const finished = idx >= segs.length;
  const seg = segs[Math.min(idx, segs.length - 1)];
  const remaining = finished ? 0 : seg.start + seg.duration - tSec;

  const lastIdx = useRef(-1);
  const lastTick = useRef('');
  const done = useRef(false);

  useEffect(() => {
    unlockAudio();
    c.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (finished) {
      if (!done.current) {
        done.current = true;
        cues.end();
        onFinish(Math.max(0, Math.round(total - leadIn)));
      }
      return;
    }
    if (idx !== lastIdx.current) {
      const prev = lastIdx.current;
      lastIdx.current = idx;
      if (seg.kind === 'work') {
        if (seg.round === 1 && (prev === -1 || segs[prev]?.kind === 'leadin')) cues.start();
        else cues.round(seg.round);
      } else if (seg.kind === 'rest') {
        cues.rest();
      }
    }
    const whole = Math.ceil(remaining);
    const key = `${idx}:${whole}`;
    const inWindow = seg.kind === 'leadin' ? whole <= Math.min(LEAD_BEEPS, seg.duration) : whole < seg.duration;
    if (key !== lastTick.current && whole > 0 && inWindow) {
      lastTick.current = key;
      if (seg.kind === 'leadin') cues.tick();
      else if (settings.lastBeepsSec > 0 && whole <= settings.lastBeepsSec) cues.tick();
      else if (seg.kind === 'work' && whole === 10 && seg.duration >= 30) cues.say(t('voice.seconds', { n: 10 }));
    }
  });

  if (finished) return <BigClock seconds={0} color={colors.success} label={t('run.blockFinished')} />;

  const roundItems = itemsForRound(block, Math.max(1, seg.round));
  const nextRound = seg.kind === 'leadin' ? 1 : seg.round + 1;
  const nextItems = nextRound <= block.rounds ? itemsForRound(block, nextRound) : [];
  const color = seg.kind === 'work' ? colors.accent : seg.kind === 'rest' ? colors.rest : colors.warn;
  const label = seg.kind === 'work' ? t('run.work') : seg.kind === 'rest' ? t('run.rest') : t('run.getReady');
  const workElapsed = Math.max(0, tSec - leadIn);

  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="small" color={colors.muted}>
          {seg.kind === 'leadin' ? ' ' : t('run.roundOf', { n: seg.round, total: block.rounds })}
        </Txt>
        <Txt variant="small" color={colors.muted}>
          {clock(workElapsed)} / {clock(total - leadIn)}
        </Txt>
      </Row>
      <View style={{ marginTop: space.sm }}>
        <ProgressBar value={workElapsed / Math.max(1, total - leadIn)} color={color} />
      </View>
      <BigClock seconds={remaining} color={color} label={label} />
      {seg.kind !== 'rest' ? <ItemLines items={roundItems} big /> : null}
      {nextItems.length > 0 && (seg.kind !== 'work' || block.perRound === 'rotate') ? (
        <View style={{ marginTop: space.lg, alignItems: 'center', gap: 4 }}>
          <Txt variant="label">{t('run.next')}</Txt>
          <ItemLines items={nextItems} dim />
        </View>
      ) : null}
      <Controls running={c.running} onToggle={() => (c.running ? c.pause() : c.start())} onFinish={() => onFinish(Math.round(workElapsed))} />
    </View>
  );
}

// ---------- Sets with rest ----------

function SetsRunner({ block, onFinish }: Props) {
  const t = useT();
  const { settings } = useApp();
  const cues = useCues(settings);
  const flat = useMemo(() => flattenSets(block), [block]);
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<'leadin' | 'work' | 'rest'>(settings.leadInSec > 0 ? 'leadin' : 'work');
  const [restDur, setRestDur] = useState(0);
  const phase = useClock(100); // current lead-in / set / rest
  const total = useClock(500); // whole block
  const lastTick = useRef('');
  const startedCue = useRef(false);

  useEffect(() => {
    unlockAudio();
    phase.start();
    total.start();
    if (settings.leadInSec === 0) {
      startedCue.current = true;
      cues.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sec = phase.elapsedMs / 1000;
  const leadRemaining = settings.leadInSec - sec;
  const restRemaining = restDur - sec;

  const finishBlock = () => {
    cues.end();
    onFinish(Math.round(total.elapsedMs / 1000));
  };

  const goWork = (next: number) => {
    setI(next);
    setMode('work');
    phase.reset(0, true);
  };

  useEffect(() => {
    if (mode === 'leadin') {
      if (leadRemaining <= 0) {
        if (!startedCue.current) {
          startedCue.current = true;
          cues.start();
        }
        setMode('work');
        phase.reset(0, true);
        return;
      }
      const whole = Math.ceil(leadRemaining);
      if (`l${whole}` !== lastTick.current && whole <= Math.min(LEAD_BEEPS, settings.leadInSec)) {
        lastTick.current = `l${whole}`;
        cues.tick();
      }
    }
    if (mode === 'rest') {
      if (restRemaining <= 0) {
        cues.round(flat[i + 1]?.index ?? i + 2);
        goWork(i + 1);
        return;
      }
      const whole = Math.ceil(restRemaining);
      if (`r${i}:${whole}` !== lastTick.current && settings.lastBeepsSec > 0 && whole <= settings.lastBeepsSec) {
        lastTick.current = `r${i}:${whole}`;
        cues.tick();
      }
    }
  });

  const current = flat[i];
  if (!current) return null;
  const isLast = i === flat.length - 1;

  const setDone = () => {
    if (isLast) return finishBlock();
    if (current.restSec > 0) {
      cues.rest();
      setRestDur(current.restSec);
      setMode('rest');
      phase.reset(0, true);
    } else {
      cues.round(current.index + 1);
      goWork(i + 1);
    }
  };

  const togglePause = () => {
    if (phase.running) {
      phase.pause();
      total.pause();
    } else {
      phase.start();
      total.start();
    }
  };

  const header = (
    <Row style={{ justifyContent: 'space-between' }}>
      <Txt variant="small" color={colors.muted}>
        {t('run.setOf', { n: current.index, total: flat.length })}
      </Txt>
      <Txt variant="small" color={colors.muted}>
        {clock(total.elapsedMs / 1000)}
      </Txt>
    </Row>
  );

  if (mode === 'leadin') {
    return (
      <View>
        {header}
        <BigClock seconds={leadRemaining} color={colors.warn} label={t('run.getReady')} />
        <ItemLines items={current.items} big />
      </View>
    );
  }

  if (mode === 'rest') {
    const next = flat[i + 1];
    return (
      <View>
        {header}
        <View style={{ marginTop: space.sm }}>
          <ProgressBar value={1 - restRemaining / Math.max(1, restDur)} color={colors.rest} />
        </View>
        <BigClock seconds={restRemaining} color={colors.rest} label={t('run.rest')} />
        {next ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Txt variant="label">
              {t('run.next')} · {t('run.setOf', { n: next.index, total: flat.length })}
            </Txt>
            <ItemLines items={next.items} dim />
          </View>
        ) : null}
        <Row style={{ marginTop: space.xl }}>
          <Button label={t('run.plus15')} variant="secondary" size="lg" onPress={() => setRestDur((d) => d + 15)} flex />
          <Button
            label={t('run.skipRest')}
            variant="rest"
            size="lg"
            flex
            onPress={() => {
              cues.round(next?.index ?? 0);
              goWork(i + 1);
            }}
          />
        </Row>
      </View>
    );
  }

  return (
    <View>
      {header}
      <View style={{ marginTop: space.sm }}>
        <ProgressBar value={(current.index - 1) / flat.length} color={colors.accent} />
      </View>
      <BigClock seconds={sec} color={colors.accent} label={t('run.work')} sub={`${t('common.set')} ${current.setInRow}/${current.setsInRow}`} />
      <ItemLines items={current.items} big />
      <Button label={t('run.setDone')} size="lg" style={{ marginTop: space.xl }} onPress={setDone} />
      <Controls running={phase.running} onToggle={togglePause} onFinish={finishBlock} />
    </View>
  );
}

// ---------- Circuit (stopwatch + rounds) ----------

// Seconds counted down before the next round starts, once the athlete says they are ready.
const NEXT_ROUND_COUNTDOWN = 3;

function CircuitRunner({ block, onFinish }: Props) {
  const t = useT();
  const { settings } = useApp();
  const cues = useCues(settings);
  const c = useClock(100);
  const [round, setRound] = useState(1);
  // Each finished round's own time; the break between rounds is not counted in it.
  const [roundTimes, setRoundTimes] = useState<number[]>([]);
  const [roundStart, setRoundStart] = useState(0);
  // 'rest': a round was just finished and we wait for "start next round".
  // 'countdown': 3, 2, 1 before the next round's stopwatch starts.
  const [phase, setPhase] = useState<'work' | 'rest' | 'countdown'>('work');
  const [phaseStart, setPhaseStart] = useState(0);
  const lastTick = useRef('');
  const started = useRef(false);

  useEffect(() => {
    unlockAudio();
    c.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sec = c.elapsedMs / 1000;
  const lead = settings.leadInSec - sec;
  const workSec = Math.max(0, sec - settings.leadInSec);
  const roundSec = workSec - roundStart;
  const countdown = NEXT_ROUND_COUNTDOWN - (workSec - phaseStart);
  const isLast = round >= block.rounds;

  useEffect(() => {
    if (lead > 0) {
      const whole = Math.ceil(lead);
      if (`l${whole}` !== lastTick.current && whole <= Math.min(LEAD_BEEPS, settings.leadInSec)) {
        lastTick.current = `l${whole}`;
        cues.tick();
      }
    } else if (!started.current) {
      started.current = true;
      cues.start();
    } else if (phase === 'countdown') {
      if (countdown > 0) {
        const whole = Math.ceil(countdown);
        if (`r${round}:${whole}` !== lastTick.current) {
          lastTick.current = `r${round}:${whole}`;
          cues.tick();
        }
      } else {
        setPhase('work');
        setRoundStart(workSec);
        cues.round(round);
      }
    }
  });

  const roundDone = () => {
    if (isLast) {
      cues.end();
      onFinish(Math.round(workSec));
      return;
    }
    cues.rest();
    setRoundTimes([...roundTimes, roundSec]);
    setRound(round + 1);
    setPhase('rest');
    setPhaseStart(workSec);
  };

  const startNext = () => {
    unlockAudio();
    if (!c.running) c.start();
    setPhase('countdown');
    setPhaseStart(workSec);
  };

  const lastTime = roundTimes[roundTimes.length - 1] ?? 0;

  return (
    <View>
      {block.rounds > 1 ? <RoundDots total={block.rounds} done={round - 1} /> : null}
      {lead > 0 ? (
        <BigClock seconds={lead} color={colors.warn} label={t('run.getReady')} />
      ) : phase === 'rest' ? (
        <View accessibilityRole="alert" style={{ alignItems: 'center', paddingVertical: space.lg, gap: 6 }}>
          <View style={{ backgroundColor: colors.success, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 6 }}>
            <Txt style={{ fontWeight: '800', fontSize: 18 }} color={colors.accentText}>
              {t('run.roundComplete', { n: round - 1 })}
            </Txt>
          </View>
          <Txt style={{ fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] }} color={colors.success}>
            {clock(lastTime)}
          </Txt>
          <Txt variant="small" color={colors.muted}>
            {`${t('run.restTime')} ${clock(workSec - phaseStart)}`}
          </Txt>
          <Txt variant="h2" style={{ textAlign: 'center', marginTop: space.sm }}>
            {t('run.readyNext', { n: round, total: block.rounds })}
          </Txt>
        </View>
      ) : phase === 'countdown' ? (
        <View accessibilityRole="alert" style={{ alignItems: 'center', paddingVertical: space.lg }}>
          <Txt variant="label" color={colors.warn}>
            {t('run.startsIn', { n: round })}
          </Txt>
          <Txt style={{ fontSize: 140, fontWeight: '900', color: colors.warn, fontVariant: ['tabular-nums'], lineHeight: 156 }}>
            {Math.max(1, Math.ceil(countdown))}
          </Txt>
        </View>
      ) : (
        <View>
          {block.rounds > 1 ? (
            <Txt variant="title" color={colors.accent} style={{ textAlign: 'center', marginTop: space.md }}>
              {t('run.roundOf', { n: round, total: block.rounds })}
            </Txt>
          ) : null}
          <BigClock
            seconds={roundSec}
            color={colors.accent}
            label={t('run.stopwatch')}
            sub={roundTimes.length ? `${t('run.total')} ${clock(workSec)}` : undefined}
          />
        </View>
      )}
      <ItemLines items={block.items} big={block.items.length <= 3} dim={phase !== 'work'} />
      {roundTimes.length ? (
        <Row style={{ justifyContent: 'center', flexWrap: 'wrap', marginTop: space.md }} gap={space.md}>
          {roundTimes.map((time, i) => (
            <Txt key={i} variant="small" color={colors.muted}>
              {`R${i + 1} ${clock(time)}`}
            </Txt>
          ))}
        </Row>
      ) : null}
      {phase === 'rest' ? (
        <Button label={t('run.startRound', { n: round })} size="lg" style={{ marginTop: space.xl }} onPress={startNext} />
      ) : (
        <Button
          label={block.rounds > 1 ? (isLast ? t('run.lastRoundDone') : t('run.roundDoneOf', { n: round, total: block.rounds })) : t('run.roundDone')}
          size="lg"
          style={{ marginTop: space.xl }}
          onPress={roundDone}
          disabled={lead > 0 || phase === 'countdown'}
        />
      )}
      <Controls running={c.running} onToggle={() => (c.running ? c.pause() : c.start())} onFinish={() => onFinish(Math.round(workSec))} />
    </View>
  );
}

// ---------- AMRAP ----------

// Beeps on the last seconds of the time cap, and the clock turns orange for the final stretch.
const AMRAP_FINAL_SEC = 10;

function AmrapRunner({ block, onFinish }: Props) {
  const t = useT();
  const { settings } = useApp();
  const cues = useCues(settings);
  const c = useClock(100);
  const cap = block.capSec ?? DEFAULT_AMRAP_SEC;
  // Time on the clock when each round was finished.
  const [splits, setSplits] = useState<number[]>([]);
  const [over, setOver] = useState(false);
  const [extraReps, setExtraReps] = useState(0);
  const lastTick = useRef('');
  const started = useRef(false);

  useEffect(() => {
    unlockAudio();
    c.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sec = c.elapsedMs / 1000;
  const lead = settings.leadInSec - sec;
  const workSec = Math.min(cap, Math.max(0, sec - settings.leadInSec));
  const left = cap - workSec;
  const rounds = splits.length;

  const stop = () => {
    c.pause();
    setOver(true);
  };

  useEffect(() => {
    if (over) return;
    if (lead > 0) {
      const whole = Math.ceil(lead);
      if (`l${whole}` !== lastTick.current && whole <= Math.min(LEAD_BEEPS, settings.leadInSec)) {
        lastTick.current = `l${whole}`;
        cues.tick();
      }
      return;
    }
    if (!started.current) {
      started.current = true;
      cues.start();
    }
    if (left <= 0) {
      cues.end();
      stop();
      return;
    }
    const whole = Math.ceil(left);
    if (whole <= LEAD_BEEPS && `e${whole}` !== lastTick.current) {
      lastTick.current = `e${whole}`;
      cues.tick();
    }
  });

  const addRound = () => {
    if (settings.roundSound) sounds.round(settings.vibration);
    setSplits([...splits, workSec]);
  };

  if (over) {
    return (
      <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
        <Txt variant="title" color={colors.success}>
          {t('run.timeUp')}
        </Txt>
        <Txt style={{ fontSize: 96, fontWeight: '900', lineHeight: 108, fontVariant: ['tabular-nums'] }} color={colors.accent}>
          {rounds}
        </Txt>
        <Txt variant="h2">{t('run.amrapRounds', { n: rounds })}</Txt>
        <View style={{ marginTop: space.md }}>
          <NumberField label={t('run.extraReps')} value={extraReps} min={0} max={999} width={80} onChange={(v) => setExtraReps(v ?? 0)} />
        </View>
        <Txt variant="h2" color={colors.accent} style={{ marginTop: space.sm }}>
          {t('run.score', { rounds, reps: extraReps })}
        </Txt>
        <Button
          label={t('run.saveScore')}
          size="lg"
          style={{ marginTop: space.lg, alignSelf: 'stretch' }}
          onPress={() => onFinish(Math.round(workSec), { rounds, reps: extraReps })}
        />
      </View>
    );
  }

  const final = lead <= 0 && left <= AMRAP_FINAL_SEC;
  return (
    <View>
      <Txt variant="label" color={colors.muted} style={{ textAlign: 'center' }}>
        {`AMRAP ${capLabel(cap)}`}
      </Txt>
      {lead > 0 ? (
        <BigClock seconds={lead} color={colors.warn} label={t('run.getReady')} />
      ) : (
        <BigClock seconds={left} color={final ? colors.warn : colors.accent} label={t('run.timeLeft')} />
      )}
      <View style={{ alignItems: 'center', marginBottom: space.md }}>
        <Txt variant="label" color={colors.muted}>
          {t('run.fullRounds')}
        </Txt>
        <Txt style={{ fontSize: 56, fontWeight: '900', lineHeight: 64, fontVariant: ['tabular-nums'] }}>{rounds}</Txt>
      </View>
      <ItemLines items={block.items} big={block.items.length <= 3} />
      {splits.length ? (
        <Row style={{ justifyContent: 'center', flexWrap: 'wrap', marginTop: space.md }} gap={space.md}>
          {splits.map((end, i) => (
            <Txt key={i} variant="small" color={colors.muted}>
              {`R${i + 1} ${clock(end - (i ? splits[i - 1] : 0))}`}
            </Txt>
          ))}
        </Row>
      ) : null}
      <Button label={t('run.addRound')} size="lg" style={{ marginTop: space.xl, minHeight: 72 }} onPress={addRound} disabled={lead > 0} />
      {rounds > 0 ? (
        <Button label={t('run.undoRound')} variant="ghost" size="sm" style={{ marginTop: space.sm, alignSelf: 'center' }} onPress={() => setSplits(splits.slice(0, -1))} />
      ) : null}
      <Controls running={c.running} onToggle={() => (c.running ? c.pause() : c.start())} onFinish={stop} />
    </View>
  );
}

// One dot per round: done rounds filled with a check, the current one outlined.
function RoundDots({ total, done }: { total: number; done: number }) {
  return (
    <Row style={{ justifyContent: 'center', flexWrap: 'wrap' }} gap={space.sm}>
      {Array.from({ length: total }, (_, i) => {
        const isDone = i < done;
        const current = i === done;
        return (
          <View
            key={i}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: isDone ? colors.success : current ? colors.accent : colors.border,
              backgroundColor: isDone ? colors.success : 'transparent',
            }}
          >
            <Txt style={{ fontWeight: '800', fontSize: 15 }} color={isDone ? colors.accentText : current ? colors.accent : colors.faint}>
              {isDone ? '✓' : i + 1}
            </Txt>
          </View>
        );
      })}
    </Row>
  );
}
