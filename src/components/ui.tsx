// Shared building blocks for every screen.
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '../i18n';
import { clampInt } from '../lib/util';
import { useNav } from '../navigation';
import { colors, font, radius, space } from '../theme';
import { LogoMark } from './Logo';

export function Screen({
  title,
  onBack,
  right,
  children,
  scroll = true,
  footer,
  mark = false,
}: {
  title?: string;
  /** Small SB logo on the left of the header (main tab screens). */
  mark?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {(title || onBack || right || mark) && (
        <View style={styles.header}>
          <View style={styles.headerSide}>
            {onBack ? (
              <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.backBtn}>
                <Text style={styles.backText}>‹</Text>
              </Pressable>
            ) : mark ? (
              <HomeMark />
            ) : null}
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
        </View>
      )}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.contentWidth}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.fill, styles.contentWidth]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>{footer}</View> : null}
    </View>
  );
}

// The SB mark in a tab's header takes you to Inicio.
function HomeMark() {
  const t = useT();
  const nav = useNav();
  return (
    <Pressable onPress={() => nav.reset('home')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('tab.home')}>
      <LogoMark size={26} />
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'rest';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
  flex,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
}) {
  const bg: Record<ButtonVariant, string> = {
    primary: colors.accent,
    secondary: colors.surface2,
    ghost: 'transparent',
    danger: 'transparent',
    rest: colors.rest,
  };
  const fg: Record<ButtonVariant, string> = {
    primary: colors.accentText,
    secondary: colors.text,
    ghost: colors.muted,
    danger: colors.danger,
    rest: '#fff',
  };
  const pad = size === 'lg' ? 18 : size === 'sm' ? 8 : 13;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg[variant], paddingVertical: pad, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: colors.danger },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        flex && { flex: 1 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg[variant], fontSize: size === 'lg' ? 18 : size === 'sm' ? 14 : 16 }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Txt({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: 'title' | 'h2' | 'body' | 'small' | 'tiny' | 'label';
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[styles[`t_${variant}`], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function Row({ children, style, gap = space.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ marginTop: space.xl }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
        <Txt variant="label">{title}</Txt>
        {right}
      </Row>
      {children}
    </View>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  small,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive, small && { paddingVertical: 6 }]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive, small && { fontSize: 13 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: color ?? colors.accent, borderColor: color ?? colors.accent }]}
    >
      <Text style={[styles.chipText, active && { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

// A dropdown: shows the chosen option, and opens the list below it when tapped.
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder,
}: {
  value?: T;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, open && { borderColor: colors.accent }]}
      >
        <Text style={{ color: chosen ? colors.text : colors.faint, fontSize: font.body }}>{chosen ? chosen.label : placeholder}</Text>
        <Text style={{ color: colors.muted, fontSize: 14 }}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.selectList}>
          {[{ value: undefined, label: '—' }, ...options].map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value ?? ''}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.selectOption, (active || pressed) && { backgroundColor: colors.surface2 }]}
              >
                <Text style={{ color: active ? colors.accent : o.value ? colors.text : colors.faint, fontSize: font.body, fontWeight: active ? '700' : '400' }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// Number input with - / + buttons. Empty input = undefined when allowEmpty.
export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  allowEmpty,
  width = 64,
  suffix,
}: {
  label?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  width?: number;
  suffix?: string;
}) {
  const [text, setText] = React.useState(value == null ? '' : String(value));
  React.useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);

  const commit = (t: string) => {
    if (t.trim() === '') {
      if (allowEmpty) onChange(undefined);
      else setText(value == null ? '' : String(value));
      return;
    }
    const n = clampInt(parseFloat(t.replace(',', '.')), min, max);
    onChange(n);
    setText(String(n));
  };

  const bump = (dir: 1 | -1) => onChange(clampInt((value ?? 0) + dir * step, min, max));

  return (
    <View style={{ gap: 4 }}>
      {label ? <Txt variant="tiny" color={colors.muted}>{label}</Txt> : null}
      <View style={styles.numberField}>
        <Pressable onPress={() => bump(-1)} style={styles.stepBtn} accessibilityLabel={`${label ?? ''} -`}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={() => commit(text)}
          onSubmitEditing={() => commit(text)}
          keyboardType="numeric"
          inputMode="numeric"
          selectTextOnFocus
          placeholder="–"
          placeholderTextColor={colors.faint}
          style={[styles.numberInput, { width }]}
          accessibilityLabel={label}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        <Pressable onPress={() => bump(1)} style={styles.stepBtn} accessibilityLabel={`${label ?? ''} +`}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  inputProps,
  right,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** Extra TextInput settings: keyboard type, password entry, autofill... */
  inputProps?: TextInputProps;
  /** Something drawn inside the field on the right, like a show/hide button. */
  right?: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt variant="small" color={colors.muted}>{label}</Txt> : null}
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          multiline={multiline}
          {...inputProps}
          style={[styles.input, multiline && { minHeight: 70, textAlignVertical: 'top' }, right ? { paddingRight: 64 } : null]}
        />
        {right ? <View style={{ position: 'absolute', right: 8 }}>{right}</View> : null}
      </View>
    </View>
  );
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.settingRow}>
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={value ? colors.accentText : colors.muted}
        {...({ activeThumbColor: colors.accentText } as object)}
      />
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.md }} />;
}

export function Badge({ label, color = colors.surface2, textColor = colors.muted }: { label: string; color?: string; textColor?: string }) {
  return (
    <View style={{ backgroundColor: color, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: textColor, fontSize: font.tiny, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSide: { width: 96, justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' },
  backBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  backText: { color: colors.text, fontSize: 34, lineHeight: 36, fontWeight: '300' },
  scrollContent: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: 120, alignItems: 'center' },
  contentWidth: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  button: { borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: '800', letterSpacing: 0.3 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  t_title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  t_h2: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  t_body: { color: colors.text, fontSize: font.body },
  t_small: { color: colors.text, fontSize: font.small },
  t_tiny: { color: colors.text, fontSize: font.tiny },
  t_label: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
    flexWrap: 'wrap',
  },
  segment: { flexGrow: 1, paddingVertical: 9, paddingHorizontal: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  segmentTextActive: { color: colors.accentText },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  numberField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  stepText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  numberInput: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', paddingVertical: 6 },
  suffix: { color: colors.muted, fontSize: 13, marginLeft: -4, marginRight: 2 },
  selectList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  selectOption: { paddingHorizontal: space.md, paddingVertical: 12 },
  input: {
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: space.md,
  },
});
