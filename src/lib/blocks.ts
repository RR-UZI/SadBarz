// Helpers to create, describe and time blocks.
import type { StringKey } from '../i18n/es';
import type { Block, BlockFormat, BlockItem, Exercise, ForTimeScore, LogEntry, SetRow } from '../types';
import { clock, shortDuration, uid } from './util';

export const DEFAULT_AMRAP_SEC = 600;
export const DEFAULT_FORTIME_SEC = 900;

export function newItem(exerciseId: string, kind: Exercise['kind'] = 'reps'): BlockItem {
  const item: BlockItem = { id: uid('it'), exerciseId };
  if (kind === 'reps') item.reps = 10;
  if (kind === 'hold') item.seconds = 20;
  if (kind === 'distance') item.meters = 200;
  if (kind === 'calories') item.calories = 6;
  return item;
}

export function newRow(): SetRow {
  return { id: uid('row'), sets: 3, items: [], restSec: 90 };
}

export function newBlock(format: BlockFormat = 'emom'): Block {
  return {
    id: uid('bl'),
    format,
    items: [],
    rows: format === 'sets' ? [newRow()] : [],
    intervalSec: 60,
    rounds: format === 'tabata' ? 8 : format === 'circuit' ? 3 : format === 'fortime' ? 1 : 10,
    perRound: 'all',
    workSec: 20,
    restSec: 10,
    ...(format === 'amrap' ? { capSec: DEFAULT_AMRAP_SEC } : format === 'fortime' ? { capSec: DEFAULT_FORTIME_SEC } : {}),
  };
}

export function blockDurationSec(b: Block): number {
  switch (b.format) {
    case 'emom':
      return b.intervalSec * b.rounds;
    case 'tabata':
      return (b.workSec + b.restSec) * b.rounds - b.restSec;
    case 'sets':
      return b.rows.reduce((sum, r) => sum + r.sets * (45 + r.restSec), 0); // rough estimate
    case 'circuit':
      return 0;
    case 'amrap':
      return b.capSec ?? DEFAULT_AMRAP_SEC;
    case 'fortime':
      return b.capSec ?? DEFAULT_FORTIME_SEC;
  }
}

// Short label like 'EMOM 50" · 12 rondas' or 'EM2M · 6 rondas'.
export function formatLabel(b: Block, roundsWord: string, setsWord: string, capWord: string): string {
  switch (b.format) {
    case 'emom': {
      const name = b.intervalSec === 60 ? 'EMOM' : b.intervalSec === 120 ? 'EM2M' : `EMOM ${shortDuration(b.intervalSec)}`;
      return `${name} · ${b.rounds} ${roundsWord}`;
    }
    case 'tabata':
      return `Tabata ${shortDuration(b.workSec)} x ${shortDuration(b.restSec)} · ${b.rounds} ${roundsWord}`;
    case 'sets':
      return `${b.rows.reduce((n, r) => n + r.sets, 0)} ${setsWord}`;
    case 'circuit':
      return `Circuito · ${b.rounds} ${roundsWord}`;
    case 'amrap':
      return `AMRAP ${capLabel(b.capSec ?? DEFAULT_AMRAP_SEC)}`;
    case 'fortime':
      return `${b.rounds > 1 ? `${b.rounds} ${roundsWord} ` : ''}For time · ${capWord} ${capLabel(b.capSec ?? DEFAULT_FORTIME_SEC)}`;
  }
}

// '12 min', or '7:30' when the cap is not whole minutes.
export function capLabel(sec: number): string {
  return sec % 60 === 0 ? `${sec / 60} min` : clock(sec);
}

// '12:34', or the rounds and reps done when the cap was reached ('tope · 2 rondas + 15 reps').
export function forTimeText(t: (key: StringKey, vars?: Record<string, string | number>) => string, s: ForTimeScore): string {
  if (s.timeSec != null) return t('run.forTimeDone', { time: clock(s.timeSec) });
  if (s.rounds > 0) return t('run.forTimeCappedRounds', { rounds: s.rounds, reps: s.reps ?? 0 });
  return t('run.forTimeCapped', { reps: s.reps ?? 0 });
}

// Alternating blocks take turns: one item per round, or several items that share a `turn`.
// Returns the turn index (0-based) of each item.
export function itemTurns(b: Block): number[] {
  const keys: (number | string)[] = [];
  return b.items.map((it, i) => {
    const key = it.turn ?? `item${i}`;
    if (!keys.includes(key)) keys.push(key);
    return keys.indexOf(key);
  });
}

function turnCount(b: Block) {
  return new Set(itemTurns(b)).size;
}

// Alternating blocks: put item i in the same round as the item above it (on), or give it its own round (off).
// The item's whole group moves with it. Turns come back numbered 1, 2, 3... in the order they appear.
export function setSameRound(b: Block, i: number, on: boolean): BlockItem[] {
  const turns = itemTurns(b);
  const next = [...turns];
  if (on && i > 0) {
    const from = turns[i];
    for (let j = 0; j < next.length; j++) if (turns[j] === from) next[j] = turns[i - 1];
  } else if (!on) {
    // this item and the ones right below it in the same round start a new round
    const fresh = Math.max(...turns) + 1;
    for (let j = i; j < next.length && turns[j] === turns[i]; j++) next[j] = fresh;
  }
  const order: number[] = [];
  next.forEach((n) => {
    if (!order.includes(n)) order.push(n);
  });
  return b.items.map((it, j) => ({ ...it, turn: order.indexOf(next[j]) + 1 }));
}

