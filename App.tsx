import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmHost } from './src/components/ConfirmHost';
import { LogoMark } from './src/components/Logo';
import { ProHost } from './src/components/ProHost';
import { useT } from './src/i18n';
import { NavProvider, useNav, type Route, type TabName } from './src/navigation';
import { AuthScreen } from './src/screens/AuthScreen';
import { HistoryScreen, WorkoutDetailScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { EditProfileScreen, OnboardingScreen } from './src/screens/OnboardingScreen';
import { RoutineDetailScreen } from './src/screens/RoutineDetailScreen';
import { RoutineEditorScreen } from './src/screens/RoutineEditorScreen';
import { RoutinesScreen } from './src/screens/RoutinesScreen';
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
          <NavProvider>
            <StatusBar style="light" />
            <Root />
            <ConfirmHost />
            <ProHost />
          </NavProvider>
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
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
  if (top) return <View style={{ flex: 1, backgroundColor: colors.bg }}>{renderRoute(top)}</View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'routines' && <RoutinesScreen />}
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
      return <RoutineEditorScreen id={r.id} />;
    case 'workout':
      return <WorkoutScreen routineId={r.routineId} />;
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
  }
}

const TABS: { name: TabName; icon: string }[] = [
  { name: 'home', icon: '⌂' },
  { name: 'routines', icon: '☰' },
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
