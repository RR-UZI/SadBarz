import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { Badge, Button, Card, Row, Screen, Section, Txt } from '../components/ui';
import { useT } from '../i18n';
import { formatLabel } from '../lib/blocks';
import { startOfWeek } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import { WorkoutCard } from './HistoryScreen';

export function HomeScreen() {
  const t = useT();
  const { routines, workouts } = useApp();
  const nav = useNav();

  const weekStart = startOfWeek(Date.now());
  const thisWeek = workouts.filter((w) => w.startedAt >= weekStart);
  const minutes = Math.round(thisWeek.reduce((s, w) => s + (w.finishedAt - w.startedAt), 0) / 60000);
  const last = workouts[0];

  return (
    <Screen
      right={
        <Pressable onPress={() => nav.push({ name: 'settings' })} hitSlop={10} accessibilityLabel={t('settings.title')} style={{ padding: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 24 }}>⚙</Text>
        </Pressable>
      }
      title=" "
      mark
    >
      <View style={{ alignItems: 'center', marginTop: space.sm, marginBottom: space.lg }}>
        <Image source={require('../../assets/logo-wordmark.png')} style={{ width: 240, height: 91 }} resizeMode="contain" accessibilityLabel="SadBarz" />
        <Txt variant="h2" style={{ marginTop: space.md }}>
          {t('home.hello')}
        </Txt>
      </View>

      <Card>
        <Txt variant="label">{t('home.thisWeek')}</Txt>
        <Row gap={space.xl} style={{ marginTop: space.sm }}>
          <View>
            <Txt variant="title" color={colors.accent}>
              {thisWeek.length}
            </Txt>
            <Txt variant="small" color={colors.muted}>
              {t('home.workouts')}
            </Txt>
          </View>
          <View>
            <Txt variant="title">{minutes}</Txt>
            <Txt variant="small" color={colors.muted}>
              {t('home.minutes')}
            </Txt>
          </View>
        </Row>
      </Card>

      <Section title={t('home.lastWorkout')}>
        {last ? <WorkoutCard workout={last} /> : <Txt color={colors.muted}>{t('home.noWorkouts')}</Txt>}
      </Section>

      <Section title={t('home.quickStart')}>
        <View style={{ gap: space.sm }}>
          {routines.slice(0, 4).map((r) => (
            <Card key={r.id} onPress={() => nav.push({ name: 'routine', id: r.id })} style={{ paddingVertical: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }} numberOfLines={1}>
                    {r.name}
                  </Txt>
                  <Txt variant="small" color={colors.muted} numberOfLines={1}>
                    {r.blocks.map((b) => b.title || formatLabel(b, t('common.rounds'), t('common.sets'))).join(' · ')}
                  </Txt>
                </View>
                <Button label={t('common.start')} size="sm" onPress={() => nav.push({ name: 'workout', routineId: r.id })} />
              </Row>
            </Card>
          ))}
        </View>
      </Section>

      <Section title={t('home.coachTitle')} right={<Badge label="PRO" color={colors.accent} textColor={colors.accentText} />}>
        <Card style={{ borderColor: colors.faint, borderStyle: 'dashed' }}>
          <Txt>{t('home.coachBody')}</Txt>
          <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
            {t('home.soon')}
          </Txt>
        </Card>
      </Section>

      <Txt variant="tiny" color={colors.faint} style={{ textAlign: 'center', marginTop: space.xl }}>
        {t('home.prototype')}
      </Txt>
    </Screen>
  );
}
