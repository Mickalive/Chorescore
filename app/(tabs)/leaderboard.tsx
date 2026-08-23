import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/src/components/Avatar';
import { Card } from '@/src/components/Card';
import { ContributionBar } from '@/src/components/ContributionBar';
import { DemoBanner } from '@/src/components/DemoBanner';
import { NoticeBanner } from '@/src/components/NoticeBanner';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import { COLORS, RADIUS, SPACING } from '@/src/components/theme';
import { getEntitlements, getPlanLabel } from '@/src/domain/entitlements';
import { buildContributionMessage } from '@/src/domain/feedback';
import { buildLeaderboard } from '@/src/domain/leaderboard';
import { formatMetric } from '@/src/domain/scoring';
import type { Period } from '@/src/domain/types';
import { useApp } from '@/src/store/AppProvider';

export default function LeaderboardScreen() {
  const { state, dismissNotice, showPaywall } = useApp();
  const [period, setPeriod] = useState<Period>('week');
  const entitlements = getEntitlements(state.household.plan);
  const rows = useMemo(
    () =>
      buildLeaderboard(
        state.entries,
        state.users,
        state.memberships,
        state.household.id,
        period,
        new Date(),
        entitlements.useWeights,
      ),
    [state.entries, state.household.id, state.memberships, state.users, period, entitlements.useWeights],
  );
  const currentRow = rows.find((row) => row.user.id === state.currentUserId);
  const hasEntries = rows.some((row) => row.taskCount > 0);

  useEffect(() => {
    if (!entitlements.canViewMonthlyLeaderboard && period === 'month') {
      setPeriod('week');
    }
  }, [entitlements.canViewMonthlyLeaderboard, period]);

  const changePeriod = (value: string) => {
    if (value === 'month' && !entitlements.canViewMonthlyLeaderboard) {
      showPaywall('advanced_history');
      return;
    }
    if (value === 'week' || value === 'month') setPeriod(value);
  };

  return (
    <Screen>
      <DemoBanner />
      <ScreenHeader
        eyebrow={`${state.household.name} · ${getPlanLabel(state.household.plan)}`}
        title="Classement"
        subtitle={
          entitlements.useWeights
            ? 'Comparaison fondée sur la durée et les poids convenus par le foyer.'
            : 'Le mode gratuit compare uniquement le temps brut enregistré.'
        }
      />
      <NoticeBanner message={state.notice} onDismiss={dismissNotice} />
      <SegmentedControl
        accessibilityLabel="Période du classement"
        options={[
          { value: 'week', label: 'Cette semaine' },
          { value: 'month', label: entitlements.canViewMonthlyLeaderboard ? 'Ce mois' : 'Mois · Premium' },
        ]}
        value={period}
        onChange={changePeriod}
      />

      <Card style={styles.feedbackCard}>
        <Text style={styles.feedbackKicker}>POINT DE REPÈRE PERSONNEL</Text>
        <Text style={styles.feedbackText}>
          {buildContributionMessage(currentRow?.contribution ?? 0, (currentRow?.taskCount ?? 0) > 0)}
        </Text>
        <Text style={styles.feedbackFootnote}>Les tâches non saisies et la charge mentale ne sont pas mesurées.</Text>
      </Card>

      <View style={styles.list}>
        {rows.map((row) => {
          const isCurrentUser = row.user.id === state.currentUserId;
          return (
            <Card key={row.user.id} style={isCurrentUser ? styles.currentCard : undefined}>
              <View style={styles.rowTop}>
                <Text style={styles.rank}>#{row.rank}</Text>
                <Avatar initials={row.user.initials} color={row.user.color} />
                <View style={styles.memberCopy}>
                  <Text style={styles.memberName}>{row.user.name}{isCurrentUser ? ' · toi' : ''}</Text>
                  <Text style={styles.memberMeta}>{row.taskCount} tâches · {Math.round(row.durationMinutes)} min saisies</Text>
                </View>
                <Text style={styles.score}>{formatMetric(row.value, entitlements.useWeights)}</Text>
              </View>
              <View style={styles.progressWrap}>
                <ContributionBar value={row.contribution} color={row.user.color} />
              </View>
            </Card>
          );
        })}
      </View>

      {!hasEntries ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Pas encore de classement</Text>
          <Text style={styles.emptyText}>Les membres apparaîtront ici dès qu’une tâche sera terminée.</Text>
        </View>
      ) : null}
      <Text style={styles.disclaimer}>
        Le rang est un résumé des saisies, pas une évaluation des personnes. Discutez des écarts avant d’en tirer une conclusion.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  feedbackCard: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  feedbackKicker: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  feedbackText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  feedbackFootnote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: SPACING.sm,
  },
  list: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  currentCard: {
    borderColor: COLORS.success,
    backgroundColor: '#F7FCFB',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rank: {
    width: 28,
    color: COLORS.textSecondary,
    fontWeight: '800',
  },
  memberCopy: {
    flex: 1,
  },
  memberName: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  memberMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  score: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  progressWrap: {
    marginLeft: 80,
    marginTop: SPACING.sm,
  },
  empty: {
    padding: SPACING.lg,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: SPACING.md,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  disclaimer: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});
