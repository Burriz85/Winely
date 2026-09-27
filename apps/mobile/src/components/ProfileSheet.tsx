import { useQueryClient } from '@tanstack/react-query';
import { C, displayLogin, initial, toLoginEmail } from '@vinskap/shared';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { useCellar, usePeople, useVmpStatus } from '../lib/data';
import { queue } from '../lib/queue';
import { supabase } from '../lib/supabase';
import { figtree, syne, t } from '../lib/theme';
import { useUI, type ListView } from '../lib/ui';
import { apiLabel } from './ApiSheet';
import { Sheet } from './Sheet';
import { Btn, Chip, Dot, Field, LinkBtn } from './ui';

export function ProfileSheet() {
  const { profileOpen, setProfileOpen, setApiOpen, flash, listView, setListView } = useUI();
  const { session, profile, signOut, changePassword } = useAuth();
  const { cellar, cellars, setCellar } = useCellar();
  const people = usePeople(profileOpen ? cellar?.id : undefined);
  const status = useVmpStatus(true);
  const qc = useQueryClient();
  const [invite, setInvite] = useState('');
  const [newPw, setNewPw] = useState('');
  if (!profileOpen || !session) return null;

  const email = session.user.email ?? '';
  const name = profile?.name || displayLogin(email);
  const isOwner = cellar?.role === 'owner';
  const members = (people.data ?? []).filter((p) => !p.is_me && p.role !== 'owner');

  const add = async () => {
    const e = toLoginEmail(invite);
    if (!e) return flash('Skriv inn et brukernavn eller en e-postadresse');
    if (!cellar) return;
    if (e === email.toLowerCase() || members.some((m) => m.email.toLowerCase() === e)) return;
    const { data, error } = await supabase.rpc('invite_to_cellar', { p_cellar: cellar.id, p_email: e });
    if (error) return flash('Kunne ikke invitere: ' + error.message);
    setInvite('');
    qc.invalidateQueries({ queryKey: ['people', cellar.id] });
    // Det sendes ingen e-post. Finnes ikke brukeren ennå, får hen tilgang når admin oppretter den.
    flash(data === 'added' ? displayLogin(e) + ' har nå tilgang til skapet' : 'Lagret · ' + displayLogin(e) + ' får tilgang når admin har opprettet brukeren');
  };

  const remove = async (e: string) => {
    if (!cellar) return;
    const { error } = await supabase.rpc('remove_from_cellar', { p_cellar: cellar.id, p_email: e });
    if (error) return flash('Kunne ikke fjerne: ' + error.message);
    qc.invalidateQueries({ queryKey: ['people', cellar.id] });
  };

  const section = [t.section];
  return (
    <Sheet onClose={() => setProfileOpen(false)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.sageDark, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...syne(800), fontSize: 22, color: C.ivory }}>{initial(profile?.name, email)}</Text>
        </View>
        <View style={{ gap: 2, minWidth: 0, flex: 1 }}>
          <Text style={{ ...syne(700), fontSize: 20, color: C.coal }}>{name}</Text>
          <Text style={{ ...figtree(400), fontSize: 13, color: C.coalSoft }}>{displayLogin(email)}</Text>
        </View>
        <LinkBtn label="Lukk" color={C.coal} onPress={() => setProfileOpen(false)} />
      </View>

      {isOwner && (
        <View style={{ gap: 10 }}>
          <Text style={section}>Del skapet</Text>
          <Text style={{ ...figtree(400), fontSize: 14, lineHeight: 21, color: C.coalSoft }}>De du inviterer kan se skapet og registrere flasker inn og ut.</Text>
          {members.map((m) => (
            <View key={m.email} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.ivoryDark }}>
              <Text numberOfLines={1} style={{ ...figtree(400), fontSize: 14, color: C.coal, flexShrink: 1 }}>
                {displayLogin(m.email)}{m.pending ? '  · venter' : ''}
              </Text>
              <LinkBtn label="Fjern" color={C.red} size={13} onPress={() => remove(m.email)} />
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field value={invite} onChangeText={setInvite} placeholder="Brukernavn eller e-post" autoCapitalize="none" autoCorrect={false} size={14} style={{ flex: 1, minWidth: 0 }} onSubmitEditing={add} />
            <Btn label="Inviter" onPress={add} />
          </View>
        </View>
      )}

      <View>
        <Text style={section}>Innstillinger</Text>
        <Pressable onPress={() => { setProfileOpen(false); setApiOpen(true); }}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48, borderBottomWidth: 1, borderBottomColor: C.ivoryDark }}>
          <Text style={{ ...figtree(400), fontSize: 15, color: C.coal }}>Vinmonopolet-API</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Dot on={status.isSuccess} />
            <Text style={{ ...figtree(400), fontSize: 13, color: C.coalSoft }}>{apiLabel(status)}</Text>
          </View>
        </Pressable>
        <View style={{ paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: C.ivoryDark }}>
          <Text style={{ ...figtree(400), fontSize: 15, color: C.coal }}>Visning</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(['Rader', 'Kort', 'Drikkevindu'] as ListView[]).map((v) => <Chip key={v} label={v} pad={12} active={listView === v} onPress={() => setListView(v)} />)}
          </View>
        </View>
        {cellars.length > 1 && (
          <View style={{ paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: C.ivoryDark }}>
            <Text style={{ ...figtree(400), fontSize: 15, color: C.coal }}>Skap</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {cellars.map((c) => (
                <Chip key={c.id} pad={12} active={c.id === cellar?.id} onPress={() => setCellar(c.id)}
                  label={c.name + (c.role === 'member' ? ' (delt)' : '')} />
              ))}
            </View>
          </View>
        )}
      </View>
      <View style={{ gap: 10 }}>
        <Text style={section}>Bytt passord</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field value={newPw} onChangeText={setNewPw} placeholder="Nytt passord, minst 8 tegn" secureTextEntry autoComplete="new-password" size={14} style={{ flex: 1, minWidth: 0 }} />
          <Btn label="Lagre" onPress={async () => {
            if (newPw.length < 8) return flash('Passordet må ha minst 8 tegn');
            const err = await changePassword(newPw);
            if (err) return flash(err);
            setNewPw('');
            flash('Passordet er byttet');
          }} />
        </View>
      </View>
      <Btn label="Logg ut" kind="outline" height={52} size={15} onPress={async () => {
        const n = queue.get().length;
        if (n) return flash(n + ' registrering(er) er ikke sendt ennå. Koble til nettet før du logger ut.');
        setProfileOpen(false);
        qc.clear();
        await signOut();
      }} />
    </Sheet>
  );
}
