// Standalone timers, usable without a routine.
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { BlockRunner } from '../components/BlockRunner';
import { Button, Card, Chip, NumberField, Row, Screen, Txt } from '../components/ui';
import { useT } from '../i18n';
import { newBlock } from '../lib/blocks';
import { unlockAudio } from '../lib/sound';
import { useClock } from '../lib/useClock';
import { clock, shortDuration } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import type { Block } from '../types';
import { useKeepAwake } from './WorkoutScreen';

const INTERVALS = [30, 40, 45, 50, 60, 90, 120];

export function TimersScreen() {
  const t = useT();
  const nav = useNav();
  const [emomEvery, setEmomEvery] = useState(60);
  const [emomRounds, setEmomRounds] = useState(10);
  const [work, setWork] = useState(20);
  const [rest, setRest] = useState(10);
  const [tabRounds, setTabRounds] = useState(8);
  const [cdMin, setCdMin] = useState(5);
  const [cdSec, setCdSec] = useState(0);
  const [amrapMin, setAmrapMin] = useState(10);

  const launch = (block: Block, title: string) => {
    unlockAudio();
    nav.push({ name: 'quickTimer', block, title });
  };

  return (
    <Screen title={t('timers.title')} mark>
      <Txt color={colors.muted}>{t('timers.subtitle')}</Txt>

      <Card style={{ marginTop: space.lg, gap: space.md }}>
        <View>
          <Txt variant="h2">{t('timers.emom')}</Txt>
          <Txt variant="small" color={colors.muted}>
            {t('timers.emomHelp')}
          </Txt>
        </View>
        <Row style={{ flexWrap: 'wrap' }}>
          {INTERVALS.map((s) => (
            <Chip key={s} label={shortDuration(s)} active={emomEvery === s} onPress={() => setEmomEvery(s)} />
          ))}
        </Row>
        <Row gap={space.lg}>
          <NumberField label={t('block.rounds')} value={emomRounds} min={1} max={200} onChange={(v) => setEmomRounds(v ?? 1)} />
          <Txt color={colors.muted} style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
            = {clock(emomEvery * emomRounds)}
          </Txt>
        </Row>
        <Button
          label={`▶ ${t('common.start')}`}
          onPress={() =>
            launch({ ...newBlock('emom'), intervalSec: emomEvery, rounds: emomRounds }, `${emomEvery === 60 ? 'EMOM' : emomEvery === 120 ? 'EM2M' : `E${shortDuration(emomEvery)}`} · ${emomRounds}`)
          }
        />
      </Card>

      <Card style={{ marginTop: space.md, gap: space.md }}>
        <View>
          <Txt variant="h2">{t('timers.tabata')}</Txt>
          <Txt variant="small" color={colors.muted}>
            {t('timers.tabataHelp')}
          </Txt>
        </View>
        <Row gap={space.lg} style={{ flexWrap: 'wrap' }}>
          <NumberField label={`${t('block.work')} (s)`} value={work} min={1} max={600} step={5} onChange={(v) => setWork(v ?? 20)} />
          <NumberField label={`${t('block.rest')} (s)`} value={rest} min={0} max={600} step={5} onChange={(v) => setRest(v ?? 0)} />
          <NumberField label={t('block.rounds')} value={tabRounds} min={1} max={200} onChange={(v) => setTabRounds(v ?? 1)} />
        </Row>
        <Button
          label={`▶ ${t('common.start')}`}
          onPress={() => launch({ ...newBlock('tabata'), workSec: work, restSec: rest, rounds: tabRounds }, `Tabata ${shortDuration(work)} x ${shortDuration(rest)}`)}
        />
      </Card>

      <Card style={{ marginTop: space.md, gap: space.md }}>
        <View>
          <Txt variant="h2">{t('timers.amrap')}</Txt>
          <Txt variant="small" color={colors.muted}>
            {t('timers.amrapHelp')}
          </Txt>
        </View>
        <NumberField label={t('timers.minutes')} value={amrapMin} min={1} max={120} onChange={(v) => setAmrapMin(v ?? 10)} />
        <Button label={`▶ ${t('common.start')}`} onPress={() => launch({ ...newBlock('amrap'), capSec: amrapMin * 60 }, `AMRAP ${amrapMin} min`)} />
      </Card>

      <Card style={{ marginTop: space.md, gap: space.md }}>
        <View>
          <Txt variant="h2">{t('timers.countdown')}</Txt>
          <Txt variant="small" color={colors.muted}>
            {t('timers.countdownHelp')}
          </Txt>
        </View>
        <Row gap={space.lg}>
          <NumberField label={t('timers.minutes')} value={cdMin} min={0} max={180} onChange={(v) => setCdMin(v ?? 0)} />
          <NumberField label={t('timers.seconds')} value={cdSec} min={0} max={59} step={5} onChange={(v) => setCdSec(v ?? 0)} />
        </Row>
        <Button
          label={`▶ ${t('common.start')}`}
          disabled={cdMin * 60 + cdSec === 0}
          onPress={() => launch({ ...newBlock('emom'), intervalSec: cdMin * 60 + cdSec, rounds: 1 }, clock(cdMin * 60 + cdSec))}
        />
      </Card>

      <Card style={{ marginTop: space.md, gap: space.md }}>
        <View>
          <Txt variant="h2">{t('timers.stopwatch')}</Txt>
          <Txt variant="small" color={colors.muted}>
            {t('timers.stopwatchHelp')}
          </Txt>
        </View>
        <Button label={`▶ ${t('common.start')}`} onPress={() => nav.push({ name: 'stopwatch' })} />
      </Card>
    </Screen>
  );
}

