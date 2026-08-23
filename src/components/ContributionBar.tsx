import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from './theme';

export function ContributionBar({ value, color }: { value: number; color: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <View accessibilityLabel={`${Math.round(safeValue)} pour cent`} style={styles.row}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${safeValue}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.value}>{Math.round(safeValue)} %</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: RADIUS.pill,
  },
  value: {
    width: 42,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
});
