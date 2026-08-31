import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { DemoBanner } from '@/src/components/DemoBanner';
import { NoticeBanner } from '@/src/components/NoticeBanner';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { COLORS, RADIUS, SPACING } from '@/src/components/theme';
import { getPlanLabel } from '@/src/domain/entitlements';
import { useApp } from '@/src/store/AppProvider';

export default function TodoScreen() {
  const { state, dismissNotice } = useApp();

  return (
    <Screen>
      <DemoBanner />
      <ScreenHeader
        eyebrow={`${state.household.name} · ${getPlanLabel(state.household.plan)}`}
        title="To-do"
        subtitle="Planifie les tâches à venir du foyer."
      />
      <NoticeBanner message={state.notice} onDismiss={dismissNotice} />

      <SectionTitle title="Tâches à venir" detail="Planification du foyer" />

      <Card style={styles.empty}>
        <Text style={styles.emptyTitle}>Aucune tâche planifiée</Text>
        <Text style={styles.emptyText}>
          Les tâches futures du foyer apparaîtront ici. Créez une tâche pour commencer à planifier.
        </Text>
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>Fonctionnalité à venir</Text>
        <Text style={styles.infoText}>
          La création, l'attribution et le suivi des tâches à venir seront disponibles dans une prochaine mise à jour.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: SPACING.lg,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 20,
  },
  infoCard: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  infoTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.xs,
  },
});
