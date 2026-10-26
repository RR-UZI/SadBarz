// Athlete profile, for every plan: photo, stats, personal records (PRs) and the
// best marks found in the workout log.
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { Badge, Button, Card, Field, NumberField, Row, Screen, Section, Segmented, Txt } from '../components/ui';
import { COMPETITIONS } from '../data/seed';
import { useT } from '../i18n';
import { pickAvatar } from '../lib/avatar';
import { forTimeText } from '../lib/blocks';
import { confirm } from '../lib/confirm';
import { amrapBests, forTimeBests, isoDay, loggedBests, profileStats, recordValue } from '../lib/records';
import { uid } from '../lib/util';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, radius, space } from '../theme';
import type { Exercise, PersonalRecord, RecordUnit } from '../types';

// Logged bests shown before "see all".
const SHOW_FIRST = 6;

function useDayText() {
  const { settings } = useApp();
  const locale = settings.language === 'es' ? 'es-MX' : 'en-US';
  return (when: number | string) => {
    const d = typeof when === 'string' ? new Date(`${when}T12:00:00`) : new Date(when);
    return Number.isNaN(d.getTime()) ? String(when) : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };
}

export function ProfileScreen() {
  const t = useT();
  const nav = useNav();
  const { workouts, records, avatar, setAvatar, exerciseById } = useApp();
  const { user } = useAuth();
  const dayText = useDayText();
  const [loading, setLoading] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const stats = useMemo(() => profileStats(workouts), [workouts]);
  const bests = useMemo(() => loggedBests(workouts, exerciseById), [workouts, exerciseById]);
  const amraps = useMemo(() => amrapBests(workouts), [workouts]);
  const forTimes = useMemo(() => forTimeBests(workouts), [workouts]);
  const shown = showAll ? bests : bests.slice(0, SHOW_FIRST);
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);

  const changePhoto = async () => {
    setPhotoError(false);
    setLoading(true);
    try {
      const photo = await pickAvatar();
      if (photo) setAvatar(photo);
    } catch {
      setPhotoError(true);
    } finally {
      setLoading(false);
    }
  };

  const profile = user?.profile;
  const hours = Math.round((stats.minutes / 60) * 10) / 10;

  return (
    <Screen title={t('profile.title')} onBack={nav.pop}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel={avatar ? t('profile.changePhoto') : t('profile.addPhoto')}>
          <Avatar uri={avatar} name={user?.name} size={112} />
          {loading ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 56, backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null}
        </Pressable>
        <Row>
          <Button label={avatar ? t('profile.changePhoto') : t('profile.addPhoto')} size="sm" variant="secondary" onPress={changePhoto} />
          {avatar ? <Button label={t('profile.removePhoto')} size="sm" variant="ghost" onPress={() => setAvatar(null)} /> : null}
        </Row>
        {photoError ? (
          <Txt variant="small" color={colors.danger}>
            {t('profile.photoError')}
          </Txt>
        ) : null}
        <Txt variant="h2" style={{ marginTop: space.sm }}>
          {user?.name}
        </Txt>
        <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {user?.plan === 'pro' ? <Badge label="PRO" color={colors.accent} textColor={colors.accentText} /> : <Badge label={t('profile.planFree')} />}
          {profile ? <Badge label={t(`onb.goal.${profile.goal}`)} /> : null}
          {profile ? <Badge label={t(`level.${profile.level}`)} /> : null}
        </Row>
      </View>

      <Card style={{ marginTop: space.xl }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stat value={stats.workouts} label={t('profile.stats.workouts')} accent />
          <Stat value={hours} label={t('profile.stats.hours')} />
          <Stat value={stats.reps} label={t('profile.stats.reps')} />
          <Stat value={stats.weekStreak} label={t('profile.stats.streak')} />
        </Row>
      </Card>

      <Section title={t('profile.records')} right={<Button label={t('profile.addRecord')} size="sm" onPress={() => nav.push({ name: 'editRecord' })} />}>
        <Txt variant="small" color={colors.muted} style={{ marginBottom: space.sm }}>
          {t('profile.recordsHelp')}
        </Txt>
        <View style={{ gap: space.sm }}>
          {sorted.length === 0 ? (
            <Card style={{ borderStyle: 'dashed', borderColor: colors.faint }}>
              <Txt color={colors.muted}>{t('profile.noRecords')}</Txt>
            </Card>
          ) : null}
          {sorted.map((r) => (
            <Card key={r.id} onPress={() => nav.push({ name: 'editRecord', id: r.id })} style={{ paddingVertical: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '800' }} numberOfLines={1}>
                    {r.name}
                  </Txt>
                  <Txt variant="small" color={colors.muted} numberOfLines={1}>
                    {dayText(r.date)}
                    {r.note ? ` · ${r.note}` : ''}
                  </Txt>
                </View>
                <Txt variant="h2" color={colors.accent}>
                  {recordValue(r)}
                </Txt>
              </Row>
            </Card>
          ))}
        </View>
      </Section>

      <Section title={t('profile.logged')}>
        <Txt variant="small" color={colors.muted} style={{ marginBottom: space.sm }}>
          {bests.length || amraps.length || forTimes.length ? t('profile.loggedHelp') : t('profile.noLogged')}
        </Txt>
        {shown.length ? (
          <Card style={{ paddingVertical: space.xs }}>
            {shown.map((b, i) => {
              const name = exerciseById(b.exerciseId)?.name ?? '?';
              return (
                <Pressable
                  key={b.key}
                  onPress={() =>
                    nav.push({
                      name: 'editRecord',
                      draft: { name, exerciseId: b.exerciseId, unit: b.unit, value: b.value, reps: b.reps, date: isoDay(b.at) },
                    })
                  }
                  style={{ paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
                >
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Txt numberOfLines={1}>{name}</Txt>
                      <Txt variant="tiny" color={colors.muted}>
                        {dayText(b.at)}
                      </Txt>
                    </View>
                    <Txt style={{ fontWeight: '800' }}>{recordValue(b)}</Txt>
                  </Row>
                </Pressable>
              );
            })}
          </Card>
        ) : null}
        {bests.length > SHOW_FIRST ? (
          <Button
            label={showAll ? t('profile.showLess') : t('profile.showAll', { n: bests.length })}
            size="sm"
            variant="ghost"
            style={{ marginTop: space.sm }}
            onPress={() => setShowAll((v) => !v)}
          />
        ) : null}
        {amraps.length ? (
          <>
            <Txt variant="label" style={{ marginTop: space.lg, marginBottom: space.sm }}>
              {t('profile.amrap')}
            </Txt>
            <Card style={{ paddingVertical: space.xs }}>
              {amraps.map((a, i) => (
                <Row key={a.key} style={{ justifyContent: 'space-between', paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Txt numberOfLines={1}>{a.name}</Txt>
                    <Txt variant="tiny" color={colors.muted}>
                      {dayText(a.at)}
                    </Txt>
                  </View>
                  <Txt style={{ fontWeight: '800' }}>{t('run.score', { rounds: a.rounds, reps: a.reps })}</Txt>
                </Row>
              ))}
            </Card>
          </>
        ) : null}
        {forTimes.length ? (
          <>
            <Txt variant="label" style={{ marginTop: space.lg, marginBottom: space.sm }}>
              {t('profile.fortime')}
            </Txt>
            <Card style={{ paddingVertical: space.xs }}>
              {forTimes.map((f, i) => (
                <Row key={f.key} style={{ justifyContent: 'space-between', paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Txt numberOfLines={1}>{f.name}</Txt>
                    <Txt variant="tiny" color={colors.muted}>
                      {dayText(f.at)}
                    </Txt>
                  </View>
                  <Txt style={{ fontWeight: '800' }}>{forTimeText(t, f.score)}</Txt>
                </Row>
              ))}
            </Card>
          </>
        ) : null}
      </Section>

      <Section title={t('profile.training')}>
        <Button label={t('settings.editProfile')} variant="secondary" onPress={() => nav.push({ name: 'editProfile' })} />
      </Section>
    </Screen>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Txt variant="h2" color={accent ? colors.accent : colors.text}>
        {value}
      </Txt>
      <Txt variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>
        {label}
      </Txt>
    </View>
  );
}

const UNITS: RecordUnit[] = ['reps', 'sec', 'kg', 'time'];
// "Pistol" matches "pistol squat"; accents don't matter ("fondos" = "fóndos").
// A row of the list under the name box: a competition, or an exercise.
type Option = { key: string; name: string; exercise?: Exercise };
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime());

// Add or edit one PR. `draft` pre-fills a new one, e.g. from a logged best.
export function RecordEditorScreen({ id, draft }: { id?: string; draft?: Partial<PersonalRecord> }) {
  const t = useT();
  const nav = useNav();
  const { records, saveRecord, deleteRecord, exercises } = useApp();
  const existing = id ? records.find((r) => r.id === id) : undefined;
  const [rec, setRec] = useState<PersonalRecord>(
    () => existing ?? { id: uid('pr'), name: '', unit: 'reps', value: 0, date: isoDay(Date.now()), updatedAt: 0, ...draft },
  );
  const [searching, setSearching] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<PersonalRecord>) => {
    setError(null);
    setRec((r) => ({ ...r, ...patch }));
  };

  const save = () => {
    if (!rec.name.trim()) return setError(t('record.needName'));
    if (!(rec.value > 0)) return setError(t('record.needValue'));
    saveRecord({
      ...rec,
      name: rec.name.trim(),
      note: rec.note?.trim() || undefined,
      reps: rec.unit === 'kg' ? rec.reps : undefined,
      date: isDay(rec.date) ? rec.date : isoDay(Date.now()),
    });
    nav.pop();
  };

  // The list under the name box: competitions, then exercises; names that start with the text first.
  const matches = useMemo(() => {
    const all: Option[] = [...COMPETITIONS.map((name) => ({ key: `comp:${name}`, name })), ...exercises.map((e) => ({ key: e.id, name: e.name, exercise: e }))];
    const q = fold(rec.name);
    if (!q) return all;
    const hits = all.filter((o) => fold(o.name).includes(q));
    return [...hits.filter((o) => fold(o.name).startsWith(q)), ...hits.filter((o) => !fold(o.name).startsWith(q))];
  }, [exercises, rec.name]);
  const showList = searching && !rec.exerciseId && matches.length > 0;

  const pick = ({ name, exercise: e }: Option) => {
    if (!e) set({ name, unit: 'time' });
    else {
      const unit: RecordUnit = e.kind === 'hold' ? 'sec' : rec.unit === 'time' || (rec.unit === 'sec' && e.kind === 'reps') ? 'reps' : rec.unit;
      set({ name, exerciseId: e.id, unit });
    }
    setSearching(false);
  };

  const minutes = Math.floor(rec.value / 60);
  const seconds = rec.value % 60;

  return (
    <Screen
      title={existing ? t('record.edit') : t('record.new')}
      onBack={nav.pop}
      footer={
        <View style={{ gap: space.sm }}>
          {error ? (
            <Txt variant="small" color={colors.danger} style={{ textAlign: 'center' }}>
              {error}
            </Txt>
          ) : null}
          <Button label={t('common.save')} size="lg" onPress={save} />
        </View>
      }
    >
      <View style={{ gap: space.lg }}>
        <View style={{ gap: space.sm }}>
          <Field
            label={t('record.name')}
            value={rec.name}
            placeholder={t('record.namePlaceholder')}
            onChangeText={(name) => {
              set({ name, exerciseId: undefined });
              setSearching(true);
            }}
            inputProps={{
              autoCorrect: false,
              onFocus: () => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                setSearching(true);
              },
              // Wait a moment so a tap on the list still lands.
              onBlur: () => {
                blurTimer.current = setTimeout(() => setSearching(false), 200);
              },
            }}
          />
          {showList ? (
            <View style={{ maxHeight: 264, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {matches.map((o, i) => (
                  <Pressable
                    key={o.key}
                    onPress={() => pick(o)}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      paddingVertical: 11,
                      paddingHorizontal: space.md,
                      borderTopWidth: i ? 1 : 0,
                      borderTopColor: colors.border,
                      backgroundColor: pressed ? colors.surface2 : 'transparent',
                    })}
                  >
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Txt style={{ flex: 1 }} numberOfLines={1}>
                        {o.name}
                      </Txt>
                      {o.exercise ? (
                        <Txt variant="tiny" color={colors.muted}>
                          {t(`record.unit.${o.exercise.kind === 'hold' ? 'sec' : 'reps'}`)}
                        </Txt>
                      ) : (
                        <Txt variant="tiny" color={colors.accent}>
                          {t('record.competition')}
                        </Txt>
                      )}
                    </Row>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
          {searching && rec.name.trim() && !rec.exerciseId && !matches.length ? (
            <Txt variant="tiny" color={colors.muted}>
              {t('record.customName')}
            </Txt>
          ) : null}
        </View>

        <View style={{ gap: space.sm }}>
          <Txt variant="small" color={colors.muted}>
            {t('record.unit')}
          </Txt>
          <Segmented small value={rec.unit} onChange={(unit) => set({ unit })} options={UNITS.map((u) => ({ value: u, label: t(`record.unit.${u}`) }))} />
          <Txt variant="tiny" color={colors.muted}>
            {t(`record.unit.${rec.unit}.help`)}
          </Txt>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md }}>
          {rec.unit === 'time' ? (
            <Row gap={space.lg} style={{ flexWrap: 'wrap' }}>
              <NumberField label={t('record.min')} value={minutes} max={600} onChange={(m) => set({ value: (m ?? 0) * 60 + seconds })} />
              <NumberField label={t('record.secs')} value={seconds} max={59} onChange={(s) => set({ value: minutes * 60 + (s ?? 0) })} />
            </Row>
          ) : (
            <Row gap={space.lg} style={{ flexWrap: 'wrap' }}>
              <NumberField
                label={t(`record.value.${rec.unit}`)}
                value={rec.value}
                max={rec.unit === 'sec' ? 3600 : 999}
                step={rec.unit === 'kg' ? 2 : 1}
                suffix={rec.unit === 'sec' ? 's' : rec.unit === 'kg' ? 'kg' : undefined}
                onChange={(value) => set({ value: value ?? 0 })}
              />
              {rec.unit === 'kg' ? <NumberField label={t('record.repsAt')} value={rec.reps} allowEmpty min={1} max={100} onChange={(reps) => set({ reps })} /> : null}
            </Row>
          )}
          <Txt variant="h2" color={colors.accent}>
            {rec.value > 0 ? recordValue(rec) : '–'}
          </Txt>
        </View>

        <Field
          label={t('record.date')}
          value={rec.date}
          placeholder="2026-10-26"
          onChangeText={(date) => set({ date })}
          inputProps={{ autoCapitalize: 'none', inputMode: 'numeric' }}
        />
        <Field label={`${t('record.note')} (${t('common.optional')})`} value={rec.note ?? ''} placeholder={t('record.notePlaceholder')} onChangeText={(note) => set({ note })} />

        {existing ? (
          <Button
            label={t('common.delete')}
            variant="danger"
            onPress={() =>
              confirm(
                t('common.confirmDelete'),
                () => {
                  deleteRecord(existing.id);
                  nav.pop();
                },
                t('common.delete'),
                t('common.cancel'),
              )
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}