export function QuickTimerScreen({ block, title }: { block: Block; title: string }) {
  const t = useT();
  const nav = useNav();
  const { settings } = useApp();
  const [run, setRun] = useState(1);
  const [finished, setFinished] = useState(false);
  useKeepAwake(settings.keepAwake);

  return (
    <Screen title={title} onBack={nav.pop}>
      {finished ? (
        <View style={{ alignItems: 'center', gap: space.lg, marginTop: space.xxl }}>
          <Txt variant="title" color={colors.success}>
            {t('run.blockFinished')}
          </Txt>
          <Row>
            <Button
              label={`↻ ${t('run.repeat')}`}
              variant="secondary"
              onPress={() => {
                unlockAudio();
                setFinished(false);
                setRun((r) => r + 1);
              }}
            />
            <Button label={t('common.done')} onPress={nav.pop} />
          </Row>
        </View>
      ) : (
        <BlockRunner key={run} block={block} onFinish={() => setFinished(true)} />
      )}
    </Screen>
  );
}

export function StopwatchScreen() {
  const t = useT();
  const nav = useNav();
  const { settings } = useApp();
  const c = useClock(50);
  const [laps, setLaps] = useState<number[]>([]);
  const lastLap = useRef(0);
  useKeepAwake(settings.keepAwake && c.running);

  useEffect(() => {
    c.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sec = c.elapsedMs / 1000;
  const tenths = Math.floor((c.elapsedMs % 1000) / 100);

  return (
    <Screen title={t('timers.stopwatch')} onBack={nav.pop}>
      <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
        <Txt style={{ fontSize: 88, fontWeight: '900', color: colors.accent, fontVariant: ['tabular-nums'], lineHeight: 100 }}>
          {clock(Math.floor(sec))}
          <Txt style={{ fontSize: 40, fontWeight: '800' }} color={colors.muted}>
            .{tenths}
          </Txt>
        </Txt>
      </View>
      <Row>
        <Button label={c.running ? t('common.pause') : t('common.resume')} variant="secondary" size="lg" flex onPress={() => (c.running ? c.pause() : c.start())} />
        <Button
          label={t('timers.lap')}
          size="lg"
          flex
          disabled={!c.running}
          onPress={() => {
            setLaps((l) => [c.elapsedMs - lastLap.current, ...l]);
            lastLap.current = c.elapsedMs;
          }}
        />
      </Row>
      <Button
        label={t('timers.reset')}
        variant="ghost"
        style={{ marginTop: space.sm }}
        onPress={() => {
          c.reset(0, false);
          setLaps([]);
          lastLap.current = 0;
        }}
      />
      <View style={{ marginTop: space.lg }}>
        {laps.map((ms, i) => (
          <Row key={laps.length - i} style={{ justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Txt color={colors.muted}>
              {t('timers.lap')} {laps.length - i}
            </Txt>
            <Txt style={{ fontVariant: ['tabular-nums'], fontWeight: '700' }}>
              {clock(Math.floor(ms / 1000))}.{Math.floor((ms % 1000) / 100)}
            </Txt>
          </Row>
        ))}
      </View>
    </Screen>
  );
}
