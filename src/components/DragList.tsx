// A vertical list whose rows can be dragged to change their order.
// On web: press and hold a row, then drag it (a quick swipe still scrolls the page). On native: drag the handle.
import React, { useRef, useState } from 'react';
import { Animated, PanResponder, type PanResponderInstance, Platform, View } from 'react-native';

import { useT } from '../i18n';
import { colors } from '../theme';
import { Txt } from './ui';

type Drag = { from: number; to: number };

const WEB = Platform.OS === 'web';
const HOLD_MS = 300; // how long to press before the row lifts
const SLOP = 8; // moving more than this before then means the finger is scrolling

export function DragList<T>({
  items,
  keyOf,
  onMove,
  renderItem,
  gap = 0,
}: {
  items: T[];
  keyOf: (item: T) => string;
  onMove: (from: number, to: number) => void;
  // `handle` is the grip to place somewhere in the row (null on web, where the whole row is the grip).
  renderItem: (item: T, index: number, handle: React.ReactNode) => React.ReactNode;
  gap?: number;
}) {
  const t = useT();
  const [drag, setDrag] = useState<Drag | null>(null);
  const dy = useRef(new Animated.Value(0)).current;
  // Row heights. Positions are summed from these: on web onLayout only fires when a size changes, so a measured y goes stale after a reorder.
  const heights = useRef<Record<string, number>>({});
  const responders = useRef<Record<string, PanResponderInstance>>({});
  // Handlers are created once per row, so they read the latest values from here.
  const live = useRef({ keys: [] as string[], drag: null as Drag | null, onMove, gap });
  live.current.keys = items.map(keyOf);
  live.current.onMove = onMove;
  live.current.gap = gap;

  const update = (next: Drag | null) => {
    live.current.drag = next;
    setDrag(next);
  };

  // Where the dragged row lands: above every row whose middle its top edge has passed, below every row whose middle its bottom edge has passed.
  const target = (from: number, offset: number) => {
    const keys = live.current.keys;
    const tops: number[] = [];
    let y = 0;
    keys.forEach((k) => {
      tops.push(y);
      y += (heights.current[k] ?? 0) + live.current.gap;
    });
    const mid = (j: number) => tops[j] + (heights.current[keys[j]] ?? 0) / 2;
    const top = tops[from] + offset;
    const bottom = top + (heights.current[keys[from]] ?? 0);
    let to = from;
    keys.forEach((_, j) => {
      if (j < from && top < mid(j)) to--;
      if (j > from && bottom > mid(j)) to++;
    });
    return to;
  };

  const finish = () => {
    const d = live.current.drag;
    dy.setValue(0);
    update(null);
    if (d && d.to !== d.from) live.current.onMove(d.from, d.to);
  };

  const responderFor = (key: string) => {
    if (responders.current[key]) return responders.current[key];
    const r = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        const from = live.current.keys.indexOf(key);
        if (from < 0) return;
        dy.setValue(0);
        update({ from, to: from });
      },
      onPanResponderMove: (_, g) => {
        const d = live.current.drag;
        if (!d) return;
        dy.setValue(g.dy);
        const to = target(d.from, g.dy);
        if (to !== d.to) update({ ...d, to });
      },
      onPanResponderRelease: () => finish(),
      onPanResponderTerminate: () => finish(),
    });
    responders.current[key] = r;
    return r;
  };

  // Web: hold anywhere on the row (except a text field) to lift it, then drag.
  const cleanups = useRef<Record<string, () => void>>({});
  // One ref callback per row, kept across renders, so the listeners aren't removed mid-drag.
  const refs = useRef<Record<string, (node: unknown) => void>>({});
  const holdable = (key: string) => (refs.current[key] ??= (node: unknown) => {
    cleanups.current[key]?.();
    delete cleanups.current[key];
    const el = node as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let startX = 0;
    let startY = 0;
    let active = false;
    const noScroll = (e: TouchEvent) => e.preventDefault();
    const noClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('touchmove', noScroll);
    };
    const lift = () => {
      const from = live.current.keys.indexOf(key);
      if (from < 0) return stop();
      active = true;
      document.addEventListener('touchmove', noScroll, { passive: false });
      window.getSelection?.()?.removeAllRanges();
      (navigator as { vibrate?: (ms: number) => void }).vibrate?.(10);
      dy.setValue(0);
      update({ from, to: from });
    };
    const onMove = (e: PointerEvent) => {
      if (!active) {
        if (Math.abs(e.clientX - startX) > SLOP || Math.abs(e.clientY - startY) > SLOP) stop();
        return;
      }
      e.preventDefault();
      const d = live.current.drag;
      if (!d) return;
      const offset = e.clientY - startY;
      dy.setValue(offset);
      const to = target(d.from, offset);
      if (to !== d.to) update({ ...d, to });
    };
    const onUp = () => {
      stop();
      if (!active) return;
      active = false;
      // the release would also count as a tap on whatever button is under the finger
      window.addEventListener('click', noClick, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', noClick, { capture: true }), 50);
      finish();
    };
    const onCancel = () => {
      stop();
      if (active) {
        active = false;
        finish();
      }
    };
    const onDown = (e: PointerEvent) => {
      // In nested lists (sets rows and their exercises) the innermost row takes the press.
      const ev = e as PointerEvent & { dragClaimed?: boolean };
      if (e.button !== 0 || live.current.drag || ev.dragClaimed) return;
      ev.dragClaimed = true;
      const hit = e.target as HTMLElement | null;
      if (hit?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      startX = e.clientX;
      startY = e.clientY;
      active = false;
      stop();
      timer = setTimeout(lift, HOLD_MS);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    };
    // a long press would otherwise open the phone's text selection or menu
    const noMenu = (e: Event) => {
      if (timer !== undefined || active) e.preventDefault();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('contextmenu', noMenu);
    el.addEventListener('selectstart', noMenu);
    cleanups.current[key] = () => {
      stop();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('contextmenu', noMenu);
      el.removeEventListener('selectstart', noMenu);
    };
  });

  // How far the other rows step aside to make room.
  const shift = (j: number) => {
    if (!drag || j === drag.from) return 0;
    const size = (heights.current[live.current.keys[drag.from]] ?? 0) + gap;
    if (drag.from < drag.to && j > drag.from && j <= drag.to) return -size;
    if (drag.to < drag.from && j >= drag.to && j < drag.from) return size;
    return 0;
  };

  return (
    <View style={{ gap }}>
      {items.map((item, i) => {
        const key = keyOf(item);
        const dragging = drag?.from === i;
        const handle = WEB ? null : (
          <View
            {...responderFor(key).panHandlers}
            accessibilityLabel={t('block.drag')}
            hitSlop={8}
            // touchAction keeps the browser from scrolling the page while a finger drags the grip.
            style={[{ paddingHorizontal: 6, paddingVertical: 2, cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }, { touchAction: 'none' } as object]}
          >
            <Txt color={dragging ? colors.accent : colors.muted} style={{ fontSize: 20, lineHeight: 22 }}>
              ≡
            </Txt>
          </View>
        );
        return (
          <Animated.View
            key={key}
            onLayout={(e) => {
              heights.current[key] = e.nativeEvent.layout.height;
            }}
            style={{
              transform: [{ translateY: dragging ? dy : shift(i) }, { scale: dragging ? 1.02 : 1 }],
              ...(WEB ? ({ cursor: dragging ? 'grabbing' : undefined, WebkitTouchCallout: 'none' } as object) : null),
              zIndex: dragging ? 10 : 0,
                            ...(dragging ? { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 } : null),
            }}
          >
            <View ref={WEB ? (holdable(key) as never) : undefined}>{renderItem(item, i, handle)}</View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
