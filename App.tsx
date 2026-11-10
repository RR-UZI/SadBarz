import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmHost } from './src/components/ConfirmHost';
import { LogoMark } from './src/components/Logo';
import { ProHost } from './src/components/ProHost';
import { useT } from './src/i18n';
import { NavProvider, useNav, type Route, type TabName } from './src/navigation';
import { AdminUsersScreen } from './src/screens/AdminUsersScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { HistoryScreen, WorkoutDetailScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen, RecordEditorScreen } from './src/screens/ProfileScreen';
import { ExerciseReviewScreen } from './src/screens/ExerciseReviewScreen';
import { EditProfileScreen, OnboardingScreen } from './src/screens/OnboardingScreen';
import { RoutineDetailScreen } from './src/screens/RoutineDetailScreen';
import { RoutineEditorScreen } from './src/screens/RoutineEditorScreen';
import { RoutinesScreen } from './src/screens/RoutinesScreen';
import { CoachPlanScreen, CoachReviewScreen } from './src/screens/CoachReviewScreen';
import { CoachScreen } from './src/screens/CoachScreen';
import { MyPlanScreen } from './src/screens/MyPlanScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { QuickTimerScreen, StopwatchScreen, TimersScreen } from './src/screens/TimersScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { AppProvider, useApp } from './src/store/AppStore';
import { AuthProvider, useAuth } from './src/store/Auth';
import { colors } from './src/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <NavForUser>
            <StatusBar style="light" />
            <Root />
            <ConfirmHost />
            <ProHost />
          </NavForUser>
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// Each account starts on Home with no screens open. Signing in again used to bring back the screens left
// open, so a workout open at sign out reopened from its first block (and its saved progress was overwritten);
// now Home shows the unfinished workout to continue.
function NavForUser({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <NavProvider key={user?.id ?? ''}>{children}</NavProvider>;
}

// The session ended by itself (see sessionLost in store/Auth.tsx): everything keeps working on this device.
function SessionLostBanner() {
  const t = useT();
  const { signInAgain } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.surface2,
        borderBottomWidth: 1,
        borderBottomColor: colors.warn,
        paddingTop: insets.top + 8,
        paddingBottom: 8,
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ flex: 1, color: colors.text, fontSize: 13 }}>{t('auth.sessionLost')}</Text>
      <Pressable onPress={signInAgain} accessibilityRole="button" hitSlop={8}>
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 14 }}>{t('auth.signInAgain')}</Text>
      </Pressable>
    </View>
  );
}

function Root() {
  const { ready } = useApp();
  const auth = useAuth();
  const { stack, tab } = useNav();

  if (!ready || !auth.ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <LogoMark size={96} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!auth.user || auth.recovering) return <AuthScreen />;
  if (!auth.user.profile) return <OnboardingScreen />;

  const top = stack[stack.length - 1];
  // Not over a workout: signing in from there would leave it (it waits on Home either way).
  const banner = auth.sessionLost && top?.name !== 'workout' ? <SessionLostBanner /> : null;
  if (top)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {banner}
        {renderRoute(top)}
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {banner}
      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'routines' && <RoutinesScreen />}
        {tab === 'coach' && <CoachScreen />}
        {tab === 'timers' && <TimersScreen />}
        {tab === 'history' && <HistoryScreen />}
      </View>
      <TabBar />
    </View>
  );
}

function renderRoute(r: Route) {
  switch (r.name) {
    case 'routine':
      return <RoutineDetailScreen id={r.id} />;
    case 'editRoutine':
      return <RoutineEditorScreen id={r.id} draft={r.draft} onSave={r.onSave} />;
    case 'workout':
      return <WorkoutScreen routineId={r.routineId} routine={r.routine} resume={r.resume} />;
    case 'quickTimer':
      return <QuickTimerScreen block={r.block} title={r.title} />;
    case 'stopwatch':
      return <StopwatchScreen />;
    case 'workoutDetail':
      return <WorkoutDetailScreen id={r.id} />;
    case 'settings':
      return <SettingsScreen />;
    case 'editProfile':
      return <EditProfileScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'editRecord':
      return <RecordEditorScreen id={r.id} draft={r.draft} />;
    case 'coachReview':
      return <CoachReviewScreen />;
    case 'coachPlan':
      return <CoachPlanScreen id={r.id} />;
    case 'myPlan':
      return <MyPlanScreen />;
    case 'adminUsers':
      return <AdminUsersScreen />;
    case 'exerciseReview':
      return <ExerciseReviewScreen />;
  }
}

const TABS: { name: TabName; icon: string }[] = [
  { name: 'home', icon: '⌂' },
  { name: 'routines', icon: '☰' },
  { name: 'coach', icon: '' },
  { name: 'timers', icon: '' },
  { name: 'history', icon: '▤' },
];

function TabBar() {
  const t = useT();
  const { tab, setTab } = useNav();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        paddingBottom: Math.max(insets.bottom, 6),
        paddingTop: 6,
      }}
    >
      {TABS.map((tb) => {
        const active = tb.name === tab;
        return (
          <Pressable
            key={tb.name}
            onPress={() => setTab(tb.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}
          >
            {tb.name === 'timers' ? (
              <TimerIcon color={active ? colors.accent : colors.faint} />
            ) : tb.name === 'coach' ? (
              <ChatIcon color={active ? colors.accent : colors.faint} />
            ) : (
              <Text style={{ fontSize: 20, lineHeight: 24, color: active ? colors.accent : colors.faint }}>{tb.icon}</Text>
            )}
            <Text style={{ fontSize: 11, fontWeight: '700', color: active ? colors.accent : colors.muted, marginTop: 2 }}>{t(`tab.${tb.name}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Drawn speech bubble for the Coach tab (emoji bubbles don't take the tab's color).
function ChatIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 21, height: 15, borderRadius: 6, borderWidth: 2, borderColor: color, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: color }} />
        ))}
      </View>
      <View style={{ position: 'absolute', bottom: 2, left: 5, width: 0, height: 0, borderLeftWidth: 0, borderRightWidth: 6, borderTopWidth: 5, borderRightColor: 'transparent', borderTopColor: color }} />
    </View>
  );
}

// Drawn stopwatch, because the timer glyph is missing from some fonts.
function TimerIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ position: 'absolute', top: 0, width: 6, height: 3, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: color, alignItems: 'center' }}>
        <View style={{ width: 2, height: 7, backgroundColor: color, marginTop: 2, borderRadius: 1 }} />
      </View>
    </View>
  );
}
