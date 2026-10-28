// The goal questions of the full Pro questionnaire: one screen that changes with the goal.
import React from 'react';
import { View } from 'react-native';

import { Calendar, Option, Title, longDate } from '../components/onboarding';
import { Card, Chip, Field, NumberField, Row, Select, Txt } from '../components/ui';
import { COMPETITIONS } from '../data/seed';
import { useT, type StringKey } from '../i18n';
import { HOLD_MOVES, LIFTS, SKILL_MINUTES, SKILL_MOVES, STATIC_STAGES } from '../lib/questionnaire';
import { useApp } from '../store/AppStore';
import { colors, space } from '../theme';
import type {
  CompeteCategory,
  CompeteFormat,
  DayType,
  FitnessWant,
  Goal,
  GoalDetails,
  Layoff,
  OtherSport,
  Skill,
  SkillBlocker,
  SkillStage,
  WeakMove,
} from '../types';

const STATICS: Skill[] = ['handstand', 'lsit', 'frontLever', 'backLever', 'planche'];
const STAGES: SkillStage[] = ['far', 'basics', 'progressions', 'sometimes', 'polish'];
const BLOCKERS: SkillBlocker[] = ['strength', 'technique', 'fear', 'mobility', 'unsure'];
const CATEGORIES: CompeteCategory[] = ['beginner', 'intermediate', 'advanced', 'elite', 'other'];
const FORMATS: CompeteFormat[] = ['fortime', 'amrap', 'maxReps', 'freestyle', 'unsure'];
const WEAK: WeakMove[] = ['pullUps', 'dips', 'pushUps', 'muscleUps', 'squats', 'burpees', 'handstand', 'lsit'];
const WANTS: FitnessWant[] = ['fatLoss', 'muscle', 'mobility', 'energy', 'health'];
const LAYOFFS: Layoff[] = ['now', 'lt6m', 'm6to2y', 'gt2y', 'never'];
const SPORTS: OtherSport[] = ['running', 'soccer', 'gym', 'other', 'none'];
const DAYS: DayType[] = ['sitting', 'standing', 'physical'];
const ENDURANCE = ['squats', 'pistols', 'legRaises', 'hspu'] as const;
const FITNESS_TEST = ['pushUps', 'squats1min', 'plankSec', 'hangSec'] as const;

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function GoalDetailsStep({ goal, details, onChange }: { goal: Goal; details: GoalDetails; onChange: (d: GoalDetails) => void }) {
  switch (goal) {
    case 'statics':
      return <Statics details={details} onChange={onChange} />;
    case 'endurance':
      return <Endurance details={details} onChange={onChange} />;
    case 'strength':
      return <Strength details={details} onChange={onChange} />;
    case 'skills':
      return <Skills details={details} onChange={onChange} />;
    case 'compete':
      return <Compete details={details} onChange={onChange} />;
    case 'fitness':
      return <Fitness details={details} onChange={onChange} />;
  }
}

type Part = { details: GoalDetails; onChange: (d: GoalDetails) => void };

function Label({ text, optional }: { text: string; optional?: boolean }) {
  const t = useT();
  return (
    <Txt variant="label" style={{ marginTop: space.xl, marginBottom: space.sm }}>
      {text}
      {optional ? <Txt variant="tiny" color={colors.faint}>{`  ${t('onb.optional')}`}</Txt> : null}
    </Txt>
  );
}

