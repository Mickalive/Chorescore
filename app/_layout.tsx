import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaywallModal } from '@/src/components/PaywallModal';
import { HydrationGate } from '@/src/components/HydrationGate';
import { COLORS } from '@/src/components/theme';
import { AppProvider, useApp } from '@/src/store/AppProvider';

/**
 * Tant que l'hydratation du stockage local n'est pas terminée, aucune route ne
 * se rend : les données fictives de démonstration ne peuvent pas clignoter.
 */
function HydrationBoundary() {
  const { state, retryHydration } = useApp();
  if (state.hydration.phase === 'loading') {
    return <HydrationGate />;
  }
  if (state.hydration.phase === 'error') {
    return <HydrationGate error={state.hydration.message} onRetry={retryHydration} />;
  }
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <PaywallModal />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <HydrationBoundary />
      </AppProvider>
    </SafeAreaProvider>
  );
}
