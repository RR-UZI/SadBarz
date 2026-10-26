// The questions the coach needs to build a plan: shown once after sign up, and
// again from Settings to change the answers. One question per screen, then a review.
// Free accounts answer the short version; Pro answers the full one, with the goal questions.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Calendar, LinkButton, longDate, Option, Title } from '../components/onboarding';
import { Button, Card, Chip, Field, NumberField, Row, Screen, Segmented, ToggleRow, Txt } from '../components/ui';
import { useT, type StringKey } from '../i18n';
import { detailsDone, FULL_STEPS, fullProfile, SHORT_STEPS, STATIC_STAGES, type Step } from '../lib/questionnaire';
import {
  LB_PER_KG,
  MAX_AGE,
  MAX_TRAINING_DAYS,
  MAX_WEIGHT_KG,
  MIN_AGE,
  MIN_WEIGHT_KG,
  levelFromTest,
  nextTrainingDay,
} from '../lib/profile';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { useAuth, type AuthError } from '../store/Auth';
import { colors, radius, space } from '../theme';
import type { Equipment, Goal, GoalDetails, Injury, Level, MaxReps, Profile, Skill } from '../types';
import { GoalDetailsStep } from './GoalDetailsStep';

const GOALS: Goal[] = ['compete', 'endurance', 'strength', 'skills', 'statics', 'fitness'];
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
const TEST: (keyof MaxReps)[] = ['pullUps', 'dips', 'pushUps', 'muscleUps'];
const SKILLS: Skill[] = ['handstand', 'lsit', 'frontLever', 'backLever', 'planche'];
const EQUIPMENT: Equipment[] = ['bar', 'dips', 'parallettes', 'rings', 'bands', 'weights', 'tubes', 'none'];
const INJURIES: Injury[] = ['shoulder', 'elbow', 'wrist', 'lowerBack', 'knee', 'other'];
const SESSIONS: NonNullable<Profile['sessionMin']>[] = [30, 45, 60, 90, 0];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 5:00 to 22:00

interface Draft {
  goal?: Goal;
  levelSource: 'test' | 'picked';
  maxReps: MaxReps;
  pickedLevel?: Level;
  skills: Skill[];
  equipment: Equipment[];
  trainingDays: number[];
  sessionMin?: Profile['sessionMin'];
  startDate?: string;
  /** The start date was picked by hand, so changing the days doesn't move it. */
  startPicked: boolean;
  age?: number;
  unit: 'kg' | 'lb';
  weight?: number;
  sex?: 'male' | 'female';
  details: GoalDetails;
  injuries: Injury[];
  injuryNote: string;
  reminders: boolean;
  reminderTime: string;
}

function draftFrom(p: Profile | null, lang: string): Draft {
  return {
    goal: p?.goal,
    levelSource: p?.levelSource ?? 'test',
    maxReps: p?.maxReps ?? { pullUps: 0, dips: 0, pushUps: 0, muscleUps: 0 },
    pickedLevel: p?.levelSource === 'picked' ? p.level : undefined,
    skills: p?.skills ?? [],
    equipment: p?.equipment ?? [],
    trainingDays: p?.trainingDays ?? [],
    sessionMin: p?.sessionMin,
    startDate: p?.startDate,
    startPicked: !!p,
    age: p?.age,
    unit: lang === 'en' ? 'lb' : 'kg',
    weight: p?.weightKg != null ? (lang === 'en' ? Math.round(p.weightKg * LB_PER_KG) : Math.round(p.weightKg)) : undefined,
    sex: p?.sex,
    details: p?.details ?? {},
    injuries: p?.injuries ?? [],
    injuryNote: p?.injuryNote ?? '',
    reminders: p?.reminders ?? true,
    reminderTime: p?.reminderTime ?? '19:00',
  };
}

function weightKg(d: Draft) {
  if (d.weight == null) return undefined;
  return d.unit === 'kg' ? d.weight : Math.round((d.weight / LB_PER_KG) * 10) / 10;
}

function weightLimits(unit: Draft['unit']) {
  return unit === 'kg' ? [MIN_WEIGHT_KG, MAX_WEIGHT_KG] : [Math.round(MIN_WEIGHT_KG * LB_PER_KG), Math.round(MAX_WEIGHT_KG * LB_PER_KG)];
}