function NumberRow({ label, value, onChange, suffix, max = 999 }: { label: string; value?: number; onChange: (v?: number) => void; suffix?: string; max?: number }) {
  return (
    <Card style={{ paddingVertical: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt style={{ fontWeight: '700', flex: 1 }}>{label}</Txt>
        <NumberField value={value} onChange={onChange} allowEmpty min={0} max={max} suffix={suffix} />
      </Row>
    </Card>
  );
}

// ---------- Estáticos ----------

function Statics({ details, onChange }: Part) {
  const t = useT();
  const holds = details.statics?.holds ?? {};
  const setHold = (s: Skill, stage: number | null, sec?: number) => {
    const next = { ...holds };
    if (stage == null) delete next[s];
    else next[s] = { stage, sec: sec ?? holds[s]?.sec ?? 0 };
    onChange({ ...details, statics: { holds: next } });
  };
  return (
    <>
      <Title text={t('onb.statics.title')} sub={t('onb.statics.sub')} />
      <View style={{ gap: space.md }}>
        {STATICS.map((s) => {
          const hold = holds[s];
          return (
            <Card key={s} style={{ gap: space.sm }}>
              <Txt style={{ fontWeight: '800', fontSize: 17 }}>{t(`skill.${s}`)}</Txt>
              <Row style={{ flexWrap: 'wrap' }}>
                <Chip label={t('onb.statics.notYet')} active={!hold} onPress={() => setHold(s, null)} />
                {STATIC_STAGES[s].map((stage, i) => (
                  <Chip key={stage} label={t(`stage.${stage}` as StringKey)} active={hold?.stage === i} onPress={() => setHold(s, i)} />
                ))}
              </Row>
              {hold ? (
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="small" color={colors.muted} style={{ flex: 1 }}>
                    {t('onb.statics.seconds')}
                  </Txt>
                  <NumberField value={hold.sec} onChange={(v) => setHold(s, hold.stage, v ?? 0)} max={600} suffix="s" />
                </Row>
              ) : null}
            </Card>
          );
        })}
      </View>
    </>
  );
}

// ---------- Fuerza resistencia ----------

function Endurance({ details, onChange }: Part) {
  const t = useT();
  const e = details.endurance ?? {};
  return (
    <>
      <Title text={t('onb.endurance.title')} sub={t('onb.endurance.sub')} />
      <View style={{ gap: space.sm }}>
        {ENDURANCE.map((k) => (
          <NumberRow key={k} label={t(`onb.endurance.${k}`)} value={e[k]} onChange={(v) => onChange({ ...details, endurance: { ...e, [k]: v } })} />
        ))}
      </View>
    </>
  );
}

// ---------- Fuerza ----------

function Strength({ details, onChange }: Part) {
  const t = useT();
  const lifts = details.strength?.lifts ?? {};
  return (
    <>
      <Title text={t('onb.strength.title')} sub={t('onb.strength.sub')} />
      <View style={{ gap: space.sm }}>
        {LIFTS.map((l) => {
          const cur = lifts[l];
          const set = (patch: Partial<{ kg: number; reps: number }>) => {
            const next = { kg: cur?.kg ?? 0, reps: cur?.reps ?? 1, ...patch };
            const all = { ...lifts };
            if (next.kg > 0) all[l] = next;
            else delete all[l];
            onChange({ ...details, strength: { lifts: all } });
          };
          return (
            <Card key={l} style={{ gap: space.sm }}>
              <Txt style={{ fontWeight: '800' }}>{t(`onb.lift.${l}`)}</Txt>
              <Row gap={space.lg} style={{ flexWrap: 'wrap' }}>
                <NumberField label={l === 'squat' ? t('onb.strength.total') : t('onb.strength.added')} value={cur?.kg} onChange={(v) => set({ kg: v ?? 0 })} allowEmpty max={400} step={2.5} suffix="kg" />
                <NumberField label={t('onb.strength.reps')} value={cur?.reps} onChange={(v) => set({ reps: v ?? 1 })} min={1} max={50} />
              </Row>
            </Card>
          );
        })}
      </View>
    </>
  );
}

// ---------- Aprender skills ----------

function Skills({ details, onChange }: Part) {
  const t = useT();
  const s = details.skills ?? { have: {} };
  const set = (patch: Partial<NonNullable<GoalDetails['skills']>>) => onChange({ ...details, skills: { ...s, ...patch } });
  const have = Object.keys(s.have) as typeof SKILL_MOVES;
  return (
    <>
      <Title text={t('onb.skills.title')} sub={t('onb.skills.sub')} />
      <Label text={t('onb.skills.have')} />
      <Row style={{ flexWrap: 'wrap' }}>
        {SKILL_MOVES.map((m) => (
          <Chip
            key={m}
            label={t(`move.${m}`)}
            active={m in s.have}
            onPress={() => {
              const next = { ...s.have };
              if (m in next) delete next[m];
              else next[m] = 0;
              set({ have: next });
            }}
          />
        ))}
      </Row>
      {have.length ? (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          {SKILL_MOVES.filter((m) => m in s.have).map((m) => (
            <NumberRow
              key={m}
              label={t(`move.${m}`)}
              suffix={HOLD_MOVES.includes(m) ? 's' : 'reps'}
              value={s.have[m]}
              onChange={(v) => set({ have: { ...s.have, [m]: v ?? 0 } })}
            />
          ))}
        </View>
      ) : (
        <Txt variant="small" color={colors.muted}>
          {t('onb.skills.none')}
        </Txt>
      )}

      <Label text={t('onb.skills.first')} />
      <Row style={{ flexWrap: 'wrap' }}>
        {SKILL_MOVES.map((m) => (
          <Chip key={m} label={t(`move.${m}`)} active={s.first === m} onPress={() => set({ first: m, second: s.second === m ? undefined : s.second })} />
        ))}
      </Row>
      {s.first ? (
        <>
          <Label text={t('onb.skills.second')} optional />
          <Row style={{ flexWrap: 'wrap' }}>
            {SKILL_MOVES.filter((m) => m !== s.first).map((m) => (
              <Chip key={m} label={t(`move.${m}`)} active={s.second === m} onPress={() => set({ second: s.second === m ? undefined : m })} />
            ))}
          </Row>
          <Label text={t('onb.skills.stage', { skill: t(`move.${s.first}`) })} />
          <View style={{ gap: space.sm }}>
            {STAGES.map((st) => (
              <Option key={st} label={t(`skillStage.${st}`)} active={s.stage === st} onPress={() => set({ stage: st })} />
            ))}
          </View>
        </>
      ) : null}

      <Label text={t('onb.skills.blocker')} />
      <Row style={{ flexWrap: 'wrap' }}>
        {BLOCKERS.map((b) => (
          <Chip key={b} label={t(`blocker.${b}`)} active={s.blocker === b} onPress={() => set({ blocker: b })} />
        ))}
      </Row>
      <Label text={t('onb.skills.minutes')} />
      <Row style={{ flexWrap: 'wrap' }}>
        {SKILL_MINUTES.map((m) => (
          <Chip key={m} label={`${m} min`} active={s.minutes === m} onPress={() => set({ minutes: m })} />
        ))}
      </Row>
    </>
  );
}

// ---------- Competir ----------

function Compete({ details, onChange }: Part) {
  const t = useT();
  const { settings } = useApp();
  const c = details.compete ?? { formats: [] };
  const set = (patch: Partial<NonNullable<GoalDetails['compete']>>) => onChange({ ...details, compete: { ...c, ...patch } });
  const listed = c.event != null && COMPETITIONS.includes(c.event);
  // "Otra": the name they type is saved instead of one from the list. It stays picked while the name is empty.
  const [other, setOther] = React.useState(c.event != null && !listed);
  return (
    <>
      <Title text={t('onb.compete.title')} sub={t('onb.compete.sub')} />
      <Label text={t('onb.compete.event')} />
      <Row style={{ flexWrap: 'wrap' }}>
        {COMPETITIONS.map((name) => (
          <Chip
            key={name}
            label={name}
            active={!other && c.event === name}
            onPress={() => {
              setOther(false);
              set({ event: name });
            }}
          />
        ))}
        <Chip
          label={t('onb.compete.other')}
          active={other}
          onPress={() => {
            setOther(true);
            set({ event: listed ? '' : c.event ?? '' });
          }}
        />
      </Row>
      {other ? (
        <View style={{ marginTop: space.md }}>
          <Field label={t('onb.compete.otherName')} value={c.event ?? ''} onChangeText={(event) => set({ event })} placeholder={t('onb.compete.otherPlaceholder')} />
        </View>
      ) : null}

      <Label text={t('onb.compete.date')} />
      <Calendar value={c.date} months={12} onChange={(date) => set({ date })} />
      {c.date ? (
        <Txt color={colors.accent} style={{ marginTop: space.md, fontWeight: '700', textAlign: 'center' }}>
          {longDate(c.date, settings.language)}
        </Txt>
      ) : null}

      <Label text={t('onb.compete.category')} optional />
      <Row style={{ flexWrap: 'wrap' }}>
        {CATEGORIES.map((k) => (
          <Chip key={k} label={t(`category.${k}`)} active={c.category === k} onPress={() => set({ category: c.category === k ? undefined : k })} />
        ))}
      </Row>
      <Label text={t('onb.compete.format')} optional />
      <Row style={{ flexWrap: 'wrap' }}>
        {FORMATS.map((f) => (
          <Chip key={f} label={t(`competeFormat.${f}`)} active={c.formats.includes(f)} onPress={() => set({ formats: toggle(c.formats, f) })} />
        ))}
      </Row>
      <Label text={t('onb.compete.pistols')} optional />
      <NumberRow label={t('onb.endurance.pistols')} value={c.pistols} onChange={(pistols) => set({ pistols })} />
      <Label text={t('onb.compete.last')} optional />
      <Field label="" value={c.lastResult ?? ''} onChangeText={(lastResult) => set({ lastResult })} placeholder={t('onb.compete.lastPlaceholder')} />
      <Label text={t('onb.compete.weakest')} optional />
      <Select value={c.weakest} options={WEAK.map((w) => ({ value: w, label: t(`weak.${w}`) }))} onChange={(weakest) => set({ weakest })} placeholder={t('onb.compete.weakestPick')} />
    </>
  );
}

// ---------- Ponerme en forma ----------

function Fitness({ details, onChange }: Part) {
  const t = useT();
  const f = details.fitness ?? { wants: [], sports: [] };
  const set = (patch: Partial<NonNullable<GoalDetails['fitness']>>) => onChange({ ...details, fitness: { ...f, ...patch } });
  return (
    <>
      <Title text={t('onb.fitness.title')} sub={t('onb.fitness.sub')} />
      <Label text={t('onb.fitness.wants')} />
      <Row style={{ flexWrap: 'wrap' }}>
        {WANTS.map((w) => (
          <Chip key={w} label={t(`want.${w}`)} active={f.wants.includes(w)} onPress={() => set({ wants: toggle(f.wants, w) })} />
        ))}
      </Row>
      <Label text={t('onb.fitness.layoff')} />
      <View style={{ gap: space.sm }}>
        {LAYOFFS.map((l) => (
          <Option key={l} label={t(`layoff.${l}`)} active={f.layoff === l} onPress={() => set({ layoff: l })} />
        ))}
      </View>
      <Label text={t('onb.fitness.test')} optional />
      <View style={{ gap: space.sm }}>
        {FITNESS_TEST.map((k) => (
          <NumberRow key={k} label={t(`onb.fitness.${k}`)} value={f[k]} suffix={k.endsWith('Sec') ? 's' : undefined} max={k.endsWith('Sec') ? 900 : 300} onChange={(v) => set({ [k]: v })} />
        ))}
      </View>
      <Label text={t('onb.fitness.sports')} optional />
      <Row style={{ flexWrap: 'wrap' }}>
        {SPORTS.map((s) => (
          <Chip
            key={s}
            label={t(`sport.${s}`)}
            active={f.sports.includes(s)}
            // "None" and a sport exclude each other.
            onPress={() => set({ sports: s === 'none' ? (f.sports.includes('none') ? [] : ['none']) : toggle(f.sports.filter((x) => x !== 'none'), s) })}
          />
        ))}
      </Row>
      <Label text={t('onb.fitness.day')} optional />
      <Row style={{ flexWrap: 'wrap' }}>
        {DAYS.map((d) => (
          <Chip key={d} label={t(`dayType.${d}`)} active={f.day === d} onPress={() => set({ day: f.day === d ? undefined : d })} />
        ))}
      </Row>
      <Label text={t('onb.fitness.target')} optional />
      <NumberRow label={t('onb.fitness.targetKg')} value={f.targetKg} suffix="kg" max={250} onChange={(targetKg) => set({ targetKg })} />
    </>
  );
}
