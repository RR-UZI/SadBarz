// Tiny stack navigator: tabs at the bottom, full screens pushed on top.
// Kept simple on purpose so the web build works from any URL.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { Block, PersonalRecord } from './types';

export type TabName = 'home' | 'routines' | 'timers' | 'history';

export type Route =
  | { name: 'routine'; id: string }
  | { name: 'editRoutine'; id?: string }
  | { name: 'workout'; routineId: string }
  | { name: 'quickTimer'; block: Block; title: string }
  | { name: 'stopwatch' }
  | { name: 'workoutDetail'; id: string }
  | { name: 'settings' }
  | { name: 'editProfile' }
  | { name: 'profile' }
  | { name: 'editRecord'; id?: string; draft?: Partial<PersonalRecord> };

interface Nav {
  tab: TabName;
  setTab: (t: TabName) => void;
  stack: Route[];
  push: (r: Route) => void;
  pop: () => void;
  replace: (r: Route) => void;
  reset: (tab?: TabName) => void;
}

const NavContext = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<TabName>('home');
  const [stack, setStack] = useState<Route[]>([]);

  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), []);
  const reset = useCallback((t?: TabName) => {
    setStack([]);
    if (t) setTab(t);
  }, []);

  const value = useMemo(() => ({ tab, setTab, stack, push, pop, replace, reset }), [tab, stack, push, pop, replace, reset]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used inside NavProvider');
  return ctx;
}
