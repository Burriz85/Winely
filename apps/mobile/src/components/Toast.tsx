import { C } from '@vinskap/shared';
import { Text, View } from 'react-native';
import { figtree } from '../lib/theme';
import { useUI } from '../lib/ui';

export function Toast() {
  const { toast } = useUI();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 20, right: 20, bottom: 112, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 4, backgroundColor: C.coal, zIndex: 30 }}>
      <Text style={{ ...figtree(500), fontSize: 14, color: C.ivory }}>{toast}</Text>
    </View>
  );
}
