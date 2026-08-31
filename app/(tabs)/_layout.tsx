import { Redirect, Tabs } from 'expo-router';
import { COLORS } from '@/src/components/theme';
import { useApp } from '@/src/store/AppProvider';

export default function TabLayout() {
  const { state } = useApp();
  if (!state.onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          minHeight: 66,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ajouter une tâche' }} />
      <Tabs.Screen name="score" options={{ title: 'Score' }} />
      <Tabs.Screen name="todo" options={{ title: 'To-do' }} />
    </Tabs>
  );
}
