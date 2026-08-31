import { Redirect } from 'expo-router';

/** Redirect legacy Historique tab to canonical Ajouter une tâche tab. */
export default function LegacyHistoryRedirect() {
  return <Redirect href="/(tabs)" />;
}
