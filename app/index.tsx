import { Redirect } from 'expo-router';
import { useApp } from '@/src/store/AppProvider';

export default function IndexScreen() {
  const { state } = useApp();
  return <Redirect href={state.onboardingComplete ? '/(tabs)' : '/onboarding'} />;
}