function level(d: Draft): Level | undefined {
  return d.levelSource === 'test' ? levelFromTest(d.maxReps) : d.pickedLevel;
}

function stepDone(step: Step, d: Draft): boolean {
  switch (step) {
    case 'goal':
      return !!d.goal;
    case 'level':
      return !!level(d);
    case 'details':
      return detailsDone(d.goal, d.details);
    case 'equipment':
      return d.equipment.length > 0;
    case 'days':
      return d.trainingDays.length > 0;
    case 'session':
      return d.sessionMin != null;
    case 'start':
      return !!d.startDate;
    case 'body': {
      const [min, max] = weightLimits(d.unit);
      return d.age != null && d.age >= MIN_AGE && d.age <= MAX_AGE && d.weight != null && d.weight >= min && d.weight <= max;
    }
    default:
      return true;
  }
}

function toProfile(d: Draft): Profile {
  return {
    version: 1,
    goal: d.goal!,
    level: level(d)!,
    levelSource: d.levelSource,
    ...(d.levelSource === 'test' ? { maxReps: d.maxReps } : {}),
    skills: d.skills,
    equipment: d.equipment,
    trainingDays: [...d.trainingDays].sort((a, b) => a - b),
    // Asked only in the full questionnaire: kept when answered.
    ...(d.sessionMin != null ? { sessionMin: d.sessionMin } : {}),
    ...(d.startDate ? { startDate: d.startDate } : {}),
    ...(d.age != null ? { age: d.age } : {}),
    ...(weightKg(d) != null ? { weightKg: weightKg(d) } : {}),
    ...(d.sex ? { sex: d.sex } : {}),
    ...(Object.keys(d.details).length ? { details: d.details } : {}),
    injuries: d.injuries,
    ...(d.injuries.length && d.injuryNote.trim() ? { injuryNote: d.injuryNote.trim() } : {}),
    reminders: d.reminders,
    reminderTime: d.reminderTime,
    updatedAt: new Date().toISOString(),
  };
}

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function EditProfileScreen() {
  const nav = useNav();
  return <OnboardingScreen onClose={nav.pop} />;
}

