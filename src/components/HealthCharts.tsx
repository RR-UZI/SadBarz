// Small charts for the Health tab, drawn with plain views (no chart library): bars and a line.
// Tapping a day shows its value in the card's header.
import React, { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';

import { colors, radius, space } from '../theme';
import { Txt } from './ui';

export type Segment = { value: number; color: string };
export type Point = { day: string; label: string; total: number | null; segments?: Segment[] };

const H = 120;

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)] as const;
}

/** Day labels under a chart: every day for a week, a few dates for longer ranges. */
function Axis({ points }: { points: Point[] }) {
  if (points.length <= 7) {
    return (
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {points.map((p) => (
          <Txt key={p.day} variant="tiny" color={colors.faint} style={{ flex: 1, textAlign: 'center' }}>
            {p.label}
          </Txt>
        ))}
      </View>
    );
  }
  const marks = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
      {marks.map((i) => (
        <Txt key={i} variant="tiny" color={colors.faint}>
          {points[i].label}
        </Txt>
      ))}
    </View>
  );
}

/** A dashed line across the chart at a goal (8 h of sleep, 10k steps). */
function Goal({ y, label }: { y: number; label: string }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: y, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.faint }} />
      <Txt variant="tiny" color={colors.faint} style={{ marginLeft: 4 }}>
        {label}
      </Txt>
    </View>
  );
}

export function BarChart({
  points,
  color,
  goal,
  selected,
  onSelect,
}: {
  points: Point[];
  color: string;
  goal?: { value: number; label: string };
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const max = Math.max(1, goal?.value ?? 0, ...points.map((p) => p.total ?? 0)) * 1.08;
  const gap = points.length > 40 ? 1 : points.length > 10 ? 2 : 6;
  return (
    <View>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap }}>
        {points.map((p, i) => {
          const h = p.total ? Math.max(2, (p.total / max) * H) : 0;
          const dim = selected !== null && selected !== i;
          return (
            <Pressable
              key={p.day}
              onPress={() => onSelect(selected === i ? null : i)}
              style={{ flex: 1, height: H, justifyContent: 'flex-end' }}
              accessibilityRole="button"
            >
              {p.total ? (
                <View style={{ height: h, borderTopLeftRadius: 3, borderTopRightRadius: 3, overflow: 'hidden', opacity: dim ? 0.35 : 1 }}>
                  {p.segments?.length ? (
                    p.segments.map((s, j) => <View key={j} style={{ flex: s.value, backgroundColor: s.color }} />)
                  ) : (
                    <View style={{ flex: 1, backgroundColor: color }} />
                  )}
                </View>
              ) : (
                <View style={{ height: 2, backgroundColor: colors.border, borderRadius: 1 }} />
              )}
            </Pressable>
          );
        })}
        {goal ? <Goal y={H - (goal.value / max) * H} label={goal.label} /> : null}
      </View>
      <Axis points={points} />
    </View>
  );
}

export function LineChart({
  points,
  color,
  selected,
  onSelect,
}: {
  points: Point[];
  color: string;
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const [w, onLayout] = useWidth();
  const vals = points.map((p) => p.total).filter((v): v is number => v !== null);
  const lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  const pad = Math.max(2, (hi - lo) * 0.2);
  const min = lo - pad, max = hi + pad;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const xy = points.map((p, i) => (p.total === null ? null : { x: points.length > 1 ? i * step : w / 2, y: H - ((p.total - min) / (max - min)) * H }));
  const dots = points.length <= 31;
  return (
    <View>
      <View style={{ height: H }} onLayout={onLayout}>
        {w > 0 &&
          xy.map((a, i) => {
            const b = xy[i + 1];
            if (!a || !b) return null;
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            return (
              <View
                key={`l${i}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (a.x + b.x) / 2 - len / 2,
                  top: (a.y + b.y) / 2 - 1,
                  width: len,
                  height: 2,
                  backgroundColor: color,
                  borderRadius: 1,
                  transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                }}
              />
            );
          })}
        {w > 0 &&
          xy.map((a, i) =>
            a && (dots || selected === i) ? (
              <View
                key={`d${i}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: a.x - (selected === i ? 5 : 3),
                  top: a.y - (selected === i ? 5 : 3),
                  width: selected === i ? 10 : 6,
                  height: selected === i ? 10 : 6,
                  borderRadius: 5,
                  backgroundColor: selected === i ? colors.text : color,
                }}
              />
            ) : null,
          )}
        {/* Tap areas, one per day. */}
        <View style={{ ...{ position: 'absolute', left: -step / 2, right: -step / 2, top: 0, bottom: 0 }, flexDirection: 'row' }}>
          {points.map((p, i) => (
            <Pressable key={p.day} style={{ flex: 1 }} onPress={() => onSelect(selected === i ? null : i)} />
          ))}
        </View>
      </View>
      <Axis points={points} />
    </View>
  );
}

/** A small colored key under a chart. */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: radius.sm, backgroundColor: it.color }} />
          <Txt variant="tiny" color={colors.muted}>
            {it.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}
