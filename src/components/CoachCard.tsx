// Home card for a Pro athlete with a complete profile: pick a plan length and ask
// the coach for a plan, then "Tu coach está revisando tu plan" until Uzi approves it.
// Asking for a new plan after one asks a few questions first (goal, how the last plan felt,
// deload, injuries or sickness), so every plan fits where the athlete is now.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useT } from '../i18n';
import { askForPlan, coachStatus, isWaiting, planError, PLAN_WEEKS, type AskError, type CoachPlanStatus, type PlanCheckIn, type PlanWeeks } from '../lib/coach';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, space } from '../theme';
import { detailsDone } from '../lib/questionnaire';
import { GoalDetailsStep } from '../screens/GoalDetailsStep';
import type { Goal, GoalDetails, Profile } from '../types';
import { Button, Card, Chip, Field, Segmented, Txt } from './ui';

const GOALS: Goal[] = ['compete', 'strength', 'endurance', 'skills', 'statics', 'fitness'];

const POLL_MS = 30_000;
const ERRORS: Record<AskError, 'coach.limit' | 'coach.needProfile' | 'coach.needPro' | 'coach.failed'> = {
  limit: 'coach.limit',
  profile: 'coach.needProfile',
  pro: 'coach.needPro',
  failed: 'coach.failed',
};

export function CoachCard() {
  const t = useT();
  const { exercises, settings } = useApp();
  const [status, setStatus] = useState<CoachPlanStatus | null | undefined>(undefined); // undefined = loading
  const [weeks, setWeeks] = useState<PlanWeeks>(1);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<AskError | null>(null);
  // Admins also see the server's own words, to find what went wrong.
  const { user } = useAuth();
  const [detail, setDetail] = useState<string | null>(null);
  // The questions before a new plan: open once they tap "Get a new plan".
  const [checking, setChecking] = useState(false);
  const { saveProfile } = useAuth();

  const refresh = useCallback(() => {
    coachStatus()
      .then(setStatus)
      .catch(() => setStatus((s) => s ?? null));
  }, []);
  useEffect(refresh, [refresh]);
  useEffect(() => {
    if (user?.admin && status?.status === 'failed' && !error) planError(status.id).then((e) => e && setDetail(e));
  }, [user?.admin, status?.status, status?.id, error]);
  // While the coach writes or Uzi reviews, check back now and then.
  useEffect(() => {
    if (!isWaiting(status?.status)) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [status?.status, refresh]);

  const ask = async (checkIn?: PlanCheckIn, details?: GoalDetails) => {
    setAsking(true);
    setError(null);
    setDetail(null);
    // A new goal goes in their profile too, so the coach and the next plans know it.
    const profile = user?.profile;
    if (checkIn?.goalChanged && profile && profile.goal !== checkIn.goal) {
      const saved = await saveProfile({ ...profile, goal: checkIn.goal, details: details ?? profile.details, updatedAt: new Date().toISOString() });
      if (!saved.ok) {
        setAsking(false);
        setError('failed');
        setDetail(saved.error);
        return;
      }
    }
    const res = await askForPlan(weeks, exercises, settings.language, checkIn);
    setAsking(false);
    if (!res.ok) {
      setError(res.error);
      setDetail(res.detail);
    } else setChecking(false);
    refresh();
  };

  const weeksLabel = (w: PlanWeeks) => t(`coach.weeks${w}`);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'long' });

  if (status === undefined) {
    return (
      <Card>
        <ActivityIndicator color={colors.accent} />
      </Card>
    );
  }

  if (status && isWaiting(status.status)) {
    return (
      <Card>
        <Txt variant="h2">{t('coach.reviewing')}</Txt>
        <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
          {t('coach.reviewingBody', { weeks: weeksLabel(status.weeks), date: date(status.createdAt) })}
        </Txt>
      </Card>
    );
  }

  return (
    <Card>
      {status?.status === 'approved' ? (
        <View style={{ marginBottom: space.md }}>
          <Txt variant="h2">{t('coach.ready')}</Txt>
          <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
            {t('coach.readyBody', { weeks: weeksLabel(status.weeks) })}
          </Txt>
        </View>
      ) : (
        <Txt style={{ marginBottom: space.md }}>{t('coach.askBody')}</Txt>
      )}
      <Txt variant="small" color={colors.muted} style={{ marginBottom: space.xs }}>
        {t('coach.lengthTitle')}
      </Txt>
      <Segmented value={weeks} onChange={setWeeks} options={PLAN_WEEKS.map((w) => ({ value: w, label: weeksLabel(w) }))} />
      {error || status?.status === 'failed' ? (
        <Txt variant="small" color={colors.danger} style={{ marginTop: space.sm }}>
          {t(ERRORS[error ?? 'failed'])}
        </Txt>
      ) : null}
      {user?.admin && detail && (error || status?.status === 'failed') ? (
        <Txt variant="tiny" color={colors.muted} style={{ marginTop: space.xs }}>
          {detail}
        </Txt>
      ) : null}
      {checking && user?.profile ? (
        <PlanQuestions profile={user.profile} asking={asking} onSend={ask} onCancel={() => setChecking(false)} />
      ) : (
        <Button
          label={asking ? t('coach.asking') : status?.status === 'approved' ? t('coach.newPlan') : t('coach.ask')}
          disabled={asking}
          style={{ marginTop: space.md }}
          onPress={() => (status?.status === 'approved' && user?.profile ? setChecking(true) : ask())}
        />
      )}
    </Card>
  );
}

