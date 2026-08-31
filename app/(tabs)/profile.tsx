import { Redirect } from 'expo-router';

/** Redirect legacy Profil tab to canonical Ajouter une tâche tab. */
export default function LegacyProfileRedirect() {
  return <Redirect href="/(tabs)" />;
}
