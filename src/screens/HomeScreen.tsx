import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { CoachCard } from '../components/CoachCard';
import { useCodeRoutineUpdates } from '../components/PlanCode';
import { Badge, Button, Card, Row, Screen, Section, Txt } from '../components/ui';
import { WEEK_ROUTINE_IDS } from '../data/seed';
import { useT } from '../i18n';
import { formatLabel } from '../lib/blocks';
import { fullProfile } from '../lib/questionnaire';
import { syncEnabled } from '../lib/sync';
import { startOfWeek } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, space } from '../theme';
import { ReviewHomeCard } from './CoachReviewScreen';
import { MyPlanHomeCard } from './MyPlanScreen';
import { WorkoutCard } from './HistoryScreen';

export function HomeScreen() {
  useCodeRoutineUpdates();
  const t = useT();
  const { routines, workouts, avatar } = useApp();
  const { user, setPlanView } = useAuth();
  const proMissing = user?.plan === 'pro' && !!user.profile && !fullProfile(user.profile);
  const nav = useNav();

  const weekStart = startOfWeek(Date.now());
  const thisWeek = workouts.filter((w) => w.startedAt >= weekStart);
  const minutes = Math.round(thisWeek.reduce((s, w) => s + (w.finishedAt - w.startedAt), 0) / 60000);
  const last = workouts[0];
  // The example week first (Monday to Friday, whatever order they're saved in), then the user's own.
  const week = WEEK_ROUTINE_IDS.map((id) => routines.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
  const quick = [...week, ...routines.filter((r) => !WEEK_ROUTINE_IDS.includes(r.id))].slice(0, 5);

  return (
    <Screen
      right={
        <Row gap={space.xs}>
          {user?.admin ? (
            // Admin only: one tap flips the app between Free and Pro to try both.
            <Pressable
              onPress={() => setPlanView(user.plan === 'pro' ? 'free' : 'pro')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('settings.planView')}
              style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.accent, backgroundColor: user.plan === 'pro' ? colors.accent : 'transparent' }}
            >
              <Text style={{ color: user.plan === 'pro' ? colors.accentText : colors.accent, fontWeight: '800', fontSize: 12 }}>
                {user.plan === 'pro' ? 'PRO' : t('settings.planViewFree').toUpperCase()}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => nav.push({ name: 'settings' })} hitSlop={10} accessibilityLabel={t('settings.title')} style={{ padding: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 24 }}>⚙</Text>
          </Pressable>
          <Pressable onPress={() => nav.push({ name: 'profile' })} hitSlop={6} accessibilityLabel={t('profile.title')}>
            <Avatar uri={avatar} name={user?.name} size={34} />
          </Pressable>
        </Row>
      }
      title=" "
      mark
    >
      <View style={{ alignItems: 'center', marginTop: space.sm, marginBottom: space.lg }}>
        <Image source={require('../../assets/logo-wordmark.png')} style={{ width: 240, height: 91 }} resizeMode="contain" accessibilityLabel="SadBarz" />
        <Txt variant="h2" style={{ marginTop: space.md }}>
          {user ? t('home.helloName', { name: user.name.split(' ')[0] }) : t('home.hello')}
        </Txt>
      </View>

      {/* The coach's approved plan: today's routine first, it's what they came for. */}
      <MyPlanHomeCard />

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
          {quick.map((r) => (
            <Card key={r.id} onPress={() => nav.push({ name: 'routine', id: r.id })} style={{ paddingVertical: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }} numberOfLines={1}>
                    {r.name}
                  </Txt>
                  <Txt variant="small" color={colors.muted} numberOfLines={1}>
                    {r.blocks.map((b) => b.title || formatLabel(b, t('common.rounds'), t('common.sets'), t('common.cap'))).join(' · ')}
                  </Txt>
                </View>
                <Button label={t('common.start')} size="sm" onPress={() => nav.push({ name: 'workout', routineId: r.id })} />
              </Row>
            </Card>
          ))}
        </View>
      </Section>

      {/* Uzi's review list: real admins on a real account (the plans live on the server). */}
      {user?.admin && syncEnabled ? <ReviewHomeCard /> : null}

      <Section title={t('home.coachTitle')} right={<Badge label="PRO" color={colors.accent} textColor={colors.accentText} />}>
        {user?.plan === 'pro' && user.profile && !proMissing ? (
          <CoachCard />
        ) : (
          <Card style={{ borderColor: colors.faint, borderStyle: 'dashed' }}>
            <Txt>{proMissing ? t('home.completePro') : user?.profile ? t('home.coachReady') : t('home.coachBody')}</Txt>
            {user?.plan !== 'pro' ? (
              <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
                {t('home.soon')}
              </Txt>
            ) : null}
            {proMissing ? (
              <Button label={t('home.completeProButton')} size="sm" style={{ marginTop: space.md }} onPress={() => nav.push({ name: 'editProfile' })} />
            ) : user?.profile ? (
              <Button label={t('home.viewProfile')} variant="ghost" size="sm" style={{ marginTop: space.md }} onPress={() => nav.push({ name: 'editProfile' })} />
            ) : null}
          </Card>
        )}
      </Section>

      <Txt variant="tiny" color={colors.faint} style={{ textAlign: 'center', marginTop: space.xl }}>
        {t('home.prototype')}
      </Txt>
    </Screen>
  );
}