// Before a new plan: where the athlete is now. Only how the last plan felt is required; the rest has a default.
function PlanQuestions({
  profile,
  asking,
  onSend,
  onCancel,
}: {
  profile: Profile;
  asking: boolean;
  onSend: (c: PlanCheckIn, details?: GoalDetails) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const goal = profile.goal;
  // A new goal asks its own questions (the same as in the Pro questionnaire), saved in the profile.
  const [details, setDetails] = useState<GoalDetails>(profile.details ?? {});
  const [sameGoal, setSameGoal] = useState<'same' | 'change'>('same');
  const [newGoal, setNewGoal] = useState<Goal | null>(null);
  const [focus, setFocus] = useState('');
  const [lastPlan, setLastPlan] = useState<PlanCheckIn['lastPlan'] | ''>('');
  const [deload, setDeload] = useState<PlanCheckIn['deload']>('coach');
  const [hurt, setHurt] = useState<'no' | 'yes'>('no');
  const [health, setHealth] = useState('');
  const [note, setNote] = useState('');
  const changing = sameGoal === 'change';
  const ready = !!lastPlan && (!changing || (!!newGoal && detailsDone(newGoal, details))) && (hurt === 'no' || health.trim() !== '');
  const send = () => {
    if (!ready || !lastPlan) return;
    onSend({
      goal: changing && newGoal ? newGoal : goal,
      goalChanged: changing && !!newGoal && newGoal !== goal,
      focus: focus.trim(),
      lastPlan,
      deload,
      health: hurt === 'yes' ? health.trim() : '',
      note: note.trim(),
    }, changing && newGoal ? details : undefined);
  };
  const q = (key: Parameters<typeof t>[0], vars?: Record<string, string>) => (
    <Txt style={{ fontWeight: '700', marginTop: space.md, marginBottom: space.xs }}>{t(key, vars)}</Txt>
  );
  return (
    <View style={{ marginTop: space.md }}>
      <Txt variant="label" color={colors.accent}>
        {t('coach.ci.title')}
      </Txt>
      <Txt variant="small" color={colors.muted} style={{ marginTop: 4 }}>
        {t('coach.ci.body')}
      </Txt>

      {q('coach.ci.goal', { goal: t(`onb.goal.${goal}`) })}
      <Segmented
        value={sameGoal}
        onChange={setSameGoal}
        options={[
          { value: 'same', label: t('coach.ci.goalSame') },
          { value: 'change', label: t('coach.ci.goalChange') },
        ]}
      />
      {changing ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm }}>
          {GOALS.filter((g) => g !== goal).map((g) => (
            <Chip key={g} label={t(`onb.goal.${g}`)} active={newGoal === g} onPress={() => setNewGoal(g)} />
          ))}
        </View>
      ) : null}
      {changing && newGoal ? (
        <View style={{ marginTop: space.sm }}>
          <GoalDetailsStep goal={newGoal} details={details} onChange={setDetails} />
        </View>
      ) : null}
      <View style={{ marginTop: space.sm }}>
        <Field label={t('coach.ci.focus')} value={focus} onChangeText={setFocus} placeholder={t('coach.ci.focusHint')} multiline />
      </View>

      {q('coach.ci.lastPlan')}
      <Segmented
        value={lastPlan}
        onChange={setLastPlan}
        options={[
          { value: 'easy', label: t('coach.ci.easy') },
          { value: 'good', label: t('coach.ci.good') },
          { value: 'hard', label: t('coach.ci.hard') },
        ]}
      />

      {q('coach.ci.deload')}
      <Txt variant="small" color={colors.muted} style={{ marginBottom: space.xs }}>
        {t('coach.ci.deloadHint')}
      </Txt>
      <Segmented
        value={deload}
        onChange={setDeload}
        options={[
          { value: 'yes', label: t('coach.ci.yes') },
          { value: 'no', label: t('coach.ci.no') },
          { value: 'coach', label: t('coach.ci.coachDecides') },
        ]}
      />

      {q('coach.ci.health')}
      <Segmented
        value={hurt}
        onChange={setHurt}
        options={[
          { value: 'no', label: t('coach.ci.no') },
          { value: 'yes', label: t('coach.ci.yes') },
        ]}
      />
      {hurt === 'yes' ? (
        <View style={{ marginTop: space.sm }}>
          <Field value={health} onChangeText={setHealth} placeholder={t('coach.ci.healthHint')} multiline />
        </View>
      ) : null}

      <View style={{ marginTop: space.md }}>
        <Field label={t('coach.ci.note')} value={note} onChangeText={setNote} placeholder={t('coach.ci.noteHint')} multiline />
      </View>

      {!ready && !asking ? (
        <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
          {t(!lastPlan ? 'coach.ci.needFeel' : changing && !newGoal ? 'coach.ci.needGoal' : changing ? 'coach.ci.needDetails' : 'coach.ci.needHealth')}
        </Txt>
      ) : null}
      <Button label={asking ? t('coach.asking') : t('coach.ci.send')} disabled={asking || !ready} style={{ marginTop: space.md }} onPress={send} />
      <Button label={t('common.cancel')} variant="ghost" disabled={asking} style={{ marginTop: space.xs }} onPress={onCancel} />
    </View>
  );
}
