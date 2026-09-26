import { C } from '@vinskap/shared';
import { usePathname, useRouter } from 'expo-router';
import { Clock, Menu, ScanBarcode } from 'lucide-react-native';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { em, figtree } from '../lib/theme';
import { useUI } from '../lib/ui';

function Tab({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon: (c: string) => React.ReactNode }) {
  const color = active ? C.sageDark : C.coalSoft;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}
      style={{ alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 64, height: 44 }}>
      {icon(color)}
      <Text style={{ ...figtree(500), fontSize: 10, letterSpacing: em(10, 0.18), textTransform: 'uppercase', color }}>{label}</Text>
    </Pressable>
  );
}

export function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const { setScan } = useUI();
  const insets = useSafeAreaInsets();
  const onHistory = path.startsWith('/history');
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
      paddingTop: 10, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 10) + (insets.bottom ? 0 : 10),
      borderTopWidth: 1, borderTopColor: C.sageLight, backgroundColor: C.ivory,
    }}>
      <Tab label="Skapet" active={!onHistory} onPress={() => router.navigate('/')}
        icon={(c) => <Menu size={22} color={c} strokeWidth={1.6} />} />
      <Pressable
        onPress={() => setScan({ phase: 'cam' })}
        accessibilityLabel="Skann strekkode"
        style={{
          width: 64, height: 64, marginTop: -30, borderRadius: 32, backgroundColor: C.coal, alignItems: 'center', justifyContent: 'center',
          // Eneste skygge i designet
          ...(Platform.OS === 'web'
            ? ({ boxShadow: '0 6px 18px rgba(42,37,32,0.25)' } as object)
            : { shadowColor: C.coal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 9, elevation: 8 }),
        }}
      >
        <ScanBarcode size={28} color={C.ivory} strokeWidth={1.6} />
      </Pressable>
      <Tab label="Historikk" active={onHistory} onPress={() => router.navigate('/history')}
        icon={(c) => <Clock size={22} color={c} strokeWidth={1.6} />} />
    </View>
  );
}
