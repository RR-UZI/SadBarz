// Shown once after sign in (and again when TERMS_VERSION goes up): the athlete
// accepts the terms, the privacy notice and the use of their health data. For
// athletes 13 to 17 a parent or guardian accepts for them.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { LegalLinks, LegalModal } from '../components/LegalModal';
import { LogoMark } from '../components/Logo';
import { Button, Field, Screen, Segmented, Txt } from '../components/ui';
import { useT } from '../i18n';
import type { LegalDoc } from '../legal/texts';
import { useAuth, validEmail, type AuthError } from '../store/Auth';
import { colors, radius, space } from '../theme';

export function TermsScreen() {
  const t = useT();
  const { acceptTerms, signOut } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [open, setOpen] = useState<LegalDoc | null>(null);
  const [minor, setMinor] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const guardianOk = guardianName.trim().length > 1 && validEmail(guardianEmail);
  const canAccept = checked && (!minor || guardianOk);

  const accept = async () => {
    setBusy(true);
    setError(null);
    const res = await acceptTerms(minor ? { name: guardianName.trim(), email: guardianEmail.trim().toLowerCase() } : undefined);
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {error ? (
            <Txt variant="small" color={colors.danger} style={{ textAlign: 'center' }}>
              {t(`auth.error.${error}`)}
            </Txt>
          ) : null}
          <Button label={t('legal.continue')} size="lg" disabled={!canAccept || busy} onPress={accept} />
          <Button label={t('settings.signOut')} variant="ghost" size="sm" onPress={() => void signOut()} />
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: space.md, marginTop: space.xl }}>
        <LogoMark size={64} />
        <Txt variant="title" style={{ textAlign: 'center' }}>
          {t('legal.title')}
        </Txt>
        <Txt color={colors.muted} style={{ textAlign: 'center' }}>
          {t('legal.intro')}
        </Txt>
      </View>

      <View style={{ gap: space.sm, marginTop: space.xl }}>
        {(['legal.point.health', 'legal.point.content', 'legal.point.data'] as const).map((k) => (
          <Txt key={k} variant="small">
            {`• ${t(k)}`}
          </Txt>
        ))}
      </View>

      <View style={{ marginTop: space.lg }}>
        <LegalLinks onOpen={setOpen} />
      </View>

      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <Txt variant="small" color={colors.muted}>
          {t('legal.ageGroup')}
        </Txt>
        <Segmented
          value={minor ? 'minor' : 'adult'}
          onChange={(v) => {
            setMinor(v === 'minor');
            setChecked(false);
          }}
          options={[
            { value: 'adult', label: t('legal.adult') },
            { value: 'minor', label: t('legal.minor') },
          ]}
        />
        <Txt variant="tiny" color={colors.muted}>
          {minor ? t('legal.minorHelp') : t('legal.under13')}
        </Txt>
        {minor ? (
          <View style={{ gap: space.md, marginTop: space.sm }}>
            <Field label={t('legal.guardianName')} value={guardianName} onChangeText={setGuardianName} inputProps={{ autoComplete: 'off' }} />
            <Field
              label={t('legal.guardianEmail')}
              value={guardianEmail}
              onChangeText={setGuardianEmail}
              inputProps={{ autoCapitalize: 'none', keyboardType: 'email-address', inputMode: 'email', autoComplete: 'off' }}
            />
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => setChecked((c) => !c)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={{
          flexDirection: 'row',
          gap: space.md,
          alignItems: 'flex-start',
          marginTop: space.xl,
          padding: space.lg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: checked ? colors.accent : colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: checked ? colors.accent : colors.muted,
            backgroundColor: checked ? colors.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <Txt style={{ color: colors.accentText, fontWeight: '900', lineHeight: 18 }}>✓</Txt> : null}
        </View>
        <Txt style={{ flex: 1, lineHeight: 22 }}>{t(minor ? 'legal.acceptGuardian' : 'legal.accept')}</Txt>
      </Pressable>

      <LegalModal doc={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}
