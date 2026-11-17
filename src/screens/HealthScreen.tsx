// Health tab: the athlete's sleep, heart and activity from Google Health (Fitbit, Pixel Watch), with charts,
// trends, "how you come into today" and what the numbers say about their training.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { BarChart, Legend, LineChart, type Point } from '../components/HealthCharts';
import { Button, Card, Row, Screen, Segmented, Txt } from '../components/ui';
import { useT, type StringKey } from '../i18n';
import { confirm } from '../lib/confirm';
import {
  addDays,
  clearGoogleReturn,
  connectGoogle,
  daysBetween,
  disconnectGoogle,
  finishGoogle,
  googleReturn,
  healthLink,
  loadHealth,
  loadDay,
  localDay,
  syncGoogle,
  type DayDetail,
  type HealthDay,
  type HealthLink,
  type StageType,
} from '../lib/health';
import { hm, insights, mean, readiness, summary, values, type Days, type Metric } from '../lib/healthStats';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, radius, space } from '../theme';

// Today and yesterday hour by hour, or the days over a period.
const VIEWS = ['today', 'yesterday', 7, 30, 90] as const;
type View_ = (typeof VIEWS)[number];
const DAY_REFRESH_MS = 5 * 60_000; // today's hours read again this often while the tab is open
const SYNC_AFTER_MS = 3 * 3600_000; // syncs again when the last one is older than this

const STAGE = { deep: '#2F6BFF', rem: '#9B7BFF', light: '#6FC3FF', awake: '#5C5C66' };

