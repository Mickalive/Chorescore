import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { DemoBanner } from '@/src/components/DemoBanner';
import { ManualEntryModal } from '@/src/components/ManualEntryModal';
import { MetricCard } from '@/src/components/MetricCard';
import { NoticeBanner } from '@/src/components/NoticeBanner';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { TaskFormModal } from '@/src/components/TaskFormModal';
import { TaskRow } from '@/src/components/TaskRow';
import { COLORS, RADIUS, SPACING } from '@/src/components/theme';
import { getEntitlements, getPlanLabel } from '@/src/domain/entitlements';
import { buildLeaderboard } from '@/src/domain/leaderboard';
import { formatMetric } from '@/src/domain/scoring';
import type { TaskDefinition, TaskEntry } from '@/src/domain/types';
import { selectVisibleTasks } from '@/src/store/appReducer';
import { useApp } from '@/src/store/AppProvider';

export default function TasksScreen() {
  const {
    state,
    addTask,
    updateTask,
    archiveTask,
    startTimer,
    completeTimer,
    cancelTimer,
    addManualEntry,
    showPaywall,
    dismissNotice,
  } = useApp();
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [editTask, setEditTask] = useState<TaskDefinition | null>(null);
  const [manualTask, setManualTask] = useState<TaskDefinition | null>(null);
  const entitlements = getEntitlements(state.household.plan);
  const currentUser = state.users.find((user) => user.id === state.currentUserId);
  const weeklyRows = useMemo(
    () =>
      buildLeaderboard(
        state.entries,
        state.users,
        state.memberships,
        state.household.id,
        'week',
        new Date(),
        entitlements.useWeights,
      ),
    [state.entries, state.household.id, state.memberships, state.users, entitlements.useWeights],
  );
  const currentRow = weeklyRows.find((row) => row.user.id === state.currentUserId);
  const completedThisWeek = currentRow?.taskCount ?? 0;
  const currentMetric = currentRow?.value ?? 0;
  // DRC-04 : seules les tâches du foyer actif sont proposées — les foyers
  // locaux sont isolés dans la liste comme dans le document persisté.
  const activeTasks = selectVisibleTasks(state);
  const archivedCount = state.tasks.filter(
    (task) => task.householdId === state.household.id && !task.active,
  ).length;

  // DRC-03 : l'archivage est réel mais jamais silencieux — confirmation
  // explicite avant de retirer la tâche des propositions.
  const confirmArchive = (task: TaskDefinition) => {
    Alert.alert(
      'Archiver cette tâche ?',
      `« ${task.name} » ne sera plus proposée aux nouveaux chronos. Les temps déjà enregistrés restent visibles dans l’historique.`,
      [
        { text: 'Conserver', style: 'cancel' },
        { text: 'Archiver', style: 'destructive', onPress: () => archiveTask(task.id) },
      ],
    );
  };

  // DRC-03 : annulation déterministe d'un chrono actif, confirmée — le temps
  // écoulé est ignoré et aucune entrée n'est créée.
  const confirmCancelTimer = (activeEntry: TaskEntry) => {
    Alert.alert('Annuler ce chrono ?', 'Le temps écoulé sera ignoré : aucune entrée ne sera créée.', [
      { text: 'Continuer le chrono', style: 'cancel' },
      { text: 'Annuler le chrono', style: 'destructive', onPress: () => cancelTimer(activeEntry.id) },
    ]);
  };

  return (
    <Screen>
      <DemoBanner />
      <ScreenHeader
        eyebrow={`${state.household.name} · ${getPlanLabel(state.household.plan)}`}
        title={`Bonjour ${currentUser?.name ?? ''}`}
        subtitle="Enregistre ce qui a été fait. Le score ne couvre que les tâches saisies."
      />
      <NoticeBanner message={state.notice} onDismiss={dismissNotice} />

      <View style={styles.metricRow}>
        <MetricCard
          label="Cette semaine"
          value={formatMetric(currentMetric, entitlements.useWeights)}
          detail={entitlements.useWeights ? 'durée × poids convenu' : 'comparaison en temps brut'}
        />
        <MetricCard label="Tâches saisies" value={String(completedThisWeek)} detail="pour ton profil" />
      </View>

      <View style={styles.balanceNote}>
        <Text style={styles.balanceTitle}>Un indicateur, pas un verdict</Text>
        <Text style={styles.balanceText}>
          Discutez ensemble des tâches absentes et des pondérations. ChoreScore ne voit que ce que le foyer choisit de noter.
        </Text>
      </View>

      <View style={styles.sectionRow}>
        <SectionTitle title="Tâches du foyer" detail={`${activeTasks.length} tâches actives`} />
        <AppButton label="Ajouter" onPress={() => setTaskFormVisible(true)} style={styles.addButton} />
      </View>

      {activeTasks.length === 0 ? (
        <Card style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Aucune tâche active</Text>
          <Text style={styles.emptyText}>
            Ajoutez une première tâche pour commencer à enregistrer le temps du foyer.
          </Text>
        </Card>
      ) : (
        <View style={styles.taskList}>
          {activeTasks.map((task) => {
            const activeEntry =
              state.entries.find(
                (entry) =>
                  entry.taskId === task.id &&
                  entry.userId === state.currentUserId &&
                  entry.status === 'in_progress',
              ) ?? null;
            return (
              <TaskRow
                key={task.id}
                task={task}
                activeEntry={activeEntry}
                useWeights={entitlements.useWeights}
                onStart={() => startTimer(task.id)}
                onStop={() => {
                  if (activeEntry !== null) completeTimer(activeEntry.id);
                }}
                onManual={() => setManualTask(task)}
                onEdit={() => setEditTask(task)}
                onArchive={() => confirmArchive(task)}
                onCancelTimer={(entryId) => {
                  if (activeEntry !== null && activeEntry.id === entryId) confirmCancelTimer(activeEntry);
                }}
              />
            );
          })}
        </View>
      )}

      {archivedCount > 0 ? (
        <Text style={styles.archivedNote}>
          {archivedCount} {archivedCount > 1 ? 'tâches archivées' : 'tâche archivée'} : plus proposée
          {archivedCount > 1 ? 's' : ''} aux nouveaux chronos, conservée
          {archivedCount > 1 ? 's' : ''} dans l’historique.
        </Text>
      ) : null}

      <TaskFormModal
        visible={taskFormVisible}
        canCustomizeWeight={entitlements.canCustomizeWeights}
        onClose={() => setTaskFormVisible(false)}
        onSubmit={addTask}
        onLockedWeight={() => showPaywall('custom_weights')}
      />
      <TaskFormModal
        visible={editTask !== null}
        canCustomizeWeight={entitlements.canCustomizeWeights}
        initialTask={editTask}
        onClose={() => setEditTask(null)}
        onSubmit={(input) => (editTask === null ? false : updateTask(editTask.id, input))}
        onLockedWeight={() => showPaywall('custom_weights')}
      />
      <ManualEntryModal
        task={manualTask}
        onClose={() => setManualTask(null)}
        onSubmit={(minutes) => (manualTask === null ? false : addManualEntry(manualTask.id, minutes))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  balanceNote: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  balanceTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  balanceText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.xs,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  addButton: {
    minWidth: 92,
    marginBottom: SPACING.sm,
  },
  taskList: {
    gap: SPACING.sm,
  },
  archivedNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  emptyState: {
    gap: SPACING.xs,
    backgroundColor: COLORS.surfaceAlt,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  emptyText: {
    // Contraste AA requis : textSecondary sur surfaceAlt ≈ 4,36:1 (< 4,5:1),
    // textPrimary atteint ≈ 9,56:1 (constat F1 de l'audit mobile 32688156479).
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
});
