import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import { Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { C } from '@vinskap/shared';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiSheet } from '../components/ApiSheet';
import { Login } from '../components/Login';
import { ManualWineSheet } from '../components/ManualWineSheet';
import { ProfileSheet } from '../components/ProfileSheet';
import { ScanOverlay } from '../components/ScanOverlay';
import { SearchOverlay } from '../components/SearchOverlay';
import { TabBar } from '../components/TabBar';
import { Toast } from '../components/Toast';
import { AuthProvider, useAuth } from '../lib/auth';
import { CellarProvider, useQueueRunner } from '../lib/data';
import { CONFIG_OK } from '../lib/supabase';
import { figtree } from '../lib/theme';
import { UIProvider, useUI } from '../lib/ui';

function Shell() {
  const { ready, session } = useAuth();
  const { flash } = useUI();
  useQueueRunner(flash, !!session);
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.ivory }} />;
  if (!session) return <Login />;
  return (
    <View style={{ flex: 1, backgroundColor: C.ivory }}>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <TabBar />
      <ScanOverlay />
      <SearchOverlay />
      <ManualWineSheet />
      <ApiSheet />
      <ProfileSheet />
      <Toast />
    </View>
  );
}

export default function RootLayout() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [fontsLoaded] = useFonts({
    Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
  });
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* På web vises appen i en telefonbred kolonne. */}
      <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? C.ivoryDark : C.ivory, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 480 : undefined, backgroundColor: C.ivory, overflow: 'hidden' }}>
          {!CONFIG_OK ? (
            <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
              <Text style={{ ...figtree(500), fontSize: 15, color: C.red }}>
                Mangler EXPO_PUBLIC_SUPABASE_URL eller EXPO_PUBLIC_SUPABASE_ANON_KEY da appen ble bygget. Legg dem inn i Netlify (Environment variables) og bygg på nytt (Trigger deploy).
              </Text>
            </View>
          ) : (
            <QueryClientProvider client={qc}>
              <AuthProvider>
                <UIProvider>
                  <CellarProvider>
                    <Shell />
                  </CellarProvider>
                </UIProvider>
              </AuthProvider>
            </QueryClientProvider>
          )}
        </View>
      </View>
    </SafeAreaProvider>
  );
}
