// Plan codes: the card where Uzi sees a plan's code to share it, and the one in
// Rutinas where an athlete redeems a code to get that plan's routines.
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';

import { useT } from '../i18n';
import { cloneBlock } from '../lib/blocks';
import { redeemCode, redeemedPlans, type RedeemError } from '../lib/coach';
import { uid } from '../lib/util';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, font, space } from '../theme';
import { longDate } from './onboarding';
import { Button, Card, Field, Row, Txt } from './ui';

async function copyText(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  await Share.share({ message: text }).catch(() => {});
  return false;
}

export function PlanCodeCard({ code, body, style }: { code: string; body: string; style?: object }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Card style={style}>
      <Txt variant="label">{t('code.title')}</Txt>
      <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
        <Text selectable style={{ color: colors.accent, fontSize: 24, fontWeight: '800', letterSpacing: 2, fontFamily: Platform.OS === 'web' ? 'ui-monospace, Menlo, monospace' : undefined }}>
          {code}
        </Text>
        <Button
          label={copied ? t('code.copied') : Platform.OS === 'web' ? t('code.copy') : t('code.share')}
          size="sm"
          variant="secondary"
          onPress={async () => {
            if (await copyText(code)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
        />
      </Row>
      <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
        {body}
      </Txt>
    </Card>
  );
}

const ERRORS: Record<RedeemError, 'code.notFound' | 'code.limit' | 'code.auth' | 'code.offline' | 'code.failed'> = {
  not_found: 'code.notFound',
  limit: 'code.limit',
  auth: 'code.auth',
  offline: 'code.offline',
  failed: 'code.failed',
};

export function RedeemCard() {
  const t = useT();
  const { user } = useAuth();
  const { routines, exercises, settings, saveRoutine, addExercise } = useApp();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const redeem = async () => {
    setBusy(true);
    setResult(null);
    const res = await redeemCode(code);
    setBusy(false);
    if (!res.ok) {
      const next = res.next ? longDate(res.next, settings.language) : '';
      setResult({ ok: false, text: t(ERRORS[res.error], { date: next }) });
      return;
    }
    const { plan } = res;
    if (routines.some((r) => r.fromCode === plan.code)) {
      setResult({ ok: true, text: t('code.already', { code: plan.code }) });
      return;
    }
    // Exercises the routines use that this athlete doesn't have (the original athlete's own ones).
    const have = new Set(exercises.map((e) => e.id));
    plan.exercises.filter((e) => !have.has(e.id)).forEach((e) => addExercise({ id: e.id, name: e.name, kind: e.kind, category: e.category }));
    const now = Date.now();
    // saveRoutine puts each new one first, so add them last day first to keep Monday on top.
    [...plan.days].reverse().forEach((d, i) =>
      saveRoutine({
        ...d.routine,
        id: uid('rt'),
        blocks: d.routine.blocks.map(cloneBlock),
        example: undefined,
        fromCode: plan.code,
        codeDay: d.day,
        createdAt: now + i,
        updatedAt: now + i,
      }),
    );
    setCode('');
    setResult({ ok: true, text: t(plan.days.length === 1 ? 'code.addedOne' : 'code.added', { n: plan.days.length, code: plan.code }) });
  };

  if (!open) {
    return <Button label={t('code.redeem')} variant="ghost" size="sm" onPress={() => setOpen(true)} style={{ marginTop: space.sm }} />;
  }
  return (
    <Card style={{ marginTop: space.md }}>
      <Txt variant="label">{t('code.redeemTitle')}</Txt>
      <Txt variant="small" color={colors.muted} style={{ marginTop: space.xs }}>
        {user?.plan === 'pro' ? t('code.redeemPro') : t('code.redeemFree')}
      </Txt>
      <View style={{ marginTop: space.md }}>
        <Field
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder="SB-7K4QXM"
          inputProps={{ autoCapitalize: 'characters', autoCorrect: false, onSubmitEditing: () => code.trim() && !busy && redeem() }}
        />
      </View>
      {result ? (
        <Txt color={result.ok ? colors.success : colors.warn} style={{ marginTop: space.sm, fontSize: font.small }}>
          {result.text}
        </Txt>
      ) : null}
      <Row style={{ marginTop: space.md, justifyContent: 'flex-end' }}>
        <Button
          label={t('code.close')}
          variant="ghost"
          size="sm"
          onPress={() => {
            setOpen(false);
            setResult(null);
          }}
        />
        <Button label={busy ? t('code.redeeming') : t('code.redeemButton')} size="sm" disabled={!code.trim() || busy} onPress={redeem} />
      </Row>
    </Card>
  );
}

// ---------- Keeping code routines up to date ----------

let lastCheck = 0;

/**
 * Routines from a code follow the plan: when Uzi fixes the plan, the copies here are replaced with
 * the new version (same routines, so past workouts stay linked). Checked at most once a minute.
 */
export function useCodeRoutineUpdates() {
  const { user } = useAuth();
  const { ready, routines, exercises, saveRoutine, deleteRoutine, addExercise } = useApp();
  const live = useRef({ routines, exercises });
  live.current = { routines, exercises };
  const codes = [...new Set(routines.map((r) => r.fromCode).filter((c): c is string => !!c))].sort().join(',');

  useEffect(() => {
    if (!user || !ready || !codes || Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    redeemedPlans(codes.split(',')).then((plans) => {
      plans?.forEach((plan) => {
        const mine = live.current.routines.filter((r) => r.fromCode === plan.code);
        if (mine.every((r) => r.codeVersion === plan.version)) return;
        const have = new Set(live.current.exercises.map((e) => e.id));
        plan.exercises.filter((e) => !have.has(e.id)).forEach((e) => addExercise({ id: e.id, name: e.name, kind: e.kind, category: e.category }));
        // Copies redeemed before days were stored were added last day first, so newest first is day order.
        const byDay = new Map(mine.filter((r) => r.codeDay != null).map((r) => [r.codeDay, r]));
        const older = mine.filter((r) => r.codeDay == null).sort((a, b) => b.createdAt - a.createdAt);
        const now = Date.now();
        const kept = new Set<string>();
        [...plan.days].reverse().forEach((d, i) => {
          const day = plan.days.length - 1 - i;
          const current = byDay.get(d.day) ?? older[day];
          if (current) kept.add(current.id);
          saveRoutine({
            ...(current ?? { id: uid('rt'), createdAt: now + i }),
            name: d.routine.name,
            note: d.routine.note,
            blocks: d.routine.blocks.map(cloneBlock),
            fromCode: plan.code,
            codeDay: d.day,
            codeVersion: plan.version,
            updatedAt: now,
          });
        });
        // Days the plan no longer has.
        mine.filter((r) => !kept.has(r.id)).forEach((r) => deleteRoutine(r.id));
      });
    });
  }, [user, ready, codes, saveRoutine, deleteRoutine, addExercise]);
}
