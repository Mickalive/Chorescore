import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/src/components/Avatar';
import { Card } from '@/src/components/Card';
import { DemoBanner } from '@/src/components/DemoBanner';
import { MetricCard } from '@/src/components/MetricCard';
import { NoticeBanner } from '@/src/components/NoticeBanner';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import { COLORS, RADIUS, SPACING } from '@/src/components/theme';
import { getEntitlements, getPlanLabel } from '@/src/domain/entitlements';
import { buildLeaderboard, getVisibleHistory } from '@/src/domain/leaderboard';
import { isEntryInPeriod } from '@/src/domain/periods';
import { formatMetric } from '@/src/domain/scoring';
import type { TaskEntry } from '@/src/domain/types';
import { useApp } from '@/src/store/AppProvider';

type ScorePeriod = 'week' | 'month' | 'year' | 'all';

const PERIOD_OPTIONS = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
  { value: 'all', label: 'Depuis le début' },
];

function filterByScorePeriod(
  entries: TaskEntry[],
  householdId: string,
  period: ScorePeriod,
  now: Date,
): TaskEntry[] {
  return entries.filter((entry) => {
    if (
      entry.householdId !== householdId ||
      entry.status !== 'completed' ||
      entry.completedAt === null
    ) {
      return false;
    }
    if (period === 'all') return true;
    if (period === 'year') {
      const completedAt = new Date(entry.completedAt);
      return completedAt.getFullYear() === now.getFullYear();
    }
    return isEntryInPeriod(entry, period, now);
  });
}

export default function ScoreScreen() {
  const { state, dismissNotice, showPaywall } = useApp();
  const [period, setPeriod] = useState<ScorePeriod>('week');
  const entitlements = getEntitlements(state.household.plan);
  const now = new Date();

  const filteredEntries = useMemo(
    () => filterByScorePeriod(state.entries, state.household.id, period, now),
    [state.entries, state.household.id, period],
  );

  const rows = useMemo(() => {
    if (period === 'week' || period === 'month') {
      return buildLeaderboard(
        state.entries,
        state.users,
        state.memberships,
        state.household.id,
        period,
        now,
        entitlements.useWeights,
      );
    }
    // For year and all-time, build from filtered entries
    const memberIds = new Set(
      state.memberships
        .filter((m) => m.householdId === state.household.id)
        .map((m) => m.userId),
    );
    const unsorted = state.users
      .filter((user) => memberIds.has(user.id))
      .map((user) => {
        const userEntries = filteredEntries.filter((entry) => entry.userId === user.id);
        return {
          user,
          rank: 0,
          value: userEntries.reduce(
            (sum, entry) =>
              sum + (entitlements.useWeights ? entry.score : entry.durationSeconds / 60),
            0,
          ),
          durationMinutes: userEntries.reduce(
            (sum, entry) => sum + entry.durationSeconds / 60,
            0,
          ),
          taskCount: userEntries.length,
          contribution: 0,
        };
      })
      .sort((a, b) => b.value - a.value || a.user.name.localeCompare(b.user.name, 'fr'));

    const total = unsorted.reduce((sum, row) => sum + row.value, 0);
    let previousValue: number | null = null;
    let currentRank = 0;

    return unsorted.map((row, index) => {
      if (previousValue === null || Math.abs(row.value - previousValue) > Number.EPSILON) {
        currentRank = index + 1;
        previousValue = row.value;
      }
      return {
        ...row,
        rank: currentRank,
        contribution: total === 0 ? 0 : (row.value / total) * 100,
      };
    });
  }, [filteredEntries, state.users, state.memberships, state.household.id, period, now, entitlements.useWeights]);

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
    if (
      value === 'week' ||
      value === 'month' ||
      value === 'year' ||
      value === 'all'
    ) {
      setPeriod(value as ScorePeriod);
    }
  };

  const totalMinutes = rows.reduce((sum, row) => sum + row.durationMinutes, 0);

  return (
    <Screen>
      <DemoBanner />
      <ScreenHeader
        eyebrow={`${state.household.name} · ${getPlanLabel(state.household.plan)}`}
        title="Score"
        subtitle={
          entitlements.useWeights
            ? 'Comparaison fondée sur la durée et les poids convenus par le foyer.'
            : 'Le mode gratuit compare uniquement le temps brut enregistré.'
        }
      />
      <NoticeBanner message={state.notice} onDismiss={dismissNotice} />

      <SegmentedControl
        accessibilityLabel="Période du score"
        options={PERIOD_OPTIONS.map((opt) => ({
          value: opt.value,
          label:
            opt.value === 'month' && !entitlements.canViewMonthlyLeaderboard
              ? 'Mois · Premium'
              : opt.label,
        }))}
        value={period}
        onChange={changePeriod}
        wrap
      />

      <View style={styles.metricRow}>
        <MetricCard
          label="Temps total"
          value={`${Math.round(totalMinutes)} min`}
          detail={`${rows.reduce((sum, row) => sum + row.taskCount, 0)} entrées dans la sélection`}
        />
        <MetricCard
          label={entitlements.useWeights ? 'Points (poids)' : 'Points (temps brut)'}
          value={formatMetric(rows.reduce((sum, row) => sum + row.value, 0), entitlements.useWeights)}
        />
      </View>

      <SectionTitle title="Équilibres" detail="Classement par contribution du foyer" />

      {!hasEntries ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyTitle}>Pas encore de données</Text>
          <Text style={styles.emptyText}>
            Les membres apparaîtront ici dès qu'une tâche sera terminée.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const isCurrentUser = row.user.id === state.currentUserId;
            return (
              <Card key={row.user.id} style={isCurrentUser ? styles.currentCard : undefined}>
                <View style={styles.rowTop}>
                  <Text style={styles.rank}>#{row.rank}</Text>
                  <Avatar initials={row.user.initials} color={row.user.color} />
                  <View style={styles.memberCopy}>
                    <Text style={styles.memberName}>
                      {row.user.name}
                      {isCurrentUser ? ' · toi' : ''}
                    </Text>
                    <Text style={styles.memberMeta}>
                      {row.taskCount} tâches · {Math.round(row.durationMinutes)} min saisies
                    </Text>
                  </View>
                  <Text style={styles.score}>
                    {formatMetric(row.value, entitlements.useWeights)}
                  </Text>
                </View>
                <View style={styles.progressWrap}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${Math.max(row.contribution, 2)}%` },
                    ]}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Text style={styles.disclaimer}>
        Le rang est un résumé des saisies, pas une évaluation des personnes.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  list: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
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
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.surfaceAlt,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.primary,
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