export function HealthScreen() {
  const t = useT();
  const { settings, workouts } = useApp();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const locale = settings.language === 'es' ? 'es-MX' : 'en-US';
  const today = localDay();

  const [view, setView] = useState<View_>('today');
  const range = typeof view === 'number' ? view : 7;
  const [days, setDays] = useState<Days | null>(null);
  const [link, setLink] = useState<HealthLink | null>(null);
  const [busy, setBusy] = useState<'connect' | 'sync' | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    // Enough to compare with the period before and to know their baseline.
    setDays(await loadHealth(userId, addDays(today, -2 * 90 - 1), today).catch(() => new Map<string, HealthDay>()));
  }, [userId, today]);

  const sync = useCallback(
    async (manual?: boolean) => {
      setBusy('sync');
      try {
        await syncGoogle();
        if (manual) setMessage({ text: t('health.synced') });
      } catch (e) {
        setMessage({ text: t((e as Error).message === 'reconnect' ? 'health.err.reconnect' : 'health.err.sync'), bad: true });
      }
      setBusy(null);
      setLink(await healthLink());
      await load();
    },
    [load, t],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      // Back from Google: finish connecting first.
      const back = googleReturn();
      if (back) {
        clearGoogleReturn();
        if (back.code && back.state) {
          setBusy('connect');
          try {
            const n = await finishGoogle(back.code, back.state);
            if (alive) setMessage({ text: t('health.connected', { n }) });
          } catch {
            if (alive) setMessage({ text: t('health.err.connect'), bad: true });
          }
          setBusy(null);
        } else if (alive) setMessage({ text: t('health.err.cancelled'), bad: true });
      }
      const l = await healthLink();
      if (!alive) return;
      setLink(l);
      await load();
      if (alive && l.connected && (!l.lastSync || Date.now() - Date.parse(l.lastSync) > SYNC_AFTER_MS)) sync();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const from = addDays(today, -(range - 1));
  const list = useMemo(() => daysBetween(from, today), [from, today]);
  const trainingDays = useMemo(() => new Set(workouts.map((w) => localDay(w.startedAt))), [workouts]);
  const label = useCallback(
    (day: string) => {
      const [y, m, d] = day.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return range === 7 ? date.toLocaleDateString(locale, { weekday: 'narrow' }) : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    },
    [locale, range],
  );
  const longDate = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  if (!days || !link) {
    return (
      <Screen title={t('health.title')} mark>
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xxl }} />
      </Screen>
    );
  }

  const hasData = days.size > 0;
  const shownDay = view === 'yesterday' ? addDays(today, -1) : today;
  const ready = readiness(days, shownDay);
  const notes = insights(days, from, today, trainingDays);
  const point = (day: string, total: number | null, segments?: Point['segments']): Point => ({ day, label: label(day), total, segments });
  const get = (day: string, k: keyof HealthDay) => {
    const v = days.get(day)?.[k];
    return typeof v === 'number' ? v : null;
  };

  return (
    <Screen title={t('health.title')} mark>
      <View style={{ gap: space.md }}>
        <ConnectCard
          link={link}
          busy={busy}
          onConnect={async () => {
            setBusy('connect');
            setMessage(null);
            try {
              await connectGoogle();
              // Preview mode connects right away; online the page goes to Google.
              setLink(await healthLink());
              await load();
            } catch {
              setMessage({ text: t('health.err.connect'), bad: true });
            }
            setBusy(null);
          }}
          onSync={() => sync(true)}
          onDisconnect={() =>
            confirm(
              t('health.disconnectAsk'),
              async () => {
                await disconnectGoogle().catch(() => {});
                setLink(await healthLink());
                await load();
              },
              t('health.disconnect'),
              t('common.cancel'),
            )
          }
        />
        {message ? (
          <Txt variant="small" color={message.bad ? colors.danger : colors.success}>
            {message.text}
          </Txt>
        ) : null}

        {hasData ? (
          <>
        <Segmented value={view} onChange={setView} options={VIEWS.map((r) => ({ value: r, label: t(`health.range.${r}` as StringKey) }))} />
        <ReadinessCard r={ready} title={view === 'yesterday' ? t('health.yesterdayReady') : t('health.today')} />

        {typeof view === 'string' ? (
          <DayView day={shownDay} isToday={view === 'today'} days={days} locale={locale} trained={trainingDays.has(shownDay)} />
        ) : (
          <>
        <MetricCard
          title={t('health.sleep')}
          metric="sleepMin"
          days={days}
          from={from}
          to={today}
          format={(v) => hm(v)}
          better="up"
          longDate={longDate}
          chart={(sel, onSel) => {
            const pts = list.map((d) => {
              const x = days.get(d);
              const staged = x?.sleepDeepMin != null && x.sleepRemMin != null && x.sleepLightMin != null;
              return point(
                d,
                get(d, 'sleepMin'),
                staged
                  ? [
                      { value: x!.sleepAwakeMin ?? 0, color: STAGE.awake },
                      { value: x!.sleepRemMin!, color: STAGE.rem },
                      { value: x!.sleepLightMin!, color: STAGE.light },
                      { value: x!.sleepDeepMin!, color: STAGE.deep },
                    ]
                  : undefined,
              );
            });
            const staged = pts.some((p) => p.segments);
            return (
              <>
                <BarChart points={pts} color={STAGE.light} goal={{ value: 480, label: '8h' }} selected={sel} onSelect={onSel} />
                {staged ? (
                  <Legend
                    items={[
                      { label: t('health.stage.deep'), color: STAGE.deep },
                      { label: t('health.stage.light'), color: STAGE.light },
                      { label: t('health.stage.rem'), color: STAGE.rem },
                      { label: t('health.stage.awake'), color: STAGE.awake },
                    ]}
                  />
                ) : null}
              </>
            );
          }}
          detail={(day) => {
            const x = days.get(day);
            if (!x || x.sleepDeepMin == null) return null;
            return t('health.sleepDetail', { deep: hm(x.sleepDeepMin), rem: hm(x.sleepRemMin ?? 0) });
          }}
        />

            <MetricCard
              title={t('health.restingHr')}
              metric="restingHr"
              days={days}
              from={from}
              to={today}
              format={(v) => `${Math.round(v)} ${t('health.bpm')}`}
              better="down"
              hint={t('health.restingHrHint')}
              longDate={longDate}
              chart={(sel, onSel) => <LineChart points={list.map((d) => point(d, get(d, 'restingHr')))} color={colors.danger} selected={sel} onSelect={onSel} />}
              detail={(day) => {
                const x = days.get(day);
                return x?.avgHr != null ? t('health.hrDetail', { avg: Math.round(x.avgHr), max: Math.round(x.maxHr ?? 0) }) : null;
              }}
            />
            <MetricCard
              title={t('health.hrv')}
              metric="hrvMs"
              days={days}
              from={from}
              to={today}
              format={(v) => `${Math.round(v)} ms`}
              better="up"
              hint={t('health.hrvHint')}
              longDate={longDate}
              chart={(sel, onSel) => <LineChart points={list.map((d) => point(d, get(d, 'hrvMs')))} color={colors.success} selected={sel} onSelect={onSel} />}
            />
            <MetricCard
              title={t('health.steps')}
              metric="steps"
              days={days}
              from={from}
              to={today}
              format={(v) => Math.round(v).toLocaleString(locale)}
              better="up"
              longDate={longDate}
              chart={(sel, onSel) => (
                <BarChart points={list.map((d) => point(d, get(d, 'steps')))} color={colors.accent} goal={{ value: 10000, label: '10k' }} selected={sel} onSelect={onSel} />
              )}
            />
            <MetricCard
              title={t('health.calories')}
              metric="calories"
              days={days}
              from={from}
              to={today}
              format={(v) => `${Math.round(v).toLocaleString(locale)} kcal`}
              longDate={longDate}
              chart={(sel, onSel) => (
                <BarChart
                  points={list.map((d) => point(d, get(d, 'calories')))}
                  color={colors.warn}
                  selected={sel}
                  onSelect={onSel}
                />
              )}
              detail={(day) => (trainingDays.has(day) ? t('health.trainedThatDay') : null)}
            />

        <Card>
          <Txt variant="h2">{t('health.insights')}</Txt>
          {notes.length ? (
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              {notes.map((n) => (
                <Row key={n.key} style={{ alignItems: 'flex-start' }}>
                  <Txt color={colors.accent}>•</Txt>
                  <Txt variant="small" style={{ flex: 1 }}>
                    {t(n.key as StringKey, n.vars)}
                  </Txt>
                </Row>
              ))}
            </View>
          ) : (
            <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
              {t('health.insightsEmpty')}
            </Txt>
          )}
          <Txt variant="tiny" color={colors.faint} style={{ marginTop: space.md }}>
            {t('health.disclaimer')}
          </Txt>
        </Card>
          </>
        )}
          </>
        ) : link.connected ? (
          <Txt variant="small" color={colors.muted}>
            {t('health.noData')}
          </Txt>
        ) : null}
      </View>
    </Screen>
  );
}

