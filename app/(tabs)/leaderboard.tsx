import { Redirect } from 'expo-router';

/** Redirect legacy Classement tab to canonical Score tab. */
export default function LegacyLeaderboardRedirect() {
  return <Redirect href="/(tabs)/score" />;
}
