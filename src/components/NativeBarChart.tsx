import { StyleSheet, Text, View } from 'react-native';
import type { HistoryPoint } from '../domain/leaderboard';
import { COLORS, RADIUS, SPACING } from './theme';

export function NativeBarChart({ points, unit }: { points: HistoryPoint[]; unit: 'pts' | 'min' }) {
  const max = Math.max(1, ...points.map((point) => point.value));

  return (
    <View style={styles.chart} accessibilityRole="summary" accessibilityLabel="Graphique des sept derniers jours">
      {points.map((point) => {
        const height = point.value === 0 ? 3 : Math.max(10, (point.value / max) * 118);
        const valueLabel = `${Math.round(point.value * 10) / 10} ${unit}`;
        return (
          <View
            key={point.key}
            accessible
            accessibilityLabel={`${point.label}, ${valueLabel}, ${point.taskCount} tâches`}
            style={styles.column}
          >
            <Text style={styles.value}>{point.value === 0 ? '—' : Math.round(point.value)}</Text>
            <View style={styles.barArea}>
              <View style={[styles.bar, { height }]} />
            </View>
            <Text style={styles.label}>{point.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    height: 178,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    minHeight: 18,
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  barArea: {
    height: 122,
    width: '65%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    minHeight: 3,
    backgroundColor: COLORS.success,
    borderTopLeftRadius: RADIUS.sm,
    borderTopRightRadius: RADIUS.sm,
  },
  label: {
    marginTop: SPACING.xs,
    color: COLORS.textSecondary,
    fontSize: 10,
    textTransform: 'capitalize',
  },
});
