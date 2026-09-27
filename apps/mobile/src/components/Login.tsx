import { C, toLoginEmail } from '@vinskap/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { figtree, t } from '../lib/theme';
import { Btn, Field } from './ui';

/**
 * Logg inn. Registrering er stengt, og admin oppretter brukerne med brukernavn og passord.
 * Derfor finnes ikke prototypens «Aktiver konto» her.
 */
export function Login() {
  const { signIn } = useAuth();
  const [login, setLogin] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const email = toLoginEmail(login);
    if (!email) return setErr('Skriv inn brukernavnet eller e-postadressen din.');
    if (pw.length < 8) return setErr('Passordet må ha minst 8 tegn.');
    setBusy(true); setErr(null);
    const res = await signIn(email, pw);
    setBusy(false);
    if (res) setErr(res);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, backgroundColor: C.ivory }}>
      <ScrollView contentContainerStyle={{ paddingTop: 72, paddingHorizontal: 24, paddingBottom: 40, gap: 28 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 14 }}>
          <Image source={require('../../assets/monogram-bg-sage.png')} accessibilityLabel="B & G" contentFit="contain"
            style={{ width: 132, height: 132, alignSelf: 'center', marginBottom: 8 }} />
          <Text style={t.label}>Vinskap · Oversikt over kjelleren</Text>
          <Text style={t.hero}>Logg inn</Text>
        </View>
        <View style={{ gap: 14 }}>
          <Field label="Brukernavn" value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} autoComplete="username" height={48} size={16} onSubmitEditing={submit} />
          <Field label="Passord" value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" placeholder="Minst 8 tegn" height={48} size={16} onSubmitEditing={submit} />
          {err && <Text style={{ ...figtree(400), fontSize: 14, color: C.red }}>{err}</Text>}
          <Btn label={busy ? 'Vent …' : 'Logg inn'} height={56} size={16} onPress={submit} />
        </View>
        <Text style={{ ...figtree(400), fontSize: 14, color: C.coalSoft, textAlign: 'center' }}>Har du ikke bruker? Spør administrator.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
