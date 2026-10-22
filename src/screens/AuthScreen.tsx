// Welcome, log in, sign up and password reset. Shown until someone is signed in.
import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Button, Card, Field, Row, Screen, Txt } from '../components/ui';
import { useT, type StringKey } from '../i18n';
import { MIN_PASSWORD, useAuth, type AuthError } from '../store/Auth';
import { colors, space } from '../theme';

type Mode = 'welcome' | 'login' | 'signup' | 'forgot' | 'forgotSent' | 'checkEmail' | 'newPassword';

export function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>(auth.recovering ? 'newPassword' : 'welcome');
  const [email, setEmail] = useState('');
  const go = (m: Mode) => setMode(m);

  if (auth.recovering || mode === 'newPassword') return <NewPassword />;
  if (mode === 'login') return <Login email={email} setEmail={setEmail} go={go} />;
  if (mode === 'signup') return <SignUp email={email} setEmail={setEmail} go={go} />;
  if (mode === 'forgot') return <Forgot email={email} setEmail={setEmail} go={go} />;
  if (mode === 'forgotSent') return <Message titleKey="auth.forgotTitle" textKey="auth.linkSent" email={email} go={go} />;
  if (mode === 'checkEmail') return <Message titleKey="auth.checkEmailTitle" textKey="auth.checkEmail" email={email} go={go} />;
  return <Welcome go={go} />;
}

type Go = (m: Mode) => void;
type EmailProps = { email: string; setEmail: (e: string) => void; go: Go };

function Welcome({ go }: { go: Go }) {
  const t = useT();
  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button label={t('auth.createAccount')} size="lg" onPress={() => go('signup')} />
          <Button label={t('auth.haveAccount')} variant="secondary" size="lg" onPress={() => go('login')} />
        </View>
      }
    >
      <View style={{ alignItems: 'center', paddingTop: space.xl * 2, gap: space.lg }}>
        <Image source={require('../../assets/logo-mark.png')} style={{ width: 126, height: 120 }} resizeMode="contain" accessibilityLabel="SadBarz" />
        <Image source={require('../../assets/logo-wordmark.png')} style={{ width: 260, height: 99 }} resizeMode="contain" accessibilityLabel="SadBarz" />
        <Txt color={colors.muted} style={{ textAlign: 'center', fontSize: 17, lineHeight: 24, maxWidth: 320 }}>
          {t('auth.tagline')}
        </Txt>
      </View>
      <PreviewNote />
    </Screen>
  );
}

function Login({ email, setEmail, go }: EmailProps) {
  const t = useT();
  const { signIn } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError(null);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await signIn(email, password);
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <Screen title=" " onBack={() => go('welcome')}>
      <Header title={t('auth.loginTitle')} />
      <View style={{ gap: space.md }}>
        <EmailField value={email} onChange={edit(setEmail)} />
        <PasswordField value={password} onChange={edit(setPassword)} label={t('auth.password')} onSubmit={submit} autoComplete="current-password" />
        <Pressable onPress={() => go('forgot')} hitSlop={8} style={{ alignSelf: 'flex-end' }} accessibilityRole="link">
          <Txt variant="small" color={colors.accent}>
            {t('auth.forgot')}
          </Txt>
        </Pressable>
        <ErrorText error={error} />
        <Button label={busy ? '…' : t('auth.login')} size="lg" onPress={submit} disabled={busy} />
        <SwitchLink textKey="auth.noAccount" linkKey="auth.signupLink" onPress={() => go('signup')} />
      </View>
      <PreviewNote />
    </Screen>
  );
}

function SignUp({ email, setEmail, go }: EmailProps) {
  const t = useT();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError(null);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await signUp(name, email, password);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else if (res.value) go('checkEmail');
  };

  return (
    <Screen title=" " onBack={() => go('welcome')}>
      <Header title={t('auth.signupTitle')} sub={t('auth.signupSub')} />
      <View style={{ gap: space.md }}>
        <Field
          label={t('auth.name')}
          value={name}
          onChangeText={edit(setName)}
          placeholder={t('auth.namePlaceholder')}
          inputProps={{ autoComplete: 'name', textContentType: 'name', autoCapitalize: 'words', returnKeyType: 'next' }}
        />
        <EmailField value={email} onChange={edit(setEmail)} />
        <PasswordField
          value={password}
          onChange={edit(setPassword)}
          label={t('auth.password')}
          hint={t('auth.passwordHint', { n: MIN_PASSWORD })}
          onSubmit={submit}
          autoComplete="new-password"
        />
        <ErrorText error={error} />
        <Button label={busy ? '…' : t('auth.createAccount')} size="lg" onPress={submit} disabled={busy} />
        <Txt variant="tiny" color={colors.faint} style={{ textAlign: 'center' }}>
          {t('auth.terms')}
        </Txt>
        <SwitchLink textKey="auth.haveAccountQ" linkKey="auth.alreadyLink" onPress={() => go('login')} />
      </View>
      <PreviewNote />
    </Screen>
  );
}

