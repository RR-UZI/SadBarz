// The "go Pro" pop-up, opened from anywhere with showPro() (see lib/plan.ts).
import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';

import { useT } from '../i18n';
import { FREE_ROUTINE_LIMIT, registerProHost, type ProReason } from '../lib/plan';
import { useAuth } from '../store/Auth';
import { colors, radius, space } from '../theme';
import { Badge, Button, Txt } from './ui';

export function ProHost() {
  const t = useT();
  const { markProInterest } = useAuth();
  const [reason, setReason] = useState<ProReason | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    registerProHost((r) => {
      setSent(false);
      setReason(r);
    });
    return () => registerProHost(null);
  }, []);

  const close = () => setReason(null);
  const perks = [t('pro.perk.routines'), t('pro.perk.coach'), t('pro.perk.history')];

  return (
    <Modal visible={reason !== null} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: space.lg }}>
        <View
          accessibilityRole="alert"
          style={{
            width: '100%',
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.accent,
            padding: space.xl,
            gap: space.lg,
          }}
        >
          <View style={{ alignSelf: 'flex-start' }}>
            <Badge label="SADBARZ PRO" color={colors.accent} textColor={colors.accentText} />
          </View>
          <View style={{ gap: space.sm }}>
            <Txt variant="title">{reason === 'routineLimit' ? t('pro.limitTitle', { n: FREE_ROUTINE_LIMIT }) : t('pro.title')}</Txt>
            <Txt color={colors.muted}>{reason === 'routineLimit' ? t('pro.limitBody', { n: FREE_ROUTINE_LIMIT }) : t('pro.body')}</Txt>
          </View>
          <View style={{ gap: space.sm }}>
            {perks.map((p) => (
              <Txt key={p} style={{ fontWeight: '700' }}>
                <Txt color={colors.accent} style={{ fontWeight: '900' }}>
                  {'✓  '}
                </Txt>
                {p}
              </Txt>
            ))}
          </View>
          <Txt variant="h2">{t('pro.price')}</Txt>
          {sent ? (
            <Txt color={colors.success} style={{ fontWeight: '700' }}>
              {t('pro.thanks')}
            </Txt>
          ) : (
            <Button
              label={t('pro.cta')}
              size="lg"
              onPress={() => {
                setSent(true);
                markProInterest();
              }}
            />
          )}
          <Button label={sent ? t('common.done') : t('pro.notNow')} variant="ghost" onPress={close} />
        </View>
      </View>
    </Modal>
  );
}