// Which items are done in a given round (1-based) of an emom/tabata block.
export function itemsForRound(b: Block, round: number): BlockItem[] {
  if (b.items.length === 0) return [];
  if (b.perRound === 'rotate') {
    const turns = itemTurns(b);
    const turn = (round - 1) % turnCount(b);
    return b.items.filter((_, i) => turns[i] === turn);
  }
  return b.items;
}

export function itemTarget(item: BlockItem, maxWord: string): string {
  const parts: string[] = [];
  if (item.max) parts.push(maxWord);
  else if (item.reps != null) parts.push(String(item.reps));
  if (item.seconds != null) parts.push(`${item.seconds}"`);
  if (item.meters != null) parts.push(`${item.meters} m`);
  if (item.calories != null) parts.push(`${item.calories} cal`);
  return parts.join(' ');
}

// Pre-filled log entries for a finished block: what the plan said, all rounds done.
// For an AMRAP or an unfinished For time, `roundsDone` is how many full rounds were finished.
export function defaultEntries(b: Block, roundsDone?: number): LogEntry[] {
  const fromItem = (it: BlockItem, rounds: number): LogEntry => ({
    exerciseId: it.exerciseId,
    rounds,
    reps: it.reps,
    seconds: it.seconds,
    meters: it.meters,
    calories: it.calories,
    weightKg: it.weightKg,
  });
  if (b.format === 'amrap') {
    return b.items.map((it) => fromItem(it, roundsDone ?? 0));
  }
  if (b.format === 'fortime') {
    return b.items.map((it) => fromItem(it, roundsDone ?? b.rounds));
  }
  if (b.format === 'sets') {
    return b.rows.flatMap((r) => r.items.map((it) => fromItem(it, r.sets)));
  }
  if (b.perRound === 'rotate' && b.items.length > 0) {
    const turns = itemTurns(b);
    const n = turnCount(b);
    return b.items.map((it, i) => {
      // how many rounds land on this item's turn when turns alternate
      const rounds = Math.floor(b.rounds / n) + (turns[i] < b.rounds % n ? 1 : 0);
      return fromItem(it, rounds);
    });
  }
  return b.items.map((it) => fromItem(it, b.rounds));
}

export function totalReps(entries: LogEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.reps ?? 0) * e.rounds, 0);
}

// ---- Timeline for timed blocks (emom, tabata) ----

export type SegmentKind = 'leadin' | 'work' | 'rest';

export interface Segment {
  kind: SegmentKind;
  start: number; // seconds from block start
  duration: number;
  round: number; // 1-based, 0 for lead-in
}

export function buildTimeline(b: Block, leadInSec: number): Segment[] {
  const segs: Segment[] = [];
  let t = 0;
  if (leadInSec > 0) {
    segs.push({ kind: 'leadin', start: 0, duration: leadInSec, round: 0 });
    t = leadInSec;
  }
  for (let r = 1; r <= b.rounds; r++) {
    if (b.format === 'emom') {
      segs.push({ kind: 'work', start: t, duration: b.intervalSec, round: r });
      t += b.intervalSec;
    } else {
      segs.push({ kind: 'work', start: t, duration: b.workSec, round: r });
      t += b.workSec;
      if (r < b.rounds && b.restSec > 0) {
        segs.push({ kind: 'rest', start: t, duration: b.restSec, round: r });
        t += b.restSec;
      }
    }
  }
  return segs;
}

export function timelineLength(segs: Segment[]) {
  const last = segs[segs.length - 1];
  return last ? last.start + last.duration : 0;
}

export function segmentAt(segs: Segment[], t: number): number {
  for (let i = 0; i < segs.length; i++) {
    if (t < segs[i].start + segs[i].duration) return i;
  }
  return segs.length; // finished
}

// Sets format expanded into a flat list of single sets.
export interface FlatSet {
  rowIndex: number;
  setInRow: number; // 1-based
  setsInRow: number;
  index: number; // 1-based overall
  items: BlockItem[];
  restSec: number;
}

export function flattenSets(b: Block): FlatSet[] {
  const out: FlatSet[] = [];
  b.rows.forEach((row, rowIndex) => {
    for (let s = 1; s <= row.sets; s++) {
      out.push({ rowIndex, setInRow: s, setsInRow: row.sets, index: out.length + 1, items: row.items, restSec: row.restSec });
    }
  });
  return out;
}

export function cloneBlock(b: Block): Block {
  return {
    ...b,
    id: uid('bl'),
    items: b.items.map((it) => ({ ...it, id: uid('it') })),
    rows: b.rows.map((r) => ({ ...r, id: uid('row'), items: r.items.map((it) => ({ ...it, id: uid('it') })) })),
  };
}
