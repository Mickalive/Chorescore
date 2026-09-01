import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getPlanLabel } from '../domain/entitlements';
import type { PremiumFeature } from '../domain/types';
import { useApp } from '../store/AppProvider';
import { AppButton } from './AppButton';
import { COLORS, RADIUS, SPACING } from './theme';

const FEATURE_COPY: Record<PremiumFeature, { title: string; body: string }> = {
  custom_weights: {
    title: 'Pondération du foyer',
    body: 'L’essai et les offres payantes permettent au foyer de convenir du poids de chaque tâche.',
  },
  advanced_history: {
    title: 'Historique approfondi',
    body: 'Compare les périodes et consulte les graphiques au-delà du suivi gratuit.',
  },
  export_pdf: {
    title: 'Rapport PDF',
    body: 'Prépare un rapport visuel limité aux données du foyer courant.',
  },
  multiple_households: {
    title: 'Plusieurs foyers',
    body: 'Garde un profil cohérent dans plusieurs groupes sans mélanger leurs données.',
  },
};

export function PaywallModal() {
  const { state, hidePaywall, setPlanScenario } = useApp();
  const feature = state.paywallFeature;
  const copy = feature === null ? null : FEATURE_COPY[feature];

  const activate = (plan: 'standard' | 'pro') => {
    setPlanScenario(plan);
    hidePaywall();
  };

  return (
    <Modal
      visible={feature !== null}
      transparent
      animationType="slide"
      onRequestClose={hidePaywall}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.kicker}>APERÇU PREMIUM</Text>
            <Text accessibilityRole="header" style={styles.title}>{copy?.title ?? 'Fonction premium'}</Text>
            <Text style={styles.body}>{copy?.body}</Text>

            <View style={styles.planRow}>
              <View style={styles.planCard}>
                <Text style={styles.planName}>Standard</Text>
                <Text style={styles.price}>2,99 €</Text>
                <Text style={styles.perMonth}>par mois et par foyer</Text>
                <Text style={styles.planDetail}>Jusqu’à 7 membres</Text>
                <AppButton label="Simuler Standard" onPress={() => activate('standard')} />
              </View>
              <View style={[styles.planCard, styles.proCard]}>
                <Text style={styles.planName}>Pro</Text>
                <Text style={styles.price}>5,99 €</Text>
                <Text style={styles.perMonth}>par mois et par foyer</Text>
                <Text style={styles.planDetail}>À partir de 8 membres</Text>
                <AppButton label="Simuler Pro" onPress={() => activate('pro')} />
              </View>
            </View>

            <Text style={styles.disclaimer}>
              Aucun paiement n’est effectué. Le changement ne concerne que le scénario fictif de ce foyer.
            </Text>
            <AppButton label="Continuer sans changer" variant="ghost" onPress={hidePaywall} />
            <Text style={styles.current}>Plan actuel : {getPlanLabel(state.household.plan)}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(38, 70, 83, 0.35)',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  handle: {
    width: 48,
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.pill,
    alignSelf: 'center',
    marginTop: SPACING.sm,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  kicker: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginTop: SPACING.xs,
  },
  body: {
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginTop: SPACING.sm,
  },
  planRow: {
    gap: SPACING.sm,
    marginVertical: SPACING.lg,
  },
  planCard: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  proCard: {
    borderColor: COLORS.accent,
    backgroundColor: '#FFFBF0',
  },
  planName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  price: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  perMonth: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  planDetail: {
    color: COLORS.textSecondary,
    marginVertical: SPACING.sm,
  },
  disclaimer: {
    color: COLORS.textSecondary,
    backgroundColor: COLORS.secondary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  current: {
    color: COLORS.textMuted,
    textAlign: 'center',
    fontSize: 12,
    marginTop: SPACING.sm,
  },
});
