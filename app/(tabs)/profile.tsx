import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import type { ErrorAnnouncement } from '@/src/domain/formFeedback';
import { computeErrorAnnouncement } from '@/src/domain/formFeedback';
import { getDaysRemaining } from '@/src/domain/periods';
import { getEntitlements, getPlanLabel } from '@/src/domain/entitlements';
import { normalizeTaskName } from '@/src/domain/validation';
import type { PlanScenario } from '@/src/domain/types';
import { MAX_LOCAL_HOUSEHOLDS } from '@/src/store/appReducer';
import { useApp } from '@/src/store/AppProvider';

const PLANS: PlanScenario[] = ['trial', 'free', 'standard', 'pro'];

export default function ProfileScreen() {
  const {
    state,
    setAnalyticsOptIn,
    setPlanScenario,
    setCurrentUser,
    createHousehold,
    switchHousehold,
    showPaywall,
    dismissNotice,
    resetDemo,
  } = useApp();
  const [creationVisible, setCreationVisible] = useState(false);
  const entitlements = getEntitlements(state.household.plan);
  const daysRemaining = getDaysRemaining(state.household.trialEndsAt, new Date());
  const atHouseholdCap = state.households.length >= MAX_LOCAL_HOUSEHOLDS;

  const changePlan = (value: string) => {
    if (PLANS.includes(value as PlanScenario)) setPlanScenario(value as PlanScenario);
  };

  // DRC-04 : la création de foyer est réelle. En scénario gratuit, la porte
  // reste le paywall contextuel — jamais un succès simulé.
  const openHouseholdCreation = () => {
    if (!entitlements.canUseMultipleHouseholds) {
      showPaywall('multiple_households');
      return;
    }
    setCreationVisible(true);
  };

  return (
    <Screen>
      <DemoBanner />
      <ScreenHeader
        eyebrow={state.household.name}
        title="Profil et foyer"
        subtitle="Teste les scénarios sans compte réel ni paiement ; les données restent sur cet appareil."
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
                accessibilityLabel={
                  selected ? `${user.name} est le profil actif` : `Choisir le profil de ${user.name}`
                }
                variant={selected ? 'secondary' : 'ghost'}
                disabled={selected}
                onPress={() => setCurrentUser(user.id)}
                style={styles.memberButton}
              />
            </Card>
          );
        })}
      </View>

      {/* DRC-04 : foyers locaux réels — chaque foyer garde ses tâches, son
          classement et son historique, isolés dans le document persisté. */}
      <SectionTitle
        title="Foyers locaux"
        detail={`${state.households.length} sur ${MAX_LOCAL_HOUSEHOLDS} possibles · données séparées par foyer`}
      />
      <View style={styles.memberSelector}>
        {state.households.map((household) => {
          const active = household.id === state.currentHouseholdId;
          const memberCount = state.memberships.filter(
            (membership) => membership.householdId === household.id,
          ).length;
          return (
            <Card key={household.id} style={[styles.memberCard, active && styles.selectedMember]}>
              <View style={styles.householdCopy}>
                <Text style={styles.memberName}>{household.name}</Text>
                <Text style={styles.householdMeta}>
                  {getPlanLabel(household.plan)} · {memberCount} membre{memberCount > 1 ? 's' : ''}
                </Text>
              </View>
              <AppButton
                label={active ? 'Foyer actif' : 'Basculer'}
                accessibilityLabel={
                  active
                    ? `${household.name} est le foyer actif`
                    : `Basculer vers le foyer ${household.name}`
                }
                variant={active ? 'secondary' : 'ghost'}
                disabled={active}
                onPress={() => switchHousehold(household.id)}
                style={styles.memberButton}
              />
            </Card>
          );
        })}
      </View>
      {atHouseholdCap ? (
        <Text style={styles.capNote}>
          La démo conserve au plus {MAX_LOCAL_HOUSEHOLDS} foyers sur cet appareil. Supprime des
          données via la réinitialisation pour repartir de zéro.
        </Text>
      ) : null}

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
          Version {state.consent.termsVersion}, conservée localement sur cet appareil. Aucune IP collectée.
        </Text>
      </Card>

      <SectionTitle title="Fonctions du foyer" />
      <View style={styles.actionList}>
        <AppButton
          label="Ajouter un autre foyer"
          variant="secondary"
          onPress={openHouseholdCreation}
        />
        <AppButton label="Réinitialiser les données fictives" variant="danger" onPress={resetDemo} />
      </View>

      <HouseholdCreationModal
        visible={creationVisible}
        onClose={() => setCreationVisible(false)}
        onSubmit={(name) => createHousehold(name)}
      />

      <Card style={styles.securityCard}>
        <Text style={styles.securityTitle}>Architecture sûre par défaut</Text>
        <Text style={styles.securityText}>
          Le service de démonstration conserve tes données fictives uniquement sur cet appareil (stockage local de l’application). Le service de production est séparé et volontairement désactivé : aucune clé, requête Firebase, connexion Stripe ou envoi réseau.
        </Text>
      </Card>
    </Screen>
  );
}

