import { C, isEmail } from '@vinskap/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { figtree, t } from '../lib/theme';
import { Btn, Field } from './ui';

/**
 * Logg inn / Aktiver konto.
 * Registrering er stengt. «Aktiver konto» bruker koden fra invitasjonen (eller fra e-posten
 * om nytt passord), så det trengs ingen dyplenker inn i appen.
 */
export function Login() {
  const { signIn, activate } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!isEmail(e)) return setErr('Skriv inn en gyldig e-postadresse.');
    if (!isLogin && !/^\d{6,10}$/.test(code.trim())) return setErr('Skriv inn koden fra e-posten.');
    if (pw.length < 8) return setErr('Passordet må ha minst 8 tegn.');
    setBusy(true); setErr(null);
    const res = isLogin ? await signIn(e, pw) : await activate({ email: e, code: code.trim(), password: pw, name: name.trim() });
    setBusy(false);
    if (res) setErr(res);
  };

  const switchTo = (m: 'login' | 'register') => { setMode(m); setErr(null); };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, backgroundColor: C.ivory }}>
      <ScrollView contentContainerStyle={{ paddingTop: 72, paddingHorizontal: 24, paddingBottom: 40, gap: 28 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 14 }}>
          <Image source={require('../../assets/monogram-bg-sage.png')} accessibilityLabel="B & G" contentFit="contain"
            style={{ width: 132, height: 132, alignSelf: 'center', marginBottom: 8 }} />
          <Text style={t.label}>Vinskap · Oversikt over kjelleren</Text>
          <Text style={t.hero}>{isLogin ? 'Logg inn' : 'Aktiver konto'}</Text>
        </View>
        <View style={{ gap: 14 }}>
          {!isLogin && <Field label="Navn" value={name} onChangeText={setName} autoComplete="name" height={48} size={16} onSubmitEditing={submit} />}
          <Field label="E-post" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" height={48} size={16} onSubmitEditing={submit} />
          {!isLogin && <Field label="Kode fra e-posten" value={code} onChangeText={setCode} keyboardType="number-pad" inputMode="numeric" autoComplete="one-time-code" height={48} size={16} onSubmitEditing={submit} />}
          <Field label={isLogin ? 'Passord' : 'Nytt passord'} value={pw} onChangeText={setPw} secureTextEntry autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="Minst 8 tegn" height={48} size={16} onSubmitEditing={submit} />
          {err && <Text style={{ ...figtree(400), fontSize: 14, color: C.red }}>{err}</Text>}
          <Btn label={busy ? 'Vent …' : isLogin ? 'Logg inn' : 'Aktiver konto'} height={56} size={16} onPress={submit} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Text style={{ ...figtree(400), fontSize: 14, color: C.coalSoft }}>{isLogin ? 'Fått invitasjon?' : 'Har du konto?'}</Text>
          <Pressable onPress={() => switchTo(isLogin ? 'register' : 'login')} accessibilityRole="button">
            <Text style={{ ...figtree(600), fontSize: 14, color: C.sageDark }}>{isLogin ? 'Aktiver konto' : 'Logg inn'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
