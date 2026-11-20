// Small builders for test data.
import type { BlockLog, LogEntry, Workout } from '../../src/types';

const DAY = 86_400_000;

/** A local-time timestamp: day(2026, 11, 16, 18) is Nov 16 2026, 6 pm. */
export const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

export function block(entries: LogEntry[], extra: Partial<BlockLog> = {}): BlockLog {
  return { blockId: 'b1', title: 'Fuerza', format: 'sets', status: 'done', durationSec: 600, entries, ...extra };
}

export function workout(startedAt: number, blocks: BlockLog[], extra: Partial<Workout> = {}): Workout {
  return { id: `w${startedAt}`, routineName: 'Lunes · Lastre', startedAt, finishedAt: startedAt + 60 * 60_000, blocks, ...extra };
}

export { DAY };
