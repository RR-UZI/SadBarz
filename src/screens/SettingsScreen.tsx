import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Divider, Row, Screen, Section, Segmented, ToggleRow, Txt } from '../components/ui';
import { useT } from '../i18n';
import { confirm } from '../lib/confirm';
import { sounds, unlockAudio } from '../lib/sound';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, space } from '../theme';
import type { Settings } from '../types';

export function SettingsScreen() {
  const t = useT();
  const nav = useNav();
  const { settings, updateSettings, reloadExamples } = useApp();
  const { user, mode, signOut } = useAuth();
  const [reloaded, setReloaded] = useState(false);
  const set = (patch: Partial<Settings>) => updateSettings(patch);

  return (
    <Screen title={t('settings.title')} onBack={nav.pop}>
      <Section title={t('settings.account')}>
        <Card>
          <Txt style={{ fontWeight: '800', fontSize: 17 }}>{user?.name}</Txt>
          <Txt variant="small" color={colors.muted}>
            {user?.email}
          </Txt>
          {mode === 'preview' ? (
            <Txt variant="tiny" color={colors.warn} style={{ marginTop: 6 }}>
              {t('auth.preview')}
            </Txt>
          ) : null}
        </Card>
        <Button
          label={t('settings.signOut')}
          variant="ghost"
          style={{ marginTop: space.sm }}
          onPress={() =>
            confirm(
              t('settings.signOutConfirm'),
              () => {
                nav.reset('home');
                void signOut();
              },
              t('settings.signOut'),
              t('common.cancel'),
            )
          }
        />
      </Section>

      <Section title={t('settings.language')}>
        <Segmented
          value={settings.language}
          onChange={(language) => set({ language })}
          options={[
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Section>

      <Section title={t('settings.timer')}>
        <View style={{ gap: 6, marginBottom: space.md }}>
          <Txt variant="small" color={colors.muted}>
            {t('settings.leadIn')}
          </Txt>
          <Segmented
            small
            value={settings.leadInSec}
            onChange={(leadInSec) => set({ leadInSec })}
            options={[
              { value: 0, label: t('settings.off') },
              { value: 3, label: '3 s' },
              { value: 5, label: '5 s' },
              { value: 10, label: '10 s' },
            ]}
          />
        </View>
        <ToggleRow label={t('settings.startSound')} value={settings.startSound} onChange={(startSound) => set({ startSound })} />
        <ToggleRow label={t('settings.roundSound')} value={settings.roundSound} onChange={(roundSound) => set({ roundSound })} />
        <ToggleRow label={t('settings.endSound')} value={settings.endSound} onChange={(endSound) => set({ endSound })} />
        <ToggleRow label={t('settings.vibration')} value={settings.vibration} onChange={(vibration) => set({ vibration })} />
        <ToggleRow label={t('settings.voice')} value={settings.voice} onChange={(voice) => set({ voice })} />
        <ToggleRow label={t('settings.keepAwake')} value={settings.keepAwake} onChange={(keepAwake) => set({ keepAwake })} />

        <View style={{ gap: 6, marginTop: space.lg }}>
          <Txt variant="small" color={colors.muted}>
            {t('settings.lastBeeps')}
          </Txt>
          <Segmented
            small
            value={settings.lastBeepsSec}
            onChange={(lastBeepsSec) => set({ lastBeepsSec })}
            options={[
              { value: 0, label: t('settings.off') },
              { value: 3, label: '3 s' },
              { value: 5, label: '5 s' },
            ]}
          />
        </View>

        <View style={{ gap: 6, marginTop: space.lg }}>
          <Txt variant="small" color={colors.muted}>
            {t('settings.volume')}
          </Txt>
          <Segmented
            small
            value={Math.round(settings.volume * 100)}
            onChange={(v) => set({ volume: v / 100 })}
            options={[0, 25, 50, 80, 100].map((v) => ({ value: v, label: `${v}%` }))}
          />
          <Button
            label={`♪ ${t('settings.testSound')}`}
            variant="ghost"
            size="sm"
            onPress={() => {
              unlockAudio();
              sounds.start(settings.vibration);
            }}
          />
        </View>
      </Section>

      <Section title={t('settings.break')}>
        <Segmented
          small
          value={settings.breakMode}
          onChange={(breakMode) => set({ breakMode })}
          options={[
            { value: 'ask', label: t('settings.break.ask') },
            { value: 'fixed', label: t('settings.break.fixed') },
          ]}
        />
        {settings.breakMode === 'fixed' ? (
          <View style={{ gap: 6, marginTop: space.md }}>
            <Txt variant="small" color={colors.muted}>
              {t('settings.fixedBreak')}
            </Txt>
            <Segmented
              small
              value={settings.fixedBreakSec}
              onChange={(fixedBreakSec) => set({ fixedBreakSec })}
              options={[60, 120, 180, 300].map((s) => ({ value: s, label: `${s / 60} min` }))}
            />
          </View>
        ) : null}
        <View style={{ gap: 6, marginTop: space.md }}>
          <Txt variant="small" color={colors.muted}>
            {t('settings.afterBreak')}
          </Txt>
          <Segmented
            small
            value={settings.autoStartNext ? 'auto' : 'wait'}
            onChange={(v) => set({ autoStartNext: v === 'auto' })}
            options={[
              { value: 'wait', label: t('settings.afterBreak.wait') },
              { value: 'auto', label: t('settings.afterBreak.auto') },
            ]}
          />
        </View>
      </Section>

      <Section title={t('settings.data')}>
        <Button
          label={t('settings.resetExamples')}
          variant="secondary"
          onPress={() => {
            reloadExamples();
            setReloaded(true);
          }}
        />
        {reloaded ? (
          <Txt variant="small" color={colors.success} style={{ marginTop: space.sm }}>
            {t('settings.resetDone')}
          </Txt>
        ) : null}
      </Section>

      <Divider />
      <Row style={{ justifyContent: 'center' }}>
        <Txt variant="tiny" color={colors.faint}>
          {t('settings.about')}
        </Txt>
      </Row>
    </Screen>
  );
}