/**
 * Création d'un foyer local (DRC-04) : le nom est validé localement avec les
 * mêmes règles que le planner ; les erreurs sont annoncées aux lecteurs
 * d'écran avec le même motif que les autres modales de l'application.
 */
function HouseholdCreationModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => boolean;
}) {
  const [name, setName] = useState('');
  const [errorAnnouncement, setErrorAnnouncement] = useState<ErrorAnnouncement | null>(null);
  const nameInputRef = useRef<TextInput>(null);
  const isOpenRef = useRef(false);
  isOpenRef.current = visible;

  useEffect(() => {
    if (!visible) {
      setName('');
      setErrorAnnouncement(null);
    }
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || errorAnnouncement === null) {
      return;
    }
    AccessibilityInfo.announceForAccessibility(errorAnnouncement.message);
  }, [errorAnnouncement]);

  const validateName = (value: string): string | null => {
    const normalized = normalizeTaskName(value);
    if (normalized.length < 2) {
      return 'Le nom du foyer doit contenir au moins 2 caractères.';
    }
    if (normalized.length > 40) {
      return 'Le nom du foyer ne peut pas dépasser 40 caractères.';
    }
    return null;
  };

  const submit = () => {
    const error = validateName(name);
    if (error !== null) {
      setErrorAnnouncement(computeErrorAnnouncement(errorAnnouncement, error));
      return;
    }
    setErrorAnnouncement(null);
    if (onSubmit(name)) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
      onShow={() => {
        if (isOpenRef.current) {
          nameInputRef.current?.focus();
        }
      }}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>
            Nouveau foyer local
          </Text>
          <Text style={styles.dialogHelp}>
            Il démarre vide : ses tâches, son classement et son historique seront séparés des autres
            foyers, uniquement sur cet appareil.
          </Text>
          <Text style={styles.fieldLabel}>Nom du foyer</Text>
          <TextInput
            ref={nameInputRef}
            accessibilityLabel="Nom du foyer"
            value={name}
            onChangeText={setName}
            placeholder="Ex. Coloc du parc"
            placeholderTextColor={COLORS.textDisabled}
            maxLength={60}
            style={styles.dialogInput}
          />
          {errorAnnouncement === null ? null : (
            <View key={errorAnnouncement.token} accessibilityLiveRegion="assertive">
              <Text style={styles.dialogError}>{errorAnnouncement.message}</Text>
            </View>
          )}
          <View style={styles.dialogActions}>
            <AppButton label="Annuler" variant="ghost" onPress={onClose} style={styles.dialogAction} />
            <AppButton label="Créer le foyer" onPress={submit} style={styles.dialogAction} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  householdCopy: {
    flex: 1,
  },
  householdMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  capNote: {
    color: COLORS.textPrimary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
    backgroundColor: 'rgba(38, 70, 83, 0.35)',
  },
  dialog: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  dialogTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  dialogHelp: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.xs,
  },
  fieldLabel: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  dialogInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    fontSize: 18,
  },
  dialogError: {
    color: '#A9422F',
    backgroundColor: '#FFF4F1',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    fontWeight: '700',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  dialogAction: {
    flex: 1,
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
