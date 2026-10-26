// Shown once after sign in (and again when TERMS_VERSION goes up): the athlete
// accepts the terms, the privacy notice and the use of their health data.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { LegalLinks, LegalModal } from '../components/LegalModal';
import { LogoMark } from '../components/Logo';
import { Button, Screen, Txt } from '../components/ui';
import { useT } from '../i18n';
import type { LegalDoc } from '../legal/texts';
import { useAuth, type AuthError } from '../store/Auth';
import { colors, radius, space } from '../theme';

export function TermsScreen() {
  const t = useT();
  const { acceptTerms, signOut } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [open, setOpen] = useState<LegalDoc | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    const res = await acceptTerms();
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
          <Button label={t('legal.continue')} size="lg" disabled={!checked || busy} onPress={accept} />
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
        <Txt style={{ flex: 1, lineHeight: 22 }}>{t('legal.accept')}</Txt>
      </Pressable>

      <LegalModal doc={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}
