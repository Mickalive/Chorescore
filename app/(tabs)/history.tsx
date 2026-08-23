import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/AppButton';
import { Avatar } from '@/src/components/Avatar';
import { Card } from '@/src/components/Card';
import { DemoBanner } from '@/src/components/DemoBanner';
import { MetricCard } from '@/src/components/MetricCard';
import { NativeBarChart } from '@/src/components/NativeBarChart';
import { NoticeBanner } from '@/src/components/NoticeBanner';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { COLORS, RADIUS, SPACING } from '@/src/components/theme';
import { getEntitlements, getPlanLabel } from '@/src/domain/entitlements';
import { buildDailyHistory, getVisibleHistory } from '@/src/domain/leaderboard';
import { formatMetric, getEntryValue } from '@/src/domain/scoring';
import { useApp } from '@/src/store/AppProvider';

export default function HistoryScreen() {
  const { state, showPaywall, dismissNotice } = useApp();
  const entitlements = getEntitlements(state.household.plan);
  const dailyPoints = useMemo(
    () =>
      buildDailyHistory(
        state.entries,
        state.currentUserId,
        state.household.id,
        7,
        new Date(),
        entitlements.useWeights,
      ),
    [state.currentUserId, state.entries, state.household.id, entitlements.useWeights],
  );
  const visibleEntries = useMemo(
    () => getVisibleHistory(state.entries, state.household.id, entitlements.historyDays, new Date()),
    [state.entries, state.household.id, entitlements.historyDays],
  );
  const userEntries = visibleEntries.filter((entry) => entry.userId === state.currentUserId);
  const totalValue = userEntries.reduce((sum, entry) => sum + getEntryValue(entry, entitlements.useWeights), 0);
  const totalMinutes = userEntries.reduce((sum, entry) => sum + entry.durationSeconds / 60, 0);
  const taskById = new Map(state.tasks.map((task) => [task.id, task]));
  const userById = new Map(state.users.map((user) => [user.id, user]));

  const exportReport = () => {
    if (!entitlements.canExportPdf) {
      showPaywall('export_pdf');
      return;
    }
    Alert.alert(
      'Rapport simulé',
      'Dans cette démo hors ligne, le rapport est prévisualisé à l’écran mais aucun fichier n’est créé ni envoyé.',
    );
  };

  return (
    <Screen>
      <DemoBanner />
      <ScreenHeader
        eyebrow={`${getPlanLabel(state.household.plan)} · ${entitlements.historyDays === null ? 'historique complet' : '30 jours'}`}
        title="Historique"
        subtitle="Relis les saisies du foyer sans transformer ces données en jugement."
      />
      <NoticeBanner message={state.notice} onDismiss={dismissNotice} />

      <View style={styles.metricRow}>
        <MetricCard label="Ton total visible" value={formatMetric(totalValue, entitlements.useWeights)} />
        <MetricCard label="Temps saisi" value={`${Math.round(totalMinutes)} min`} />
      </View>

      <SectionTitle title="Les 7 derniers jours" detail="Graphique natif, calculé localement" />
      {entitlements.canViewAdvancedHistory ? (
        <Card>
          <NativeBarChart points={dailyPoints} unit={entitlements.useWeights ? 'pts' : 'min'} />
        </Card>
      ) : (
        <Card style={styles.lockedCard}>
          <Text style={styles.lockedTitle}>Graphiques approfondis</Text>
          <Text style={styles.lockedText}>
            Le suivi gratuit conserve la liste des 30 derniers jours. Les graphiques comparatifs font partie des offres complètes.
          </Text>
          <AppButton label="Découvrir les offres" variant="secondary" onPress={() => showPaywall('advanced_history')} />
        </Card>
      )}

      <View style={styles.historyHeader}>
        <SectionTitle title="Saisies récentes" detail={`${visibleEntries.length} entrées visibles`} />
        <AppButton label="Rapport" variant="ghost" onPress={exportReport} style={styles.reportButton} />
      </View>

      <View style={styles.list}>
        {visibleEntries.slice(0, 20).map((entry) => {
          const task = taskById.get(entry.taskId);
          const user = userById.get(entry.userId);
          const completedAt = entry.completedAt === null ? null : new Date(entry.completedAt);
          return (
            <Card key={entry.id}>
              <View style={styles.entryRow}>
                {user === undefined ? null : <Avatar initials={user.initials} color={user.color} size={38} />}
                <View style={styles.entryCopy}>
                  <Text style={styles.entryName}>{task?.name ?? 'Tâche archivée'}</Text>
                  <Text style={styles.entryMeta}>
                    {user?.name ?? 'Membre'} · {entry.isManual ? 'saisie manuelle' : 'chrono'} · {completedAt === null ? '' : new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: 'short' }).format(completedAt)}
                  </Text>
                </View>
                <View style={styles.entryValueWrap}>
                  <Text style={styles.entryValue}>{formatMetric(getEntryValue(entry, entitlements.useWeights), entitlements.useWeights)}</Text>
                  <Text style={styles.entryMinutes}>{Math.round(entry.durationSeconds / 60)} min</Text>
                </View>
              </View>
            </Card>
          );
        })}
      </View>
      <Text style={styles.retentionText}>
        En gratuit, la fenêtre visible est de 30 jours. La démo ne conserve toutefois rien après sa fermeture.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  lockedCard: {
    gap: SPACING.md,
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  lockedTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 17,
  },
  lockedText: {
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  reportButton: {
    minWidth: 92,
    marginBottom: SPACING.sm,
  },
  list: {
    gap: SPACING.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  entryCopy: {
    flex: 1,
  },
  entryName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  entryMeta: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  entryValueWrap: {
    alignItems: 'flex-end',
  },
  entryValue: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  entryMinutes: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  retentionText: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
});
