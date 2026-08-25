import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { Card } from './Card';
import { COLORS, SPACING } from './theme';

/**
 * Écran d'attente et d'erreur de l'hydratation (DRC-02).
 *
 * Affiché à la place de toute route tant que l'état local n'est pas prêt :
 * aucune donnée fictive ne peut clignoter. Le chargement est calme et annoncé ;
 * l'erreur propose une reprise explicite plutôt qu'un crash.
 */
export function HydrationGate({
  error,
  onRetry,
}: {
  error?: string;
  onRetry?: () => void;
}) {
  if (error !== undefined) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            Ouverture impossible
          </Text>
          <Text accessibilityLiveRegion="assertive" style={styles.message}>
            {error}
          </Text>
          {onRetry !== undefined ? (
            <AppButton
              label="Réessayer"
              accessibilityLabel="Réessayer l’ouverture des données locales"
              onPress={onRetry}
            />
          ) : null}
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={COLORS.success} />
      <Text accessibilityRole="header" style={styles.loadingTitle}>
        Préparation de la démonstration…
      </Text>
      <Text style={styles.loadingMessage}>Lecture des données locales de cet appareil.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: SPACING.md,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  loadingTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingMessage: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
