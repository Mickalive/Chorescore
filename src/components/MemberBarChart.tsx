import { StyleSheet, Text, View } from 'react-native';
import type { MemberBarDatum } from '../domain/scoreFilters';
import { COLORS, RADIUS, SPACING } from './theme';

/**
 * Graphique à barres horizontales montrant les membres directement nommés
 * à côté de chaque barre. Le nom est porté par le label, pas par la
 * couleur ; le composant fonctionne avec n'importe quel nombre de membres.
 *
 * Les minutes arrondies et la valeur (pondérée ou non) sont affichées
 * à droite de la barre pour une lisibilité immédiate.
 */
export function MemberBarChart({
  data,
  unit,
  showValue,
}: {
  data: MemberBarDatum[];
  unit: 'pts' | 'min';
  showValue: boolean;
}) {
  if (data.length === 0) {
    return null;
  }

  const maxMinutes = Math.max(1, ...data.map((d) => d.minutes));

  return (
    <View style={styles.container} accessibilityRole="summary" accessibilityLabel="Graphique de contribution par membre">
      {data.map((item) => {
        const barWidth = item.minutes === 0 ? 3 : Math.max(8, (item.minutes / maxMinutes) * 100);
        const roundedMinutes = Math.round(item.minutes);
        const valueLabel = `${Math.round(item.value * 10) / 10} ${unit}`;

        return (
          <View
            key={item.user.id}
            style={styles.row}
            accessible
            accessibilityLabel={`${item.user.name}, ${roundedMinutes} minutes${showValue ? `, ${valueLabel}` : ''}, ${item.entryCount} entrées`}
          >
            <Text style={styles.name} numberOfLines={1}>
              {item.user.name}
            </Text>
            <View style={styles.barArea}>
              <View style={[styles.bar, { width: `${barWidth}%`, backgroundColor: item.user.color }]} />
            </View>
            <Text style={styles.minutes}>{roundedMinutes} min</Text>
            {showValue ? (
              <Text style={styles.value}>{valueLabel}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  name: {
    width: 80,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  barArea: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
  },
  bar: {
    height: '100%',
    borderRadius: RADIUS.sm,
    minHeight: 4,
  },
  minutes: {
    width: 52,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  value: {
    width: 64,
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
});
