import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from './theme';

export function DemoBanner() {
  return (
    <View style={styles.banner} accessibilityRole="summary">
      <View style={styles.dot} />
      <View style={styles.copy}>
        <Text style={styles.label}>MODE DÉMONSTRATION</Text>
        <Text style={styles.detail}>Données fictives, sans compte, réseau ni paiement.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },
  copy: {
    flex: 1,
  },
  label: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  detail: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
