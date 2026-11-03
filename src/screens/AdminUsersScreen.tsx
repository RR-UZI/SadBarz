// Admins only: every account, searchable, with a switch to give or take away Pro.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';

import { Badge, Button, Card, Field, Row, Screen, Section, Txt } from '../components/ui';
import { useT } from '../i18n';
import { type AdminUser, listUsers, setUserPlan } from '../lib/adminUsers';
import { confirm } from '../lib/confirm';
import { useNav } from '../navigation';
import { useApp } from '../store/AppStore';
import { useAuth } from '../store/Auth';
import { colors, space } from '../theme';

export function AdminUsersScreen() {
  const t = useT();
  const nav = useNav();
  const { settings } = useApp();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const asked = useRef(0);

  const load = useCallback((q: string) => {
    const n = ++asked.current;
    listUsers(q)
      .then((u) => {
        if (n !== asked.current) return;
        setUsers(u);
        setFailed(null);
      })
      .catch((e: unknown) => {
        if (n !== asked.current) return;
        setFailed(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
      });
  }, []);

  // Search as they type, a moment after they stop.
  useEffect(() => {
    const id = setTimeout(() => load(search), 300);
    return () => clearTimeout(id);
  }, [search, load]);

  const day = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  const change = (u: AdminUser, plan: AdminUser['plan']) => {
    const go = () => {
      setBusy(u.id);
      setUserPlan(u.id, plan)
        .then(() => setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, plan } : x)) ?? list))
        .catch((e: unknown) => setFailed(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)))
        .finally(() => setBusy(null));
    };
    if (plan === 'pro') go();
    else confirm(t('users.removeConfirm', { name: u.name || u.email }), go, t('users.remove'), t('common.cancel'));
  };

  if (!user?.admin) {
    return (
      <Screen title={t('users.title')} onBack={nav.pop}>
        <Txt color={colors.muted}>—</Txt>
      </Screen>
    );
  }

  return (
    <Screen title={t('users.title')} onBack={nav.pop}>
      <Field value={search} onChangeText={setSearch} placeholder={t('users.search')} inputProps={{ autoCapitalize: 'none', autoCorrect: false }} />
      <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
        {t('users.help')}
      </Txt>
      {failed ? (
        <Txt color={colors.danger} style={{ marginTop: space.md }}>
          {t('users.error', { e: failed })}
        </Txt>
      ) : null}
      {!users ? (
        failed ? null : <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : users.length === 0 ? (
        <Txt color={colors.muted} style={{ marginTop: space.xl }}>
          {t('users.none')}
        </Txt>
      ) : (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          {users.map((u) => (
            <Card key={u.id}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: space.md }}>
                  <Txt style={{ fontWeight: '800' }} numberOfLines={1}>
                    {u.name || u.email}
                  </Txt>
                  {u.name ? (
                    <Txt variant="small" color={colors.muted} numberOfLines={1}>
                      {u.email}
                    </Txt>
                  ) : null}
                  <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                    {u.plan === 'pro' ? <Badge label="PRO" color={colors.accent} textColor={colors.accentText} /> : <Badge label="FREE" />}
                    {u.admin ? <Badge label="ADMIN" /> : null}
                    {u.coach ? <Badge label="COACH" /> : null}
                    {day(u.createdAt) ? (
                      <Txt variant="tiny" color={colors.faint}>
                        {t('users.joined', { date: day(u.createdAt) ?? '' })}
                      </Txt>
                    ) : null}
                  </Row>
                </View>
                {busy === u.id ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <Switch
                      value={u.plan === 'pro'}
                      onValueChange={(on) => change(u, on ? 'pro' : 'free')}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={u.plan === 'pro' ? colors.accentText : colors.muted}
                      {...({ activeThumbColor: colors.accentText } as object)}
                      accessibilityLabel={`Pro · ${u.email}`}
                    />
                    <Txt variant="tiny" color={colors.muted}>
                      Pro
                    </Txt>
                  </View>
                )}
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

// ---------- Home card (admins only) ----------

export function UsersHomeCard() {
  const t = useT();
  const nav = useNav();
  return (
    <Section title={t('users.title')}>
      <Card>
        <Txt>{t('users.homeBody')}</Txt>
        <Button label={t('users.open')} size="sm" variant="secondary" style={{ marginTop: space.md }} onPress={() => nav.push({ name: 'adminUsers' })} />
      </Card>
    </Section>
  );
}
