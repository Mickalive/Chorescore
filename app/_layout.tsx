import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaywallModal } from '@/src/components/PaywallModal';
import { COLORS } from '@/src/components/theme';
import { AppProvider } from '@/src/store/AppProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <PaywallModal />
      </AppProvider>
    </SafeAreaProvider>
  );
}
