import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { COLORS, SPACING } from './theme';

export function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {detail === undefined ? null : <Text style={styles.detail}>{detail}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    gap: SPACING.xs,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  detail: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
});
