import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TaskDefinition, TaskEntry } from '../domain/types';
import { AppButton } from './AppButton';
import { Card } from './Card';
import { COLORS, RADIUS, SPACING } from './theme';

const CATEGORY_LABELS: Record<TaskDefinition['category'], string> = {
  dishes: 'Vaisselle',
  cooking: 'Cuisine',
  cleaning: 'Nettoyage',
  laundry: 'Linge',
  shopping: 'Courses',
  other: 'Autre',
};

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function TaskRow({
  task,
  activeEntry,
  useWeights,
  onStart,
  onStop,
  onManual,
}: {
  task: TaskDefinition;
  activeEntry: TaskEntry | null;
  useWeights: boolean;
  onStart: () => void;
  onStop: () => void;
  onManual: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (activeEntry?.startedAt === null || activeEntry === null) {
      setElapsed(0);
      return undefined;
    }
    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(activeEntry.startedAt ?? '').getTime()) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  return (
    <Card style={activeEntry === null ? undefined : styles.activeCard}>
      <View style={styles.topRow}>
        <View style={styles.copy}>
          <Text style={styles.name}>{task.name}</Text>
          <Text style={styles.meta}>
            {CATEGORY_LABELS[task.category]} · {useWeights ? `poids ${task.weight}` : 'temps brut'}
          </Text>
        </View>
        <View style={[styles.weightBadge, !useWeights && styles.rawBadge]}>
          <Text style={styles.weightText}>{useWeights ? `×${task.weight}` : '1 min'}</Text>
        </View>
      </View>

      {activeEntry === null ? (
        <View style={styles.actions}>
          <AppButton
            label="Démarrer"
            accessibilityLabel={`Démarrer le chrono de ${task.name}`}
            onPress={onStart}
            style={styles.actionButton}
          />
          <AppButton
            label="Saisir un temps"
            accessibilityLabel={`Saisir un temps pour ${task.name}`}
            variant="secondary"
            onPress={onManual}
            style={styles.actionButton}
          />
        </View>
      ) : (
        <View style={styles.timerRow} accessibilityLiveRegion="polite">
          <View>
            <Text style={styles.timerLabel}>Chrono en cours</Text>
            <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
          </View>
          <AppButton
            label="Terminer"
            accessibilityLabel={`Terminer le chrono de ${task.name}`}
            onPress={onStop}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    borderColor: COLORS.success,
    backgroundColor: '#F6FCFA',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  copy: {
    flex: 1,
  },
  name: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 17,
  },
  meta: {
    color: COLORS.textSecondary,
    marginTop: 3,
    fontSize: 13,
  },
  weightBadge: {
    minWidth: 46,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  rawBadge: {
    backgroundColor: COLORS.primary,
  },
  weightText: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionButton: {
    flex: 1,
    minWidth: 132,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  timerLabel: {
    color: COLORS.success,
    fontWeight: '700',
    fontSize: 12,
  },
  timer: {
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
});