function ConnectCard({
  link,
  busy,
  onConnect,
  onSync,
  onDisconnect,
}: {
  link: HealthLink;
  busy: 'connect' | 'sync' | null;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const t = useT();
  if (link.connected) {
    const ago = link.lastSync ? Math.max(0, Math.round((Date.now() - Date.parse(link.lastSync)) / 60000)) : null;
    return (
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: '800' }}>Google Health</Txt>
            <Txt variant="small" color={colors.muted}>
              {busy === 'sync'
                ? t('health.syncing')
                : ago === null
                  ? t('health.neverSynced')
                  : ago < 60
                    ? t('health.syncedMin', { n: ago })
                    : ago < 48 * 60
                      ? t('health.syncedH', { n: Math.round(ago / 60) })
                      : t('health.syncedD', { n: Math.round(ago / 1440) })}
            </Txt>
          </View>
          <Button label={t('health.sync')} size="sm" variant="secondary" disabled={!!busy} onPress={onSync} />
        </Row>
        <Button label={t('health.disconnect')} size="sm" variant="ghost" style={{ marginTop: space.sm, alignSelf: 'flex-start' }} onPress={onDisconnect} />
      </Card>
    );
  }
  if (!link.configured) {
    return (
      <Card style={{ borderStyle: 'dashed', borderColor: colors.faint }}>
        <Txt style={{ fontWeight: '800' }}>{t('health.connectTitle')}</Txt>
        <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>
          {t('health.soon')}
        </Txt>
      </Card>
    );
  }
  return (
    <Card>
      <Txt variant="h2">{t('health.connectTitle')}</Txt>
      <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
        {t('health.connectBody')}
      </Txt>
      {link.error === 'reconnect' ? (
        <Txt variant="small" color={colors.danger} style={{ marginTop: space.sm }}>
          {t('health.err.reconnect')}
        </Txt>
      ) : null}
      <Button label={busy === 'connect' ? t('health.connecting') : t('health.connect')} disabled={!!busy} style={{ marginTop: space.md }} onPress={onConnect} />
      <Txt variant="tiny" color={colors.faint} style={{ marginTop: space.sm }}>
        {t('health.connectPrivacy')}
      </Txt>
    </Card>
  );
}

