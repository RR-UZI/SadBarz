export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// 75 -> "1:15", 600 -> "10:00", 3725 -> "1:02:05"
export function clock(totalSec: number) {
  const s = Math.max(0, Math.ceil(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

// 50 -> '50"', 60 -> "1'", 90 -> "1'30\"", 120 -> "2'"
export function shortDuration(sec: number) {
  if (sec < 60) return `${sec}"`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}'${s}"` : `${m}'`;
}

export function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfWeek(ts: number) {
  const d = new Date(startOfDay(ts));
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export const DAY_MS = 24 * 60 * 60 * 1000;