function Forgot({ email, setEmail, go }: EmailProps) {
  const t = useT();
  const { resetPassword } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError(null);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await resetPassword(email);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else go('forgotSent');
  };

  return (
    <Screen title=" " onBack={() => go('login')}>
      <Header title={t('auth.forgotTitle')} sub={t('auth.forgotSub')} />
      <View style={{ gap: space.md }}>
        <EmailField value={email} onChange={edit(setEmail)} onSubmit={submit} />
        <ErrorText error={error} />
        <Button label={busy ? '…' : t('auth.sendLink')} size="lg" onPress={submit} disabled={busy} />
      </View>
    </Screen>
  );
}

function NewPassword() {
  const t = useT();
  const { setNewPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError(null);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await setNewPassword(password);
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <Screen title=" ">
      <Header title={t('auth.newPasswordTitle')} />
      <View style={{ gap: space.md }}>
        <PasswordField
          value={password}
          onChange={edit(setPassword)}
          label={t('auth.newPassword')}
          hint={t('auth.passwordHint', { n: MIN_PASSWORD })}
          onSubmit={submit}
          autoComplete="new-password"
        />
        <ErrorText error={error} />
        <Button label={busy ? '…' : t('auth.savePassword')} size="lg" onPress={submit} disabled={busy} />
      </View>
    </Screen>
  );
}

function Message({ titleKey, textKey, email, go }: { titleKey: StringKey; textKey: StringKey; email: string; go: Go }) {
  const t = useT();
  const { mode } = useAuth();
  return (
    <Screen title=" " onBack={() => go('login')}>
      <View style={{ alignItems: 'center', gap: space.lg, paddingTop: space.xl }}>
        <Image source={require('../../assets/logo-mark.png')} style={{ width: 84, height: 80 }} resizeMode="contain" />
        <Txt variant="title" style={{ textAlign: 'center' }}>
          {t(titleKey)}
        </Txt>
        <Txt color={colors.muted} style={{ textAlign: 'center', lineHeight: 22 }}>
          {t(textKey, { email: email.trim().toLowerCase() })}
        </Txt>
        {mode === 'preview' ? (
          <Txt variant="small" color={colors.warn} style={{ textAlign: 'center' }}>
            {t('auth.previewNoEmail')}
          </Txt>
        ) : null}
        <Button label={t('auth.backToLogin')} size="lg" onPress={() => go('login')} style={{ alignSelf: 'stretch' }} />
      </View>
    </Screen>
  );
}

// ---------- pieces ----------

function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 6, marginBottom: space.xl, marginTop: space.sm }}>
      <Txt variant="title">{title}</Txt>
      {sub ? <Txt color={colors.muted}>{sub}</Txt> : null}
    </View>
  );
}

function EmailField({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit?: () => void }) {
  const t = useT();
  return (
    <Field
      label={t('auth.email')}
      value={value}
      onChangeText={onChange}
      placeholder="tu@correo.com"
      inputProps={{
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        autoCorrect: false,
        autoComplete: 'email',
        textContentType: 'emailAddress',
        inputMode: 'email',
        returnKeyType: onSubmit ? 'send' : 'next',
        onSubmitEditing: onSubmit,
      }}
    />
  );
}

function PasswordField({
  value,
  onChange,
  label,
  hint,
  onSubmit,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hint?: string;
  onSubmit: () => void;
  autoComplete: 'current-password' | 'new-password';
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        inputProps={{
          secureTextEntry: !visible,
          autoCapitalize: 'none',
          autoCorrect: false,
          autoComplete,
          textContentType: autoComplete === 'new-password' ? 'newPassword' : 'password',
          returnKeyType: 'go',
          onSubmitEditing: onSubmit,
        }}
        right={
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 6 }} accessibilityRole="button">
            <Txt variant="small" color={colors.muted} style={{ fontWeight: '700' }}>
              {visible ? t('auth.hide') : t('auth.show')}
            </Txt>
          </Pressable>
        }
      />
      {hint ? (
        <Txt variant="tiny" color={colors.faint}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

function ErrorText({ error }: { error: AuthError | null }) {
  const t = useT();
  if (!error) return null;
  return (
    <View accessibilityRole="alert">
      <Txt variant="small" color={colors.danger}>
        {t(`auth.error.${error}`, { n: MIN_PASSWORD })}
      </Txt>
    </View>
  );
}

function SwitchLink({ textKey, linkKey, onPress }: { textKey: StringKey; linkKey: StringKey; onPress: () => void }) {
  const t = useT();
  return (
    <Row style={{ justifyContent: 'center', marginTop: space.sm }} gap={6}>
      <Txt variant="small" color={colors.muted}>
        {t(textKey)}
      </Txt>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
        <Txt variant="small" color={colors.accent} style={{ fontWeight: '700' }}>
          {t(linkKey)}
        </Txt>
      </Pressable>
    </Row>
  );
}

function PreviewNote() {
  const t = useT();
  const { mode } = useAuth();
  if (mode !== 'preview') return null;
  return (
    <Card style={{ marginTop: space.xl, borderStyle: 'dashed', borderColor: colors.warn }}>
      <Txt variant="small" color={colors.warn}>
        {t('auth.preview')}
      </Txt>
    </Card>
  );
}
