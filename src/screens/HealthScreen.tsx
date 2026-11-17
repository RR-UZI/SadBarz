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
  localDay,
  syncGoogle,
  type HealthDay,
  type HealthLink,
} from '../lib/health';
import { hm, insights, readiness, summary, type Days, type Metric } from '../lib/healthStats';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, radius, space } from '../theme';

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
const SYNC_AFTER_MS = 3 * 3600_000; // syncs again when the last one is older than this

const STAGE = { deep: '#2F6BFF', rem: '#9B7BFF', light: '#6FC3FF', awake: '#5C5C66' };

export function HealthScreen() {
  const t = useT();
  const { settings, workouts } = useApp();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const locale = settings.language === 'es' ? 'es-MX' : 'en-US';
  const today = localDay();

  const [range, setRange] = useState<Range>(7);
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
  const ready = readiness(days, today);
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

        {hasData ? <ReadinessCard r={ready} /> : null}
        {hasData ? (
          <>

        <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r, label: t(`health.range.${r}` as StringKey) }))} />

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

function ReadinessCard({ r }: { r: ReturnType<typeof readiness> }) {
  const t = useT();
  const color = r.level === 'ready' ? colors.success : r.level === 'easy' ? colors.warn : r.level === 'normal' ? colors.accent : colors.faint;
  return (
    <Card>
      <Txt variant="small" color={colors.muted}>
        {t('health.today')}
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
