// Pro history cards: training by week (workouts, reps, time) and personal bests from the logged workouts.
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useT } from '../i18n';
import { personalBests, weeklyTotals, type Best, type Week } from '../lib/progress';
import { clock } from '../lib/util';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import type { Workout } from '../types';
import { BarChart } from './HealthCharts';
import { Badge, Button, Card, Row, Segmented, Txt } from './ui';

const WEEKS = 12;
const SHOWN_BESTS = 6;
const NEW_FOR_MS = 7 * 86_400_000;

type WeekMetric = 'workouts' | 'reps' | 'time';

/** "1h 20m" for an hour or more, "45m" under that. */
const hoursText = (min: number) => {
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};

function useDate() {
  const { settings } = useApp();
  return (ts: number) => new Date(ts).toLocaleDateString(settings.language === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' });
}

export function WeeklyCard({ workouts }: { workouts: Workout[] }) {
  const t = useT();
  const date = useDate();
  const [metric, setMetric] = useState<WeekMetric>('workouts');
  const [selected, setSelected] = useState<number | null>(null);
  const weeks = useMemo(() => weeklyTotals(workouts, WEEKS), [workouts]);
  const value = (w: Week) => (metric === 'workouts' ? w.workouts : metric === 'reps' ? w.reps : w.minutes);
  const format = (v: number) => (metric === 'time' ? hoursText(v) : String(Math.round(v)));
  // The average counts finished weeks from the first workout on: empty weeks before the athlete started
  // and the week still under way would pull it down.
  const first = weeks.findIndex((w) => w.workouts > 0);
  const counted = first < 0 ? [] : weeks.slice(first, -1);
  const avg = counted.length ? counted.reduce((s, w) => s + value(w), 0) / counted.length : 0;
  const shown = selected !== null ? weeks[selected] : weeks[weeks.length - 1];

  return (
    <Card>
      <Txt variant="label">{t('history.progress')}</Txt>
      <View style={{ marginTop: space.sm }}>
        <Segmented
          small
          value={metric}
          onChange={(m) => setMetric(m)}
          options={[
            { value: 'workouts', label: t('history.m.workouts') },
            { value: 'reps', label: t('history.m.reps') },
            { value: 'time', label: t('history.m.time') },
          ]}
        />
      </View>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space.md }}>
        <View style={{ flex: 1 }}>
          <Txt variant="h2">{format(value(shown))}</Txt>
          <Txt variant="tiny" color={colors.faint}>
            {selected === null || selected === weeks.length - 1 ? t('history.thisWeek') : t('history.weekOf', { date: date(shown.start) })}
          </Txt>
        </View>
        {counted.length ? (
          <Txt variant="tiny" color={colors.muted}>
            {t('history.avgWeek', { v: metric === 'workouts' ? avg.toFixed(1) : format(avg) })}
          </Txt>
        ) : null}
      </Row>
      <View style={{ marginTop: space.md }}>
        <BarChart
          points={weeks.map((w) => ({ day: String(w.start), label: date(w.start), total: value(w) || null }))}
          color={colors.accent}
          selected={selected}
          onSelect={setSelected}
        />
      </View>
      <Txt variant="tiny" color={colors.faint} style={{ marginTop: space.sm }}>
        {t('history.tapWeek')}
      </Txt>
    </Card>
  );
}

export function BestsCard({ workouts }: { workouts: Workout[] }) {
  const t = useT();
  const date = useDate();
  const { exerciseById } = useApp();
  const [all, setAll] = useState(false);
  const bests = useMemo(() => personalBests(workouts), [workouts]);
  const now = Date.now();
  const shown = all ? bests : bests.slice(0, SHOWN_BESTS);

  const valueText = (b: Best) => {
    const v = b.value;
    switch (b.kind) {
      case 'reps':
        return t('history.rec.reps', { n: v });
      case 'weight':
        return b.reps ? t('history.rec.weightReps', { kg: v, reps: b.reps }) : t('history.rec.weight', { kg: v });
      case 'hold':
        return t('history.rec.hold', { time: clock(v) });
      case 'meters':
        return t('history.rec.meters', { n: v });
      case 'amrap':
        return t('history.rec.amrap', { rounds: Math.floor(v / 1000), reps: v % 1000 });
      case 'fortime':
        return t('history.rec.fortime', { time: clock(v) });
    }
  };

  // The earlier best, short: "12", "+15 kg", "1:05", "7+3".
  const shortText = (b: Best, v: number) => {
    if (b.kind === 'weight') return t('history.rec.weight', { kg: v });
    if (b.kind === 'hold' || b.kind === 'fortime') return clock(v);
    if (b.kind === 'meters') return t('history.rec.meters', { n: v });
    if (b.kind === 'amrap') return `${Math.floor(v / 1000)}+${v % 1000}`;
    return String(v);
  };

  return (
    <Card>
      <Txt variant="label">{t('history.records')}</Txt>
      <Txt variant="tiny" color={colors.faint} style={{ marginTop: 2 }}>
        {bests.length ? t('history.recordsHint') : t('history.recordsEmpty')}
      </Txt>
      <View style={{ marginTop: space.sm }}>
        {shown.map((b, i) => {
          const isNew = b.previous !== undefined && now - b.at < NEW_FOR_MS;
          const name = b.exerciseId ? (exerciseById(b.exerciseId)?.name ?? '?') : (b.title ?? '');
          return (
            <View key={b.key} style={{ paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }} numberOfLines={1}>
                    {name}
                  </Txt>
                  {b.routineName ? (
                    <Txt variant="tiny" color={colors.faint} numberOfLines={1}>
                      {b.routineName}
                    </Txt>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', maxWidth: '55%' }}>
                  <Row gap={6}>
                    {isNew ? <Badge label={t('history.new')} color={colors.accent} textColor={colors.accentText} /> : null}
                    <Txt style={{ fontWeight: '800' }} color={colors.accent}>
                      {valueText(b)}
                    </Txt>
                  </Row>
                  <Txt variant="tiny" color={colors.faint}>
                    {date(b.at)}
                    {b.previous !== undefined ? ` · ${t('history.before', { v: shortText(b, b.previous) })}` : ''}
                  </Txt>
                </View>
              </Row>
            </View>
          );
        })}
      </View>
      {bests.length > SHOWN_BESTS ? (
        <Button
          label={all ? t('history.recordsLess') : t('history.recordsAll', { n: bests.length })}
          variant="ghost"
          size="sm"
          onPress={() => setAll((v) => !v)}
        />
      ) : null}
    </Card>
  );
}
