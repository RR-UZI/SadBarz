// Beeps, voice cues and vibration for the timer.
// Web: beeps are generated with the Web Audio API, voice uses speechSynthesis.
// Phone: vibration now; real sounds come with expo-audio in the phone phase.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { Language } from '../types';

type AudioCtx = {
  currentTime: number;
  state: string;
  destination: unknown;
  resume: () => Promise<void>;
  createOscillator: () => any;
  createGain: () => any;
};

let ctx: AudioCtx | null = null;
let volume = 0.8;

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
}

// Browsers only allow sound after a tap, so call this from Start buttons.
export function unlockAudio() {
  if (Platform.OS !== 'web') return;
  try {
    const g = globalThis as any;
    const Ctor = g.AudioContext || g.webkitAudioContext;
    if (!Ctor) return;
    if (!ctx) ctx = new Ctor();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, startOffset: number, duration: number) {
  if (!ctx || volume <= 0) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + startOffset;
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.25 * volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    // ignore audio errors, the timer keeps going
  }
}

function buzz(style: 'light' | 'heavy' | 'success', vibration: boolean) {
  if (!vibration || Platform.OS === 'web') return;
  try {
    if (style === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.impactAsync(style === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // no haptics available
  }
}

export const sounds = {
  tick(vibration: boolean) {
    tone(880, 0, 0.09);
    buzz('light', vibration);
  },
  start(vibration: boolean) {
    tone(1320, 0, 0.12);
    tone(1760, 0.14, 0.35);
    buzz('heavy', vibration);
  },
  round(vibration: boolean) {
    tone(1320, 0, 0.3);
    buzz('heavy', vibration);
  },
  rest(vibration: boolean) {
    tone(660, 0, 0.3);
    buzz('light', vibration);
  },
  end(vibration: boolean) {
    tone(1320, 0, 0.18);
    tone(1320, 0.25, 0.18);
    tone(1760, 0.5, 0.6);
    buzz('success', vibration);
  },
};

export function speak(text: string, lang: Language) {
  if (Platform.OS !== 'web') return;
  try {
    const synth = (globalThis as any).speechSynthesis;
    const Utter = (globalThis as any).SpeechSynthesisUtterance;
    if (!synth || !Utter) return;
    const u = new Utter(text);
    u.lang = lang === 'es' ? 'es-MX' : 'en-US';
    u.volume = volume;
    synth.cancel();
    synth.speak(u);
  } catch {
    // no voice available
  }
}
