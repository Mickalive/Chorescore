import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { AppButton } from '@/src/components/AppButton';
import { Avatar } from '@/src/components/Avatar';
import { Card } from '@/src/components/Card';
import { DemoBanner } from '@/src/components/DemoBanner';
import { NoticeBanner } from '@/src/components/NoticeBanner';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import { COLORS, RADIUS, SPACING } from '@/src/components/theme';
import { getDaysRemaining } from '@/src/domain/periods';
import { getEntitlements, getPlanLabel } from '@/src/domain/entitlements';
import type { PlanScenario } from '@/src/domain/types';
import { useApp } from '@/src/store/AppProvider';

const PLANS: PlanScenario[] = ['trial', 'free', 'standard', 'pro'];

export default function ProfileScreen() {
  const {
    state,
    setAnalyticsOptIn,
    setPlanScenario,
    setCurrentUser,
    showPaywall,
    dismissNotice,
    resetDemo,
  } = useApp();
  const entitlements = getEntitlements(state.household.plan);
  const daysRemaining = getDaysRemaining(state.household.trialEndsAt, new Date());

  const changePlan = (value: string) => {
    if (PLANS.includes(value as PlanScenario)) setPlanScenario(value as PlanScenario);
  };

  const previewAnotherHousehold = () => {
    if (!entitlements.canUseMultipleHouseholds) {
      showPaywall('multiple_households');
      return;
    }
    Alert.alert(
      'Aperçu multi-foyers',
      'La fonction est incluse dans ce scénario. Elle reste simulée ici pour éviter tout compte ou synchronisation réseau.',
    );
  };

  return (
    <Screen>
      <DemoBanner />
      <ScreenHeader
        eyebrow={state.household.name}
        title="Profil et foyer"
        subtitle="Teste les scénarios sans compte réel, sans paiement et sans persistance."
      />
      <NoticeBanner message={state.notice} onDismiss={dismissNotice} />

      <SectionTitle title="Profil actif" detail="Change de membre pour explorer la démo" />
      <View style={styles.memberSelector}>
        {state.users.map((user) => {
          const selected = user.id === state.currentUserId;
          return (
            <Card key={user.id} style={[styles.memberCard, selected && styles.selectedMember]}>
              <Avatar initials={user.initials} color={user.color} />
              <Text style={styles.memberName}>{user.name}</Text>
              <AppButton
                label={selected ? 'Profil actif' : 'Choisir'}
                variant={selected ? 'secondary' : 'ghost'}
                disabled={selected}
                onPress={() => setCurrentUser(user.id)}
                style={styles.memberButton}
              />
            </Card>
          );
        })}
      </View>

      <SectionTitle title="Scénario du foyer" detail="Le plan s’applique à tous les membres" />
      <SegmentedControl
        accessibilityLabel="Plan de démonstration"
        options={[
          { value: 'trial', label: 'Essai' },
          { value: 'free', label: 'Free' },
          { value: 'standard', label: 'Standard' },
          { value: 'pro', label: 'Pro' },
        ]}
        value={state.household.plan}
        onChange={changePlan}
      />
      <Card style={styles.planSummary}>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.planName}>{getPlanLabel(state.household.plan)}</Text>
            <Text style={styles.planMeta}>
              {state.household.plan === 'trial'
                ? `${daysRemaining} jours fictifs restants`
                : state.household.plan === 'standard'
                  ? '2,99 € / mois · jusqu’à 7 membres'
                  : state.household.plan === 'pro'
                    ? '5,99 € / mois · à partir de 8 membres'
                    : 'Temps brut · historique visible 30 jours'}
            </Text>
          </View>
          <View style={styles.planPill}><Text style={styles.planPillText}>{entitlements.useWeights ? 'Complet' : 'Essentiel'}</Text></View>
        </View>
        <Text style={styles.planBody}>
          {entitlements.useWeights
            ? 'Pondération, graphiques, rapport et multi-foyers sont ouverts dans ce scénario.'
            : 'Chrono, saisie manuelle et classement en temps brut restent disponibles.'}
        </Text>
      </Card>

      <SectionTitle title="Confidentialité" detail="Consentements séparés et révocables" />
      <Card>
        <View style={styles.privacyRow}>
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Analytics optionnels</Text>
            <Text style={styles.privacyText}>
              {state.consent.analyticsOptIn
                ? `${state.analyticsEventCount} événements fictifs en mémoire. Aucun envoi réseau.`
                : 'Désactivés. Aucun événement comportemental n’est enregistré.'}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Analytics optionnels"
            value={state.consent.analyticsOptIn}
            onValueChange={setAnalyticsOptIn}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={state.consent.analyticsOptIn ? COLORS.success : COLORS.surface}
          />
        </View>
        <View style={styles.divider} />
        <Text style={styles.privacyTitle}>Conditions de démonstration</Text>
        <Text style={styles.privacyText}>
          Version {state.consent.termsVersion}, acceptée uniquement pour cette session. Aucune IP collectée.
        </Text>
      </Card>

      <SectionTitle title="Fonctions du foyer" />
      <View style={styles.actionList}>
        <AppButton
          label="Ajouter un autre foyer"
          variant="secondary"
          onPress={previewAnotherHousehold}
        />
        <AppButton label="Réinitialiser les données fictives" variant="danger" onPress={resetDemo} />
      </View>

      <Card style={styles.securityCard}>
        <Text style={styles.securityTitle}>Architecture sûre par défaut</Text>
        <Text style={styles.securityText}>
          Le service de démonstration fonctionne en mémoire. Le service de production est séparé et volontairement désactivé : aucune clé, requête Firebase, connexion Stripe ou écriture locale.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  memberSelector: {
    gap: SPACING.sm,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  selectedMember: {
    borderColor: COLORS.success,
    backgroundColor: '#F7FCFB',
  },
  memberName: {
    flex: 1,
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  memberButton: {
    minWidth: 106,
  },
  planSummary: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  planName: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  planMeta: {
    color: COLORS.textSecondary,
    marginTop: 3,
    fontSize: 12,
  },
  planPill: {
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  planPillText: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 11,
  },
  planBody: {
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginTop: SPACING.md,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  privacyCopy: {
    flex: 1,
  },
  privacyTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  privacyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.xs,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  actionList: {
    gap: SPACING.sm,
  },
  securityCard: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.surfaceAlt,
  },
  securityTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  securityText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: SPACING.xs,
  },
});
