// Pieces shared by the questionnaire screens: titles, big options, the month calendar.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useT, type StringKey } from '../i18n';
import { isoDate, parseIsoDate, weekday } from '../lib/profile';
import { useApp } from '../store/AppStore';
import { colors, radius, space } from '../theme';
import { Card, Row, Txt } from './ui';

export function Title({ text, sub }: { text: string; sub?: string }) {
  return (
    <View style={{ gap: 6, marginBottom: space.xl }}>
      <Txt variant="title">{text}</Txt>
      {sub ? <Txt color={colors.muted}>{sub}</Txt> : null}
    </View>
  );
}

export function Option({ label, sub, active, onPress }: { label: string; sub?: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      style={({ pressed }) => [styles.option, active && { borderColor: colors.accent, backgroundColor: colors.surface2 }, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.radio, active && { borderColor: colors.accent }]}>{active ? <View style={styles.radioDot} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: '800', fontSize: 17 }}>{label}</Txt>
        {sub ? (
          <Txt variant="small" color={colors.muted}>
            {sub}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.xl, padding: 6 }}>
      <Txt variant="small" color={colors.accent} style={{ fontWeight: '700' }}>
        {label}
      </Txt>
    </Pressable>
  );
}

// Month view for picking a day. Past days can't be picked; training days are outlined.
// `months`: how many months ahead can be shown.
export function Calendar({
  value,
  trainingDays = [],
  months = 3,
  onChange,
}: {
  value?: string;
  trainingDays?: number[];
  months?: number;
  onChange: (iso: string) => void;
}) {
  const t = useT();
  const { settings } = useApp();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const initial = value ? parseIsoDate(value) : today;
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() + months, 1);

  const first = weekday(month);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const label = month.toLocaleDateString(settings.language === 'en' ? 'en-US' : 'es-MX', { month: 'long', year: 'numeric' });
  const title = label.charAt(0).toUpperCase() + label.slice(1);

  return (
    <Card style={{ padding: space.md }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
        <MonthArrow label="‹" a11y={t('onb.start.prev')} disabled={month <= thisMonth} onPress={() => shift(-1)} />
        <Txt style={{ fontWeight: '800' }}>{title}</Txt>
        <MonthArrow label="›" a11y={t('onb.start.next')} disabled={month >= lastMonth} onPress={() => shift(1)} />
      </Row>
      <Row gap={0}>
        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
          <Txt key={day} variant="tiny" color={colors.muted} style={{ flex: 1, textAlign: 'center', fontWeight: '700' }}>
            {t(`day.${day}` as StringKey)}
          </Txt>
        ))}
      </Row>
      {weeks.map((week, wi) => (
        <Row key={wi} gap={0} style={{ marginTop: 4 }}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={{ flex: 1 }} />;
            const iso = isoDate(date);
            const past = date < today;
            const selected = iso === value;
            const training = trainingDays.includes(weekday(date));
            return (
              <View key={di} style={{ flex: 1, alignItems: 'center' }}>
                <Pressable
                  disabled={past}
                  onPress={() => onChange(iso)}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: past }}
                  accessibilityLabel={iso}
                  style={[
                    styles.calDay,
                    training && !past && { borderColor: colors.accent },
                    selected && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                >
                  <Txt
                    variant="small"
                    style={{ fontWeight: training || selected ? '800' : '500' }}
                    color={selected ? colors.accentText : past ? colors.faint : colors.text}
                  >
                    {date.getDate()}
                  </Txt>
                </Pressable>
              </View>
            );
          })}
        </Row>
      ))}
    </Card>
  );
}

function MonthArrow({ label, a11y, disabled, onPress }: { label: string; a11y: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={a11y} style={{ paddingHorizontal: 10 }}>
      <Txt style={{ fontSize: 26, lineHeight: 28 }} color={disabled ? colors.faint : colors.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function longDate(iso: string, lang: string) {
  return parseIsoDate(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

const styles = {
  calDay: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
} as const;