function ReadinessCard({ r, title }: { r: ReturnType<typeof readiness>; title: string }) {
  const t = useT();
  const color = r.level === 'ready' ? colors.success : r.level === 'easy' ? colors.warn : r.level === 'normal' ? colors.accent : colors.faint;
  return (
    <Card>
      <Txt variant="small" color={colors.muted}>
        {title}
      </Txt>
      <Row style={{ marginTop: 4 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
        <Txt variant="h2" style={{ flex: 1 }}>
          {t(`health.ready.${r.level}` as StringKey)}
        </Txt>
      </Row>
      <Txt variant="small" color={colors.muted} style={{ marginTop: space.xs }}>
        {t(`health.ready.${r.level}Body` as StringKey)}
      </Txt>
      {r.reasons.length ? (
        <View style={{ gap: 2, marginTop: space.sm }}>
          {r.reasons.map((n) => (
            <Txt key={n.key} variant="small">
              · {t(n.key as StringKey, n.vars)}
            </Txt>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function MetricCard({
  title,
  metric,
  days,
  from,
  to,
  format,
  better,
  hint,
  chart,
  detail,
  longDate,
}: {
  title: string;
  metric: Metric;
  days: Days;
  from: string;
  to: string;
  format: (v: number) => string;
  better?: 'up' | 'down';
  hint?: string;
  chart: (selected: number | null, onSelect: (i: number | null) => void) => React.ReactNode;
  detail?: (day: string) => string | null;
  longDate: (day: string) => string;
}) {
  const t = useT();
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setSelected(null), [from]);
  const s = summary(days, from, to, metric);
  const list = daysBetween(from, to);
  const day = selected !== null ? list[selected] : null;
  const dayValue = day ? days.get(day)?.[metric] : null;
  const good = s.delta === null || !better ? null : better === 'up' ? s.delta > 0 : s.delta < 0;
  const deltaText =
    s.delta === null || Math.abs(s.delta) < 0.5
      ? null
      : `${s.delta > 0 ? '▲' : '▼'} ${metric === 'sleepMin' ? hm(Math.abs(s.delta)) : format(Math.abs(s.delta))}`;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="small" color={colors.muted}>
            {title}
          </Txt>
          <Txt variant="h2" style={{ marginTop: 2 }}>
            {day ? (typeof dayValue === 'number' ? format(dayValue) : '—') : s.avg !== null ? format(s.avg) : '—'}
          </Txt>
          <Txt variant="tiny" color={colors.faint}>
            {day ? longDate(day) : t('health.average')}
          </Txt>
        </View>
        {!day && deltaText ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="small" style={{ fontWeight: '800' }} color={good === null ? colors.muted : good ? colors.success : colors.warn}>
              {deltaText}
            </Txt>
            <Txt variant="tiny" color={colors.faint}>
              {t('health.vsBefore')}
            </Txt>
          </View>
        ) : null}
      </Row>
      {day && detail?.(day) ? (
        <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>
          {detail(day)}
        </Txt>
      ) : null}
      <View style={{ marginTop: space.md }}>
        {chart(selected, setSelected)}
      </View>
      {hint ? (
        <Txt variant="tiny" color={colors.faint} style={{ marginTop: space.sm }}>
          {hint}
        </Txt>
      ) : null}
    </Card>
  );
}

const STAGE_COLOR: Record<StageType, string> = {
  DEEP: STAGE.deep,
  LIGHT: STAGE.light,
  ASLEEP: STAGE.light,
  RESTLESS: STAGE.awake,
  REM: STAGE.rem,
  AWAKE: STAGE.awake,
};
// Hypnogram rows, top to bottom.
const STAGE_ROW: Record<StageType, number> = { AWAKE: 0, RESTLESS: 0, REM: 1, LIGHT: 2, ASLEEP: 2, DEEP: 3 };

// Today or yesterday hour by hour: right now, the night's sleep, heart rate, steps and calories, and how the day
// compares with the athlete's own last 28 days.
function DayView({ day, isToday, days, locale, trained }: { day: string; isToday: boolean; days: Days; locale: string; trained: boolean }) {
  const t = useT();
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [selHr, setSelHr] = useState<number | null>(null);
  const [selSteps, setSelSteps] = useState<number | null>(null);
  const [selCal, setSelCal] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setFailed(false);
    setSelHr(null);
    setSelSteps(null);
    setSelCal(null);
    const read = () =>
      loadDay(day)
        .then((d) => alive && (setDetail(d), setFailed(false)))
        .catch(() => alive && setFailed(true));
    read();
    const timer = isToday ? setInterval(read, DAY_REFRESH_MS) : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [day, isToday]);

  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const hourLabel = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric' });
  const d = days.get(day);
  const sumOf = (k: 'steps' | 'calories') => {
    const xs = (detail?.hours ?? []).map((h) => h[k]).filter((x): x is number => x !== null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
  };
  // The day's totals: what the hours add up to, or the synced day when the hours aren't in yet.
  const steps = sumOf('steps') ?? d?.steps ?? null;
  const calories = sumOf('calories') ?? d?.calories ?? null;

  if (failed && !detail) {
    return (
      <Card>
        <Txt variant="small" color={colors.muted}>
          {t('health.dayFailed')}
        </Txt>
      </Card>
    );
  }
  if (!detail) return <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />;

  const hrPts: Point[] = detail.hours.map((h) => ({ day: h.start, label: hourLabel(h.start), total: h.hrAvg }));
  const stepPts: Point[] = detail.hours.map((h) => ({ day: h.start, label: hourLabel(h.start), total: h.steps }));
  const calPts: Point[] = detail.hours.map((h) => ({ day: h.start, label: hourLabel(h.start), total: h.calories }));
  const hour = (i: number | null) => (i === null ? null : detail.hours[i]);
  const range = (i: number) => `${hourLabel(detail.hours[i].start)}–${hourLabel(new Date(Date.parse(detail.hours[i].start) + 3600_000).toISOString())}`;

  // Against their own last 28 days (not counting this day).
  const base = (k: keyof HealthDay) => mean(values(days, addDays(day, -28), addDays(day, -1), k));
  const compare: { label: string; v: number | null; b: number | null; fmt: (n: number) => string; better: 'up' | 'down' | null }[] = [
    { label: t('health.sleep'), v: d?.sleepMin ?? null, b: base('sleepMin'), fmt: hm, better: 'up' },
    { label: t('health.restingHr'), v: d?.restingHr ?? null, b: base('restingHr'), fmt: (n) => `${Math.round(n)} ${t('health.bpm')}`, better: 'down' },
    { label: 'HRV', v: d?.hrvMs ?? null, b: base('hrvMs'), fmt: (n) => `${Math.round(n)} ms`, better: 'up' },
    ...(isToday ? [] : [
      { label: t('health.steps'), v: steps, b: base('steps'), fmt: (n: number) => Math.round(n).toLocaleString(locale), better: 'up' as const },
      { label: t('health.calories'), v: calories, b: base('calories'), fmt: (n: number) => `${Math.round(n).toLocaleString(locale)} kcal`, better: null },
    ]),
  ];

  return (
    <>
      <Card>
        <Txt variant="small" color={colors.muted}>
          {isToday ? t('health.now') : t('health.yesterdayTotals')}
        </Txt>
        {isToday ? (
          detail.now ? (
            <Row style={{ alignItems: 'baseline', marginTop: 2 }}>
              <Txt style={{ fontSize: 34, fontWeight: '900', color: colors.danger }}>{detail.now.bpm}</Txt>
              <Txt variant="small" color={colors.muted}>
                {t('health.bpm')} · {t('health.at', { t: time(detail.now.at) })}
              </Txt>
            </Row>
          ) : (
            <Txt variant="small" color={colors.muted} style={{ marginTop: 2 }}>
              {t('health.noNow')}
            </Txt>
          )
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md, rowGap: space.md }}>
          <Tile label={t('health.steps')} value={steps !== null ? Math.round(steps).toLocaleString(locale) : '—'} />
          <Tile label={t('health.calories')} value={calories !== null ? `${Math.round(calories).toLocaleString(locale)}` : '—'} unit="kcal" />
          <Tile label={t('health.restingHr')} value={d?.restingHr != null ? `${Math.round(d.restingHr)}` : '—'} unit={t('health.bpm')} />
          <Tile label="HRV" value={d?.hrvMs != null ? `${Math.round(d.hrvMs)}` : '—'} unit="ms" />
        </View>
        {isToday ? (
          <Txt variant="tiny" color={colors.faint} style={{ marginTop: space.sm }}>
            {t('health.nowHint')}
          </Txt>
        ) : trained ? (
          <Txt variant="small" color={colors.accent} style={{ marginTop: space.sm }}>
            {t('health.trainedThatDay')}
          </Txt>
        ) : null}
      </Card>

      <Card>
        <Txt variant="small" color={colors.muted}>
          {isToday ? t('health.lastNight') : t('health.nightBefore')}
        </Txt>
        {detail.sleep && detail.sleep.start && detail.sleep.end ? (
          <SleepNight sleep={detail.sleep as Required<NonNullable<DayDetail['sleep']>> & { start: string; end: string }} time={time} />
        ) : (
          <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
            {t('health.noSleep')}
          </Txt>
        )}
      </Card>

      <Card>
        <Txt variant="small" color={colors.muted}>
          {t('health.hrByHour')}
        </Txt>
        <Txt variant="h2" style={{ marginTop: 2 }}>
          {hour(selHr)?.hrAvg != null ? `${Math.round(hour(selHr)!.hrAvg!)} ${t('health.bpm')}` : maxOf(detail.hours.map((h) => h.hrMax)) !== null ? `${t('health.max')} ${Math.round(maxOf(detail.hours.map((h) => h.hrMax))!)} ${t('health.bpm')}` : '—'}
        </Txt>
        <Txt variant="tiny" color={colors.faint}>
          {selHr !== null
            ? `${range(selHr)}${hour(selHr)?.hrMin != null ? ` · ${t('health.minMax', { min: Math.round(hour(selHr)!.hrMin!), max: Math.round(hour(selHr)!.hrMax ?? 0) })}` : ''}`
            : t('health.tapHour')}
        </Txt>
        <View style={{ marginTop: space.md }}>
          <LineChart points={hrPts} color={colors.danger} selected={selHr} onSelect={setSelHr} />
        </View>
      </Card>

      <Card>
        <Txt variant="small" color={colors.muted}>
          {t('health.stepsByHour')}
        </Txt>
        <Txt variant="h2" style={{ marginTop: 2 }}>
          {selSteps !== null ? (hour(selSteps)?.steps ?? 0).toLocaleString(locale) : steps !== null ? Math.round(steps).toLocaleString(locale) : '—'}
        </Txt>
        <Txt variant="tiny" color={colors.faint}>
          {selSteps !== null ? range(selSteps) : t('health.dayTotal')}
        </Txt>
        <View style={{ marginTop: space.md }}>
          <BarChart points={stepPts} color={colors.accent} selected={selSteps} onSelect={setSelSteps} />
        </View>
      </Card>

      <Card>
        <Txt variant="small" color={colors.muted}>
          {t('health.caloriesByHour')}
        </Txt>
        <Txt variant="h2" style={{ marginTop: 2 }}>
          {selCal !== null ? `${hour(selCal)?.calories ?? 0} kcal` : calories !== null ? `${Math.round(calories).toLocaleString(locale)} kcal` : '—'}
        </Txt>
        <Txt variant="tiny" color={colors.faint}>
          {selCal !== null ? range(selCal) : t('health.dayTotal')}
        </Txt>
        <View style={{ marginTop: space.md }}>
          <BarChart points={calPts} color={colors.warn} selected={selCal} onSelect={setSelCal} />
        </View>
      </Card>

      <Card>
        <Txt variant="h2">{t('health.vsNormal')}</Txt>
        <Txt variant="tiny" color={colors.faint}>
          {t('health.vsNormalHint')}
        </Txt>
        <View style={{ gap: space.sm, marginTop: space.md }}>
          {compare.map((c) => {
            const diff = c.v !== null && c.b !== null ? c.v - c.b : null;
            const pct = diff !== null && c.b ? Math.round((diff / c.b) * 100) : null;
            const good = diff === null || !c.better || Math.abs(pct ?? 0) < 3 ? null : c.better === 'up' ? diff > 0 : diff < 0;
            return (
              <Row key={c.label} style={{ justifyContent: 'space-between' }}>
                <Txt variant="small" style={{ flex: 1 }}>
                  {c.label}
                </Txt>
                <Txt variant="small" style={{ fontWeight: '800' }}>
                  {c.v !== null ? c.fmt(c.v) : '—'}
                </Txt>
                <Txt variant="small" color={good === null ? colors.muted : good ? colors.success : colors.warn} style={{ width: 64, textAlign: 'right' }}>
                  {pct === null ? '' : `${pct > 0 ? '+' : ''}${pct}%`}
                </Txt>
              </Row>
            );
          })}
        </View>
      </Card>
    </>
  );
}

const maxOf = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.max(...v) : null;
};

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ width: '50%' }}>
      <Txt variant="tiny" color={colors.muted}>
        {label}
      </Txt>
      <Row gap={4} style={{ alignItems: 'baseline' }}>
        <Txt variant="h2">{value}</Txt>
        {unit && value !== '—' ? (
          <Txt variant="tiny" color={colors.muted}>
            {unit}
          </Txt>
        ) : null}
      </Row>
    </View>
  );
}

// The night as a hypnogram: one row per stage, from bedtime to wake up.
function SleepNight({ sleep, time }: { sleep: { start: string; end: string; minutes: number; stages: { type: StageType; start: string; end: string }[] }; time: (iso: string) => string }) {
  const t = useT();
  const s0 = Date.parse(sleep.start), total = Math.max(1, Date.parse(sleep.end) - s0);
  const mins = (types: StageType[]) => Math.round(sleep.stages.filter((x) => types.includes(x.type)).reduce((a, x) => a + (Date.parse(x.end) - Date.parse(x.start)), 0) / 60000);
  const ROW = 18;
  const rows = [t('health.stage.awake'), t('health.stage.rem'), t('health.stage.light'), t('health.stage.deep')];
  return (
    <View>
      <Txt variant="h2" style={{ marginTop: 2 }}>
        {hm(sleep.minutes)}
      </Txt>
      <Txt variant="tiny" color={colors.faint}>
        {time(sleep.start)} – {time(sleep.end)}
      </Txt>
      {sleep.stages.length ? (
        <>
          <Row style={{ marginTop: space.md, alignItems: 'stretch' }} gap={space.sm}>
            <View style={{ width: 58 }}>
              {rows.map((r) => (
                <Txt key={r} variant="tiny" color={colors.faint} style={{ height: ROW, lineHeight: ROW }} numberOfLines={1}>
                  {r}
                </Txt>
              ))}
            </View>
            <View style={{ flex: 1, height: ROW * 4, borderRadius: radius.sm, backgroundColor: colors.surface2, overflow: 'hidden' }}>
              {sleep.stages.map((x, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${((Date.parse(x.start) - s0) / total) * 100}%`,
                    width: `${Math.max(0.4, ((Date.parse(x.end) - Date.parse(x.start)) / total) * 100)}%`,
                    top: STAGE_ROW[x.type] * ROW + 3,
                    height: ROW - 6,
                    borderRadius: 3,
                    backgroundColor: STAGE_COLOR[x.type],
                  }}
                />
              ))}
            </View>
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: 4, marginLeft: 58 + space.sm }}>
            <Txt variant="tiny" color={colors.faint}>
              {time(sleep.start)}
            </Txt>
            <Txt variant="tiny" color={colors.faint}>
              {time(sleep.end)}
            </Txt>
          </Row>
          <Legend
            items={[
              { label: `${t('health.stage.deep')} ${hm(mins(['DEEP']))}`, color: STAGE.deep },
              { label: `${t('health.stage.light')} ${hm(mins(['LIGHT', 'ASLEEP']))}`, color: STAGE.light },
              { label: `REM ${hm(mins(['REM']))}`, color: STAGE.rem },
              { label: `${t('health.stage.awake')} ${hm(mins(['AWAKE', 'RESTLESS']))}`, color: STAGE.awake },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}
