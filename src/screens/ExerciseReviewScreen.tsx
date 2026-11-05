// Admins only: exercises people made, waiting to join the shared pool everyone sees.
// Approve (fixing the name or group first if needed) or reject; rejected ones stay with their maker.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Badge, Button, Card, Chip, Field, Row, Screen, Section, Txt } from '../components/ui';
import { useT } from '../i18n';
import { confirm } from '../lib/confirm';
import { exercisesToReview, refreshPool, reviewExercise, type WaitingExercise } from '../lib/exercisePool';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, space } from '../theme';
import type { Category, Exercise } from '../types';

const CATEGORIES: Category[] = ['push', 'pull', 'tubos', 'legs', 'core', 'skills', 'cardio'];
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

export function ExerciseReviewScreen() {
  const t = useT();
  const nav = useNav();
  const { user } = useAuth();
  const [list, setList] = useState<WaitingExercise[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Name and group as edited on each card, so Approve all uses the fixes too.
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [progress, setProgress] = useState<number | null>(null);
  const { exercises } = useApp();

  const load = useCallback(() => {
    exercisesToReview()
      .then((l) => {
        setList(l);
        setFailed(null);
      })
      .catch((e: unknown) => setFailed(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const editOf = (ex: WaitingExercise): Edit => edits[ex.id] ?? { name: ex.name.trim(), category: ex.category };
  const ready = (list ?? []).filter((ex) => editOf(ex).name.trim());
  const twins = ready.filter((ex) => twinOf(exercises, ex.id, editOf(ex).name)).length;

  // One at a time, so a failure stops it with the approved ones already off the list.
  const approveAll = () => {
    const todo = ready;
    confirm(
      t('exReview.approveAllAsk', { n: todo.length }) + (twins ? `\n\n${t('exReview.approveAllTwins', { n: twins })}` : ''),
      async () => {
        setFailed(null);
        let done = 0;
        setProgress(0);
        try {
          for (const ex of todo) {
            const e = editOf(ex);
            await reviewExercise(ex, true, e.name, e.category, false);
            done += 1;
            setProgress(done);
            setList((l) => l?.filter((x) => x.id !== ex.id) ?? l);
          }
        } catch (err) {
          setFailed(errorText(err));
        }
        setProgress(null);
        if (done) refreshPool(true).catch(() => {});
      },
      t('exReview.approveAll'),
      t('common.cancel'),
    );
  };

  if (!user?.admin) {
    return (
      <Screen title={t('exReview.title')} onBack={nav.pop}>
        <Txt color={colors.muted}>—</Txt>
      </Screen>
    );
  }

  return (
    <Screen title={t('exReview.title')} onBack={nav.pop}>
      <Txt variant="small" color={colors.muted}>
        {t('exReview.help')}
      </Txt>
      {failed ? (
        <Txt color={colors.danger} style={{ marginTop: space.md }}>
          {t('users.error', { e: failed })}
        </Txt>
      ) : null}
      {!list ? (
        failed ? null : <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : list.length === 0 ? (
        <Txt color={colors.muted} style={{ marginTop: space.xl }}>
          {t('exReview.none')}
        </Txt>
      ) : (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          {list.length > 1 ? (
            <Button
              label={progress !== null ? t('exReview.approving', { n: progress, total: progress + list.length }) : `✓ ${t('exReview.approveAll')} (${ready.length})`}
              disabled={progress !== null || !ready.length}
              onPress={approveAll}
            />
          ) : null}
          {list.map((ex) => (
            <WaitingCard
              key={ex.id}
              ex={ex}
              edit={editOf(ex)}
              onEdit={(e) => setEdits((m) => ({ ...m, [ex.id]: e }))}
              locked={progress !== null}
              onDone={() => setList((l) => l?.filter((x) => x.id !== ex.id) ?? l)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

type Edit = { name: string; category: Category };

// One with the same name already in everyone's list (built in or approved): probably a duplicate.
const twinOf = (exercises: Exercise[], id: string, name: string) => exercises.find((e) => e.id !== id && !e.custom && norm(e.name) === norm(name));

function WaitingCard({ ex, edit, onEdit, locked, onDone }: { ex: WaitingExercise; edit: Edit; onEdit: (e: Edit) => void; locked: boolean; onDone: () => void }) {
  const t = useT();
  const { exercises } = useApp();
  const { name, category } = edit;
  const setName = (v: string) => onEdit({ name: v, category });
  const setCategory = (c: Category) => onEdit({ name, category: c });
  const [working, setBusy] = useState(false);
  const busy = working || locked;
  const [problem, setProblem] = useState<string | null>(null);

  const twin = useMemo(() => twinOf(exercises, ex.id, name), [exercises, ex.id, name]);

  const decide = (approve: boolean) => {
    setBusy(true);
    setProblem(null);
    reviewExercise(ex, approve, name, category)
      .then(onDone)
      .catch((e: unknown) => {
        setProblem(errorText(e));
        setBusy(false);
      });
  };

  return (
    <Card>
      <Field value={name} onChangeText={setName} />
      <Row gap={6} style={{ marginTop: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge label={t(`exercise.kind.${ex.kind}`)} />
        <Txt variant="small" color={colors.muted} style={{ flexShrink: 1 }}>
          {t('exReview.from', { who: ex.userName || ex.email || t('review.athlete') })}
          {ex.userName && ex.email ? ` · ${ex.email}` : ''}
          {ex.accounts > 1 ? ` · ${t('exReview.accounts', { n: ex.accounts })}` : ''}
        </Txt>
      </Row>
      <Row style={{ flexWrap: 'wrap', marginTop: space.sm }}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={t(`cat.${c}`)} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </Row>
      {twin ? (
        <Txt variant="small" color={colors.warn} style={{ marginTop: space.sm }}>
          {t('exReview.twin', { name: twin.name })}
        </Txt>
      ) : null}
      {problem ? (
        <Txt variant="small" color={colors.danger} style={{ marginTop: space.sm }}>
          {t('users.error', { e: problem })}
        </Txt>
      ) : null}
      <Row style={{ marginTop: space.md }}>
        <Button label={t('exReview.reject')} variant="ghost" flex disabled={busy} onPress={() => decide(false)} />
        <Button label={`✓ ${t('exReview.approve')}`} flex disabled={busy || !name.trim()} onPress={() => decide(true)} />
      </Row>
    </Card>
  );
}

// ---------- Home card (admins only) ----------

export function ExerciseReviewHomeCard() {
  const t = useT();
  const nav = useNav();
  const [waiting, setWaiting] = useState<number | null>(null);
  useEffect(() => {
    const load = () =>
      exercisesToReview()
        .then((l) => setWaiting(l.length))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Section title={t('exReview.title')} right={waiting ? <Badge label={String(waiting)} color={colors.accent} textColor={colors.accentText} /> : undefined}>
      <Card>
        <Txt>{waiting ? t('exReview.homeBody', { n: waiting }) : t('exReview.homeNone')}</Txt>
        <Button label={t('exReview.open')} size="sm" variant={waiting ? 'primary' : 'secondary'} style={{ marginTop: space.md }} onPress={() => nav.push({ name: 'exerciseReview' })} />
      </Card>
    </Section>
  );
}
