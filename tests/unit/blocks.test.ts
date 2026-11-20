import { describe, expect, it } from 'vitest';

import { blockDurationSec, buildTimeline, defaultEntries, formatLabel, itemsForRound, newBlock, setSameRound, totalReps } from '../../src/lib/blocks';
import { clock, shortDuration } from '../../src/lib/util';
import type { Block, BlockItem } from '../../src/types';

const item = (exerciseId: string, reps: number, turn?: number): BlockItem => ({ id: exerciseId, exerciseId, reps, ...(turn ? { turn } : {}) });
const emom = (extra: Partial<Block> = {}): Block => ({ ...newBlock('emom'), intervalSec: 50, rounds: 6, ...extra });

describe('timing', () => {
  it('writes clocks and short durations', () => {
    expect(clock(75)).toBe('1:15');
    expect(clock(3725)).toBe('1:02:05');
    expect(clock(-3)).toBe('0:00');
    expect(shortDuration(50)).toBe('50"');
    expect(shortDuration(90)).toBe(`1'30"`);
    expect(shortDuration(120)).toBe(`2'`);
  });

  it('knows how long a block lasts', () => {
    expect(blockDurationSec(emom())).toBe(300);
    expect(blockDurationSec({ ...newBlock('tabata'), rounds: 8, workSec: 20, restSec: 10 })).toBe(230); // no rest after the last round
    expect(blockDurationSec(newBlock('amrap'))).toBe(600);
  });

  it('labels EMOM, EM2M and other intervals', () => {
    expect(formatLabel(emom({ intervalSec: 60, rounds: 10 }), 'rondas', 'series', 'cap')).toBe('EMOM · 10 rondas');
    expect(formatLabel(emom({ intervalSec: 120, rounds: 4 }), 'rounds', 'sets', 'cap')).toBe('EM2M · 4 rounds');
    expect(formatLabel(emom(), 'rounds', 'sets', 'cap')).toBe('EMOM 50" · 6 rounds');
  });

  it('builds a tabata timeline with rest between rounds only', () => {
    const segs = buildTimeline({ ...newBlock('tabata'), rounds: 3, workSec: 20, restSec: 10 }, 5);
    expect(segs.map((s) => `${s.kind}${s.round}@${s.start}`)).toEqual(['leadin0@0', 'work1@5', 'rest1@25', 'work2@35', 'rest2@55', 'work3@65']);
  });
});

describe('alternating blocks', () => {
  const b = emom({ perRound: 'rotate', items: [item('ex_muscle', 3), item('ex_fondos', 10), item('ex_push', 15)] });

  it('does one item per round in turn', () => {
    expect(itemsForRound(b, 1).map((i) => i.exerciseId)).toEqual(['ex_muscle']);
    expect(itemsForRound(b, 2).map((i) => i.exerciseId)).toEqual(['ex_fondos']);
    expect(itemsForRound(b, 4).map((i) => i.exerciseId)).toEqual(['ex_muscle']);
  });

  it('groups items into the same round', () => {
    const items = setSameRound(b, 1, true); // fondos joins muscle ups
    expect(items.map((i) => i.turn)).toEqual([1, 1, 2]);
    expect(itemsForRound({ ...b, items }, 1).map((i) => i.exerciseId)).toEqual(['ex_muscle', 'ex_fondos']);
  });

  it('pre-fills the log with the rounds each item got', () => {
    const entries = defaultEntries({ ...b, rounds: 7 }); // 7 rounds over 3 turns: 3, 2, 2
    expect(entries.map((e) => e.rounds)).toEqual([3, 2, 2]);
    expect(totalReps(entries)).toBe(3 * 3 + 2 * 10 + 2 * 15);
  });
});

describe('logged rounds', () => {
  it('uses the rounds done for an AMRAP', () => {
    const amrap = { ...newBlock('amrap'), items: [item('ex_pull', 5), item('ex_push', 10)] };
    expect(defaultEntries(amrap, 7).map((e) => e.rounds)).toEqual([7, 7]);
  });

  it('uses each row of a sets block', () => {
    const sets = { ...newBlock('sets'), rows: [{ id: 'r', sets: 4, restSec: 90, items: [item('ex_pull', 6)] }] };
    expect(defaultEntries(sets)).toMatchObject([{ exerciseId: 'ex_pull', rounds: 4, reps: 6 }]);
  });
});
