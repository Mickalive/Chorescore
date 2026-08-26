import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/AppButton';
import { Avatar } from '@/src/components/Avatar';
import { Card } from '@/src/components/Card';
import { DemoBanner } from '@/src/components/DemoBanner';
import { EntryCorrectionModal } from '@/src/components/EntryCorrectionModal';
import { MetricCard } from '@/src/components/MetricCard';
import { NativeBarChart } from '@/src/components/NativeBarChart';
import { NoticeBanner } from '@/src/components/NoticeBanner';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import { COLORS, RADIUS, SPACING } from '@/src/components/theme';
import { getEntitlements, getPlanLabel } from '@/src/domain/entitlements';
import { buildHistoryReport, type HistoryReport } from '@/src/domain/exportReport';
import {
  buildHistorySynthesis,
  describePeriodBounds,
  filterHistoryEntries,
  type HistoryPeriodFilter,
} from '@/src/domain/history';
import { buildDailyHistory, getVisibleHistory } from '@/src/domain/leaderboard';
import { formatMetric, getEntryValue } from '@/src/domain/scoring';
import type { TaskEntry } from '@/src/domain/types';
import { useApp } from '@/src/store/AppProvider';

export default function HistoryScreen() {
  const { state, showPaywall, dismissNotice, editEntryDuration, deleteEntry } = useApp();
  const [periodFilter, setPeriodFilter] = useState<HistoryPeriodFilter>('all');
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  // DRC-04 : après une bascule de foyer, un filtre membre de l'ancien foyer
  // n'a plus de sens (l'onglet reste monté sous expo-router) — retour au
  // segment « Foyer » pour retrouver l'historique complet du nouveau foyer.
  useEffect(() => {
    setMemberFilter(null);
  }, [state.currentHouseholdId]);
  const [correctionEntry, setCorrectionEntry] = useState<TaskEntry | null>(null);
  const [report, setReport] = useState<HistoryReport | null>(null);
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
  const filteredEntries = useMemo(
    () => filterHistoryEntries(visibleEntries, periodFilter, memberFilter, new Date()),
    [visibleEntries, periodFilter, memberFilter],
  );
  const synthesis = useMemo(
    () => buildHistorySynthesis(filteredEntries, state.tasks, entitlements.useWeights),
    [filteredEntries, state.tasks, entitlements.useWeights],
  );
  const periodBounds = useMemo(
    () => describePeriodBounds(periodFilter, new Date()),
    [periodFilter],
  );
  const memberIds = new Set(
    state.memberships
      .filter((membership) => membership.householdId === state.household.id)
      .map((membership) => membership.userId),
  );
  const memberOptions = [
    { value: 'all', label: 'Foyer' },
    ...state.users
      .filter((user) => memberIds.has(user.id))
      .map((user) => ({ value: user.id, label: user.name })),
  ];
  const taskById = new Map(state.tasks.map((task) => [task.id, task]));
  const userById = new Map(state.users.map((user) => [user.id, user]));
  // Liste honnête : le compteur annonce exactement ce qui est affiché, y
  // compris quand la liste dépasse les 20 premières lignes rendues.
  const shownEntries = filteredEntries.slice(0, 20);
  const entriesDetail =
    filteredEntries.length > shownEntries.length
      ? `${shownEntries.length} premières sur ${filteredEntries.length} entrées`
      : `${filteredEntries.length} ${filteredEntries.length > 1 ? 'entrées' : 'entrée'} dans la sélection`;

  const changePeriod = (value: string) => {
    if (value === 'all' || value === 'week' || value === 'month') {
      setPeriodFilter(value);
    }
  };

  const changeMember = (value: string) => {
    setMemberFilter(value === 'all' ? null : value);
  };

  // DRC-03 : suppression réelle et confirmée d'une entrée terminée du membre
  // actif ; classement, historique et sauvegarde locale sont recalculés.
  const confirmDeleteEntry = (entry: TaskEntry, label: string) => {
    Alert.alert(
      'Supprimer cette entrée ?',
      `« ${label} » disparaîtra du classement, de l’historique et de la sauvegarde locale. Cette action est définitive.`,
      [
        { text: 'Conserver', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteEntry(entry.id) },
      ],
    );
  };

  // DRC-04 : l'export produit un rapport réellement consultable — texte
  // intégral construit depuis la sélection courante du foyer actif, affiché à
  // l'écran et partageable via le système. Aucun réseau, aucun compte, aucun
  // succès simulé : en gratuit, la porte reste le paywall contextuel.
  const openReport = () => {
    if (!entitlements.canExportPdf) {
      showPaywall('export_pdf');
      return;
    }
    setReport(
      buildHistoryReport({
        householdName: state.household.name,
        planLabel: getPlanLabel(state.household.plan),
        period: periodFilter,
        memberLabel:
          memberFilter === null ? null : (userById.get(memberFilter)?.name ?? 'Membre'),
        entries: filteredEntries,
        tasks: state.tasks,
        users: state.users,
        useWeights: entitlements.useWeights,
        generatedAt: new Date(),
      }),
    );
  };

  return (
    <Screen>
      <DemoBanner />
      <ScreenHeader
        eyebrow={`${getPlanLabel(state.household.plan)} · ${entitlements.historyDays === null ? 'historique complet' : `${entitlements.historyDays} jours`}`}
        title="Historique"
        subtitle="Relis les saisies du foyer sans transformer ces données en jugement."
      />
      <NoticeBanner message={state.notice} onDismiss={dismissNotice} />

      <SegmentedControl
        accessibilityLabel="Période d’historique affichée"
        options={[
          { value: 'all', label: 'Tout' },
          { value: 'week', label: 'Cette semaine' },
          { value: 'month', label: 'Ce mois' },
        ]}
        value={periodFilter}
        onChange={changePeriod}
      />
      {/* DRC-05 (MOB-C4-F1) : le filtre membre a un nombre et un libellé
          variables ; en mode repli les segments passent à la ligne au lieu de
          se compresser sur petit écran ou en grandes tailles de texte. La
          réinitialisation après bascule de foyer (F3-R2) reste en place
          ci-dessus : aucune sélection orpheline. */}
      <SegmentedControl
        accessibilityLabel="Membre du foyer affiché"
        options={memberOptions}
        value={memberFilter ?? 'all'}
        onChange={changeMember}
        wrap
      />

      <View style={[styles.metricRow, styles.metricRowSpacing]}>
        <MetricCard
          label="Temps saisi"
          value={`${Math.round(synthesis.totalMinutes)} min`}
          detail={`${synthesis.entryCount} ${synthesis.entryCount > 1 ? 'entrées' : 'entrée'} dans la sélection`}
        />
        <MetricCard
          label={entitlements.useWeights ? 'Points (poids du foyer)' : 'Points (temps brut)'}
          value={formatMetric(synthesis.totalValue, entitlements.useWeights)}
        />
      </View>

      {/* DRC-04 : méthode de calcul visible et bornées réelles — le texte est
          produit par la même fonction que le filtrage, il ne peut pas
          diverger des bornes appliquées aux entrées. */}
      <Text style={styles.methodText}>
        Méthode : somme des durées des entrées terminées de la sélection
        {periodBounds === null ? ' de la fenêtre visible' : ` (${periodBounds})`} ; l’arrondi est
        réservé à l’affichage.
      </Text>

      {entitlements.useWeights ? null : (
        <Text style={styles.planNote}>
          En gratuit, l’historique couvre les 30 derniers jours et chaque valeur est comptée en
          temps brut : le poids effectif vaut 1. Les offres complètes ajoutent la pondération
          personnalisée, sans changer cette liste.
        </Text>
      )}

      <SectionTitle title="Répartition par tâche" detail="Synthèse de la sélection courante" />
      {synthesis.byTask.length === 0 ? (
        <Card style={styles.emptyState}>
          <Text style={styles.emptyText}>Rien à résumer pour cette sélection.</Text>
        </Card>
      ) : (
        <Card>
          {synthesis.byTask.map((row, index) => (
            <View
              key={row.taskId}
              style={[styles.breakdownRow, index > 0 && styles.breakdownSeparator]}
            >
              <Text style={styles.breakdownName}>{row.label}</Text>
              <Text style={styles.breakdownMeta}>
                {Math.round(row.minutes)} min · {row.entryCount} fois
              </Text>
            </View>
          ))}
        </Card>
      )}

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
        <SectionTitle title="Saisies récentes" detail={entriesDetail} />
        <AppButton label="Rapport" variant="ghost" onPress={openReport} style={styles.reportButton} />
      </View>

      {visibleEntries.length === 0 ? (
        <Card style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Aucune saisie visible</Text>
          <Text style={styles.emptyText}>
            Les tâches terminées et les temps saisis apparaîtront ici.
          </Text>
        </Card>
      ) : filteredEntries.length === 0 ? (
        <Card style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Aucune saisie pour ce filtre</Text>
          <Text style={styles.emptyText}>
            Élargis la période ou affiche tout le foyer pour revoir davantage d’historique.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {shownEntries.map((entry) => {
            const task = taskById.get(entry.taskId);
            const user = userById.get(entry.userId);
            const completedAt = entry.completedAt === null ? null : new Date(entry.completedAt);
            const entryLabel = task?.name ?? 'Tâche archivée';
            const isOwnEntry = entry.userId === state.currentUserId;
            return (
              <Card key={entry.id}>
                <View style={styles.entryRow}>
                  {user === undefined ? null : <Avatar initials={user.initials} color={user.color} size={38} />}
                  <View style={styles.entryCopy}>
                    <Text style={styles.entryName}>{entryLabel}</Text>
                    <Text style={styles.entryMeta}>
                      {user?.name ?? 'Membre'} · {entry.isManual ? 'saisie manuelle' : 'chrono'} · {completedAt === null ? '' : new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: 'short' }).format(completedAt)}
                    </Text>
                  </View>
                  <View style={styles.entryValueWrap}>
                    <Text style={styles.entryValue}>{formatMetric(getEntryValue(entry, entitlements.useWeights), entitlements.useWeights)}</Text>
                    <Text style={styles.entryMinutes}>{Math.round(entry.durationSeconds / 60)} min</Text>
                  </View>
                </View>
                {isOwnEntry ? (
                  <View style={styles.entryActions}>
                    <AppButton
                      label="Corriger"
                      variant="ghost"
                      accessibilityLabel={`Corriger la durée de l’entrée « ${entryLabel} »`}
                      onPress={() => setCorrectionEntry(entry)}
                      style={styles.entryActionButton}
                    />
                    <AppButton
                      label="Supprimer"
                      variant="danger"
                      accessibilityLabel={`Supprimer l’entrée « ${entryLabel} »`}
                      onPress={() => confirmDeleteEntry(entry, entryLabel)}
                      style={styles.entryActionButton}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
      <Text style={styles.retentionText}>
        En gratuit, la fenêtre visible est de 30 jours. Les entrées plus anciennes restent sur cet appareil mais ne sont plus affichées ici.
      </Text>

      <EntryCorrectionModal
        entry={correctionEntry}
        taskName={
          correctionEntry === null ? '' : (taskById.get(correctionEntry.taskId)?.name ?? 'Tâche archivée')
        }
        useWeights={entitlements.useWeights}
        onClose={() => setCorrectionEntry(null)}
        onSubmit={(minutes) =>
          correctionEntry === null ? false : editEntryDuration(correctionEntry.id, minutes)
        }
      />

      <ReportModal report={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

/**
 * Aperçu du rapport exportable (DRC-04) : le contenu généré est intégralement
 * consultable à l'écran et partageable via la feuille système. Un refus du
 * partage est annoncé honnêtement ; aucun succès n'est jamais simulé.
 */
function ReportModal({ report, onClose }: { report: HistoryReport | null; onClose: () => void }) {
  const [shareFailed, setShareFailed] = useState(false);

  useEffect(() => {
    if (report === null) {
      setShareFailed(false);
    }
  }, [report]);

  const shareReport = async () => {
    if (report === null) {
      return;
    }
    setShareFailed(false);
    try {
      await Share.share({ message: report.text }, { dialogTitle: report.fileName });
    } catch {
      // Échec réel (partage indisponible ou annulé côté système) : annoncé
      // comme tel, le rapport reste consultable ci-dessus.
      setShareFailed(true);
    }
  };

  return (
    <Modal
      visible={report !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.reportOverlay}>
        <View style={styles.reportSheet}>
          <Text accessibilityRole="header" style={styles.reportTitle}>
            Rapport d’historique
          </Text>
          <Text style={styles.reportFile}>Fichier local : {report?.fileName ?? ''}</Text>
          <ScrollView style={styles.reportScroll} contentContainerStyle={styles.reportContent}>
            <Text selectable style={styles.reportText}>
              {report?.text ?? ''}
            </Text>
          </ScrollView>
          {shareFailed ? (
            <View accessibilityLiveRegion="polite">
              <Text style={styles.shareError}>
                Le partage système n’a pas abouti. Le rapport reste entièrement consultable ici.
              </Text>
            </View>
          ) : null}
          <View style={styles.reportActions}>
            <AppButton label="Fermer" variant="ghost" onPress={onClose} style={styles.reportAction} />
            <AppButton
              label="Partager"
              accessibilityHint="Ouvre la feuille de partage de l’appareil pour enregistrer ou envoyer ce rapport."
              onPress={() => {
                void shareReport();
              }}
              style={styles.reportAction}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metricRowSpacing: {
    marginTop: SPACING.md,
  },
  methodText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: SPACING.sm,
  },
  reportOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(38, 70, 83, 0.35)',
  },
  reportSheet: {
    maxHeight: '90%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  reportTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  reportFile: {
    // Hiérarchie volontaire : textSecondary (≈ 4,55:1 sur background,
    // constat F6 de l'audit mobile 32919230502) plutôt que textMuted, dont le
    // jeton central a été assombri à la passe DRC-05 pour atteindre ≥ 4,5:1
    // sur tous ses fonds réels (tests/theme-contrast.test.ts).
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  reportScroll: {
    flexGrow: 0,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  reportContent: {
    padding: SPACING.md,
  },
  reportText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 20,
  },
  shareError: {
    color: '#A9422F',
    backgroundColor: '#FFF4F1',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    fontWeight: '700',
    lineHeight: 19,
  },
  reportActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  reportAction: {
    flex: 1,
  },
  planNote: {
    color: COLORS.textPrimary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  breakdownSeparator: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
  },
  breakdownName: {
    flex: 1,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  breakdownMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
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
  entryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  entryActionButton: {
    minWidth: 104,
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