/** onClose set = editing from Settings: opens on the review and closes after saving. */
export function OnboardingScreen({ onClose }: { onClose?: () => void }) {
  const t = useT();
  const { settings } = useApp();
  const { user, saveProfile, signOut } = useAuth();
  const [d, setD] = useState<Draft>(() => draftFrom(user?.profile ?? null, settings.language));
  const profile = user?.profile ?? null;
  const isPro = user?.plan === 'pro';
  const steps: readonly Step[] = isPro ? FULL_STEPS : SHORT_STEPS;
  const questions = steps.length - 1;
  // A Pro athlete whose profile came from the short questionnaire starts at the first missing answer.
  const [step, setStep] = useState<Step>(() => {
    if (!onClose || !profile) return steps[0];
    if (isPro && !fullProfile(profile)) return steps.find((s) => s !== 'review' && !stepDone(s, d)) ?? 'review';
    return 'review';
  });
  // Opened from the review (or to fill in what is missing): Continue goes to the next missing answer, then the review.
  const [fromReview, setFromReview] = useState(!!onClose && !!profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const index = steps.indexOf(step);
  const set = (patch: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  const next = () => {
    if (!stepDone(step, d)) return;
    const after = { ...d, ...(step === 'days' && !d.startPicked ? { startDate: nextTrainingDay(d.trainingDays) } : {}) };
    if (after.startDate !== d.startDate) set({ startDate: after.startDate });
    // Back to the review, unless a change left another answer missing (a new goal's questions).
    const missing = steps.find((s) => s !== 'review' && !stepDone(s, after));
    if (fromReview) setStep(missing ?? 'review');
    else setStep(steps[index + 1]);
  };

  const back = () => {
    if (step === 'review' || index === 0) return onClose?.();
    setStep(fromReview ? 'review' : steps[index - 1]);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const res = await saveProfile(toProfile(d));
    setBusy(false);
    if (!res.ok) setError(res.error);
    else onClose?.();
  };

  const canGoBack = step === 'review' ? !!onClose : index > 0 || !!onClose;

  const footer =
    step === 'review' ? (
      <View style={{ gap: space.sm }}>
        {error ? (
          <View accessibilityRole="alert">
            <Txt variant="small" color={colors.danger}>
              {t(`auth.error.${error}`)}
            </Txt>
          </View>
        ) : null}
        <Button label={busy ? '…' : t(onClose ? 'onb.saveChanges' : 'onb.save')} size="lg" onPress={save} disabled={busy} />
      </View>
    ) : (
      <Row gap={space.sm}>
        {step === 'injuries' && !d.injuries.length ? (
          <Button label={t('onb.skip')} variant="ghost" size="lg" flex onPress={next} />
        ) : null}
        <Button label={t('onb.continue')} size="lg" flex onPress={next} disabled={!stepDone(step, d)} />
      </Row>
    );

  return (
    <Screen
      title={step === 'review' ? t('onb.review.short') : t('onb.step', { n: index + 1, total: questions })}
      onBack={canGoBack ? back : undefined}
      right={
        !onClose && index === 0 ? (
          <Pressable onPress={() => void signOut()} hitSlop={8} accessibilityRole="button" style={{ padding: 6 }}>
            <Txt variant="small" color={colors.muted}>
              {t('onb.exit')}
            </Txt>
          </Pressable>
        ) : null
      }
      footer={footer}
    >
      {step !== 'review' ? <Progress value={(index + 1) / questions} /> : null}

      {step === 'goal' && (
        <>
          <Txt variant="small" color={colors.muted} style={{ marginBottom: space.sm }}>
            {t('onb.hello', { name: user?.name.split(' ')[0] ?? '', n: questions })}
          </Txt>
          <Title text={t('onb.goal.title')} />
          <View style={{ gap: space.sm }}>
            {GOALS.map((g) => (
              <Option key={g} label={t(`onb.goal.${g}`)} sub={t(`onb.goal.${g}.sub`)} active={d.goal === g} onPress={() => set({ goal: g })} />
            ))}
          </View>
        </>
      )}

      {step === 'level' && d.levelSource === 'test' && (
        <>
          <Title text={t('onb.test.title')} sub={t('onb.test.sub')} />
          <View style={{ gap: space.sm }}>
            {TEST.map((k) => (
              <Card key={k} style={{ paddingVertical: space.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt style={{ fontWeight: '700', flex: 1 }}>{t(`onb.test.${k}`)}</Txt>
                  <NumberField
                    value={d.maxReps[k]}
                    onChange={(v) => set({ maxReps: { ...d.maxReps, [k]: v ?? 0 } })}
                    max={200}
                  />
                </Row>
              </Card>
            ))}
          </View>
          <Txt variant="label" style={{ marginTop: space.xl, marginBottom: space.sm }}>
            {t('onb.test.skills')}
          </Txt>
          <Row style={{ flexWrap: 'wrap' }}>
            {SKILLS.map((s) => (
              <Chip key={s} label={t(`skill.${s}`)} active={d.skills.includes(s)} onPress={() => set({ skills: toggle(d.skills, s) })} />
            ))}
          </Row>
          <Card style={{ marginTop: space.xl, borderColor: colors.accent }}>
            <Txt style={{ fontWeight: '800' }} color={colors.accent}>
              {t('onb.test.result', { level: t(`level.${levelFromTest(d.maxReps)}`) })}
            </Txt>
          </Card>
          <LinkButton label={t('onb.test.dontKnow')} onPress={() => set({ levelSource: 'picked' })} />
        </>
      )}

      {step === 'level' && d.levelSource === 'picked' && (
        <>
          <Title text={t('onb.pick.title')} sub={t('onb.pick.sub')} />
          <View style={{ gap: space.sm }}>
            {LEVELS.map((l) => (
              <Option key={l} label={t(`level.${l}`)} sub={t(`level.${l}.sub`)} active={d.pickedLevel === l} onPress={() => set({ pickedLevel: l })} />
            ))}
          </View>
          <LinkButton label={t('onb.pick.useTest')} onPress={() => set({ levelSource: 'test' })} />
        </>
      )}

      {step === 'equipment' && (
        <>
          <Title text={t('onb.equipment.title')} sub={t('onb.equipment.sub')} />
          <Row style={{ flexWrap: 'wrap' }}>
            {EQUIPMENT.map((e) => (
              <Chip
                key={e}
                label={t(`equipment.${e}`)}
                active={d.equipment.includes(e)}
                onPress={() =>
                  set({
                    // "Nothing" and real equipment exclude each other.
                    equipment: e === 'none' ? (d.equipment.includes('none') ? [] : ['none']) : toggle(d.equipment.filter((x) => x !== 'none'), e),
                  })
                }
              />
            ))}
          </Row>
        </>
      )}

      {step === 'days' && (
        <>
          <Title text={t('onb.days.title')} sub={t('onb.days.sub')} />
          <Row style={{ justifyContent: 'space-between' }} gap={6}>
            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
              const active = d.trainingDays.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => {
                    if (active || d.trainingDays.length < MAX_TRAINING_DAYS) set({ trainingDays: toggle(d.trainingDays, day) });
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={t(`dayLong.${day}` as StringKey)}
                  style={[styles.day, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                >
                  <Txt style={{ fontWeight: '800', fontSize: 17 }} color={active ? colors.accentText : colors.text}>
                    {t(`day.${day}` as StringKey)}
                  </Txt>
                </Pressable>
              );
            })}
          </Row>
          <Txt color={colors.accent} style={{ marginTop: space.lg, fontWeight: '700', textAlign: 'center' }}>
            {d.trainingDays.length === 1 ? t('onb.days.countOne') : d.trainingDays.length ? t('onb.days.count', { n: d.trainingDays.length }) : ' '}
          </Txt>
          <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm, textAlign: 'center' }}>
            {t('onb.days.max', { n: MAX_TRAINING_DAYS })}
          </Txt>
        </>
      )}

      {step === 'session' && (
        <>
          <Title text={t('onb.session.title')} sub={t('onb.session.sub')} />
          <View style={{ gap: space.sm }}>
            {SESSIONS.map((m) => (
              <Option
                key={m}
                label={sessionLabel(m, t)}
                sub={m ? undefined : t('onb.session.noCap.sub')}
                active={d.sessionMin === m}
                onPress={() => set({ sessionMin: m })}
              />
            ))}
          </View>
        </>
      )}

      {step === 'start' && (
        <>
          <Title text={t('onb.start.title')} sub={t('onb.start.sub')} />
          <Calendar
            value={d.startDate}
            trainingDays={d.trainingDays}
            onChange={(startDate) => set({ startDate, startPicked: true })}
          />
          {d.startDate ? (
            <Txt color={colors.accent} style={{ marginTop: space.lg, fontWeight: '700', textAlign: 'center' }}>
              {t('onb.start.on', { date: longDate(d.startDate, settings.language) })}
            </Txt>
          ) : null}
        </>
      )}

      {step === 'details' && d.goal ? <GoalDetailsStep goal={d.goal} details={d.details} onChange={(details) => set({ details })} /> : null}

      {step === 'body' && <BodyStep d={d} set={set} />}

      {step === 'injuries' && (
        <>
          <Title text={t('onb.injuries.title')} sub={t('onb.injuries.sub')} />
          <Row style={{ flexWrap: 'wrap' }}>
            {INJURIES.map((i) => (
              <Chip key={i} label={t(`injury.${i}`)} active={d.injuries.includes(i)} onPress={() => set({ injuries: toggle(d.injuries, i) })} />
            ))}
          </Row>
          {d.injuries.length ? (
            <View style={{ marginTop: space.lg }}>
              <Field
                label={t('onb.injuries.note')}
                value={d.injuryNote}
                onChangeText={(injuryNote) => set({ injuryNote })}
                placeholder={t('onb.injuries.notePlaceholder')}
                multiline
              />
            </View>
          ) : null}
        </>
      )}

      {step === 'reminders' && (
        <>
          <Title text={t('onb.reminders.title')} sub={t('onb.reminders.sub')} />
          <ToggleRow label={t('onb.reminders.on')} value={d.reminders} onChange={(reminders) => set({ reminders })} />
          {d.reminders ? (
            <>
              <Txt variant="label" style={{ marginTop: space.xl, marginBottom: space.sm }}>
                {t('onb.reminders.time')}
              </Txt>
              <Row style={{ flexWrap: 'wrap' }}>
                {HOURS.map((h) => {
                  const time = `${String(h).padStart(2, '0')}:00`;
                  return <Chip key={h} label={time} active={d.reminderTime === time} onPress={() => set({ reminderTime: time })} />;
                })}
              </Row>
            </>
          ) : null}
        </>
      )}

      {step === 'review' && (
        <Review
          d={d}
          steps={steps}
          short={!isPro}
          edit={(s) => {
            setFromReview(true);
            setStep(s);
          }}
        />
      )}
    </Screen>
  );
}

function BodyStep({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const t = useT();
  const [min, max] = weightLimits(d.unit);
  const ageBad = d.age != null && (d.age < MIN_AGE || d.age > MAX_AGE);
  const weightBad = d.weight != null && (d.weight < min || d.weight > max);
  const changeUnit = (unit: Draft['unit']) => {
    if (unit === d.unit) return;
    const w = d.weight == null ? undefined : Math.round(unit === 'lb' ? d.weight * LB_PER_KG : d.weight / LB_PER_KG);
    set({ unit, weight: w });
  };
  return (
    <>
      <Title text={t('onb.body.title')} sub={t('onb.body.sub')} />
      <View style={{ gap: space.md }}>
        <Card style={{ paddingVertical: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt style={{ fontWeight: '700', flex: 1 }}>{t('onb.body.age')}</Txt>
            <NumberField value={d.age} onChange={(age) => set({ age })} allowEmpty min={0} max={120} />
          </Row>
        </Card>
        <Card style={{ paddingVertical: space.sm, gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt style={{ fontWeight: '700', flex: 1 }}>{t('onb.body.weight')}</Txt>
            <NumberField value={d.weight} onChange={(weight) => set({ weight })} allowEmpty min={0} max={600} suffix={d.unit} />
          </Row>
          <Segmented
            small
            value={d.unit}
            onChange={changeUnit}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />
        </Card>
        {ageBad ? (
          <Txt variant="small" color={colors.danger}>
            {t('onb.body.ageError', { min: MIN_AGE, max: MAX_AGE })}
          </Txt>
        ) : null}
        {weightBad ? (
          <Txt variant="small" color={colors.danger}>
            {t('onb.body.weightError', { min, max, unit: d.unit })}
          </Txt>
        ) : null}
        <Txt variant="label" style={{ marginTop: space.md }}>
          {t('onb.body.sex')}
        </Txt>
        <Segmented
          small
          value={d.sex ?? 'none'}
          onChange={(v) => set({ sex: v === 'none' ? undefined : v })}
          options={[
            { value: 'male', label: t('onb.body.male') },
            { value: 'female', label: t('onb.body.female') },
            { value: 'none', label: t('onb.body.noSay') },
          ]}
        />
      </View>
    </>
  );
}

function Review({ d, steps, short, edit }: { d: Draft; steps: readonly Step[]; short: boolean; edit: (s: Step) => void }) {
  const t = useT();
  const { settings } = useApp();
  const lvl = level(d);
  const days = [...d.trainingDays].sort((a, b) => a - b);
  const all: { step: Step; label: StringKey; value: string }[] = [
    { step: 'goal', label: 'onb.review.goal', value: d.goal ? t(`onb.goal.${d.goal}`) : '–' },
    {
      step: 'level',
      label: 'onb.review.level',
      value: [
        lvl ? t(`level.${lvl}`) : '–',
        d.levelSource === 'test' ? `${d.maxReps.pullUps} ${t('onb.test.pullUps').toLowerCase()} · ${d.maxReps.dips} ${t('onb.test.dips').toLowerCase()}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    },
    { step: 'details', label: 'onb.review.details', value: detailsSummary(d, t) },
    { step: 'equipment', label: 'onb.review.equipment', value: d.equipment.map((e) => t(`equipment.${e}`)).join(', ') },
    {
      step: 'days',
      label: 'onb.review.days',
      value: days.map((x) => t(`dayLong.${x}` as StringKey).slice(0, 3)).join(' · '),
    },
    { step: 'session', label: 'onb.review.session', value: d.sessionMin != null ? sessionLabel(d.sessionMin, t) : '–' },
    { step: 'start', label: 'onb.review.start', value: d.startDate ? longDate(d.startDate, settings.language) : '–' },
    {
      step: 'body',
      label: 'onb.review.body',
      value: `${t('onb.years', { n: d.age ?? '–' })} · ${d.weight ?? '–'} ${d.unit}`,
    },
    {
      step: 'injuries',
      label: 'onb.review.injuries',
      value: d.injuries.length ? d.injuries.map((i) => t(`injury.${i}`)).join(', ') : t('onb.injuries.none'),
    },
    { step: 'reminders', label: 'onb.review.reminders', value: d.reminders ? d.reminderTime : t('settings.off') },
  ];
  const rows = all.filter((r) => steps.includes(r.step));
  return (
    <>
      <Title text={t('onb.review.title')} sub={t('onb.review.sub')} />
      <Card style={{ paddingVertical: space.xs }}>
        {rows.map((r, i) => (
          <Pressable
            key={r.step}
            onPress={() => edit(r.step)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.reviewRow, i === rows.length - 1 && { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
          >
            <Txt variant="small" color={colors.muted} style={{ width: 110 }}>
              {t(r.label)}
            </Txt>
            <Txt style={{ flex: 1, fontWeight: '700' }}>{r.value}</Txt>
            <Txt color={colors.faint} style={{ fontSize: 20 }}>
              ›
            </Txt>
          </Pressable>
        ))}
      </Card>
      <Txt variant="small" color={colors.muted} style={{ marginTop: space.lg }}>
        {t('onb.review.coach')}
      </Txt>
      {short ? (
        <Txt variant="small" color={colors.accent} style={{ marginTop: space.sm }}>
          {t('onb.review.shortNote')}
        </Txt>
      ) : null}
    </>
  );
}

// One line for the goal questions in the review.
function detailsSummary(d: Draft, t: ReturnType<typeof useT>): string {
  const x = d.details;
  const parts: string[] = [];
  switch (d.goal) {
    case 'statics':
      for (const [s, h] of Object.entries(x.statics?.holds ?? {})) {
        parts.push(`${t(`skill.${s as Skill}`)} ${t(`stage.${STATIC_STAGES[s as Skill][h.stage]}` as StringKey).toLowerCase()} ${h.sec}s`);
      }
      break;
    case 'endurance':
      for (const k of ['squats', 'pistols', 'legRaises', 'hspu'] as const) {
        const v = x.endurance?.[k];
        if (v != null) parts.push(`${v} ${t(`onb.endurance.${k}`).toLowerCase()}`);
      }
      break;
    case 'strength':
      for (const [l, v] of Object.entries(x.strength?.lifts ?? {})) {
        parts.push(`${t(`onb.lift.${l as keyof NonNullable<GoalDetails['strength']>['lifts']}`)} ${v.kg} kg × ${v.reps}`);
      }
      break;
    case 'skills':
      if (x.skills?.first) parts.push(t(`move.${x.skills.first}`));
      if (x.skills?.stage) parts.push(t(`skillStage.${x.skills.stage}`).toLowerCase());
      break;
    case 'compete':
      if (x.compete?.event) parts.push(x.compete.event);
      if (x.compete?.date) parts.push(x.compete.date.split('-').reverse().join('/'));
      break;
    case 'fitness':
      parts.push(...(x.fitness?.wants ?? []).map((w) => t(`want.${w}`)));
      break;
  }
  return parts.join(' · ') || '–';
}

function sessionLabel(m: number, t: (k: StringKey) => string) {
  return m ? `${m} min` : t('onb.session.noCap');
}

// ---------- pieces ----------

function Progress({ value }: { value: number }) {
  return (
    <View style={{ height: 4, backgroundColor: colors.surface2, borderRadius: radius.pill, marginBottom: space.xl, overflow: 'hidden' }}>
      <View style={{ height: 4, width: `${Math.round(value * 100)}%`, backgroundColor: colors.accent, borderRadius: radius.pill }} />
    </View>
  );
}

const styles = {
  day: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 56,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
} as const;
