// Home card for a Pro athlete with a complete profile: pick a plan length and ask
// the coach for a plan, then "Tu coach está revisando tu plan" until Uzi approves it.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useT } from '../i18n';
import { askForPlan, coachStatus, isWaiting, PLAN_WEEKS, type AskError, type CoachPlanStatus, type PlanWeeks } from '../lib/coach';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import { Button, Card, Segmented, Txt } from './ui';

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

  const refresh = useCallback(() => {
    coachStatus()
      .then(setStatus)
      .catch(() => setStatus((s) => s ?? null));
  }, []);
  useEffect(refresh, [refresh]);
  // While the coach writes or Uzi reviews, check back now and then.
  useEffect(() => {
    if (!isWaiting(status?.status)) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [status?.status, refresh]);

  const ask = async () => {
    setAsking(true);
    setError(null);
    const res = await askForPlan(weeks, exercises, settings.language);
    setAsking(false);
    if (!res.ok) setError(res.error);
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
      <Button
        label={asking ? t('coach.asking') : status?.status === 'approved' ? t('coach.newPlan') : t('coach.ask')}
        disabled={asking}
        style={{ marginTop: space.md }}
        onPress={ask}
      />
    </Card>
  );
}
