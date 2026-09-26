import { C } from '@vinskap/shared';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Handle } from './ui';

/** Bunnark med mørk bakgrunn (profil, API). */
export function Sheet({ onClose, children, gap = 18 }: { onClose: () => void; children: ReactNode; gap?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 26, backgroundColor: 'rgba(42,37,32,0.45)', justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Lukk" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '88%' }}>
        <ScrollView
          style={{ backgroundColor: C.ivory, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 12) + 22, gap }}
          keyboardShouldPersistTaps="handled"
        >
          <Handle />
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
