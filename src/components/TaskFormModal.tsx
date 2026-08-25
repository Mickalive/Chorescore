import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ErrorAnnouncement } from '../domain/formFeedback';
import { computeErrorAnnouncement } from '../domain/formFeedback';
import type { TaskCategory, TaskDefinition } from '../domain/types';
import { validateTaskInput } from '../domain/validation';
import { AppButton } from './AppButton';
import { COLORS, RADIUS, SPACING } from './theme';

const CATEGORY_OPTIONS: Array<{ value: TaskCategory; label: string }> = [
  { value: 'dishes', label: 'Vaisselle' },
  { value: 'cooking', label: 'Cuisine' },
  { value: 'cleaning', label: 'Nettoyage' },
  { value: 'laundry', label: 'Linge' },
  { value: 'shopping', label: 'Courses' },
  { value: 'other', label: 'Autre' },
];

export function TaskFormModal({
  visible,
  canCustomizeWeight,
  initialTask = null,
  onClose,
  onSubmit,
  onLockedWeight,
}: {
  visible: boolean;
  canCustomizeWeight: boolean;
  /** Tâche à modifier (DRC-03) : préremplit le formulaire ; absent = création. */
  initialTask?: TaskDefinition | null;
  onClose: () => void;
  onSubmit: (input: { name: string; category: TaskCategory; weight: number }) => boolean;
  onLockedWeight: () => void;
}) {
  const isEditing = initialTask !== null;
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TaskCategory>('other');
  const [weight, setWeight] = useState('2');
  const [errorAnnouncement, setErrorAnnouncement] = useState<ErrorAnnouncement | null>(null);
  const nameInputRef = useRef<TextInput>(null);
  // Miroir de visibilité consulté par `onShow` : si la modale est fermée
  // pendant son animation d'ouverture, un `onShow` tardif ne doit pas focus
  // un TextInput monté mais invisible (le clavier surgirait au-dessus de
  // l'écran sous-jacent). Le ref évite toute closure périmée.
  const isOpenRef = useRef(false);
  isOpenRef.current = visible;

  useEffect(() => {
    if (!visible) {
      setName('');
      setCategory('other');
      setWeight('2');
      setErrorAnnouncement(null);
      return;
    }
    if (initialTask !== null) {
      // Mode édition : les valeurs courantes de la tâche préremplissent le
      // formulaire ; elles restent modifiables avant confirmation.
      setName(initialTask.name);
      setCategory(initialTask.category);
      setWeight(String(initialTask.weight));
      setErrorAnnouncement(null);
    }
  }, [visible, initialTask]);

  // Annonce impérative pour VoiceOver : `accessibilityLiveRegion` est ignoré
  // sur iOS. L'identité de `errorAnnouncement` change à chaque nouvelle erreur
  // (même identique), donc l'effet se rejoue exactement une fois par annonce.
  // Sur Android la région live ci-dessous suffit ; sur web aucun des deux
  // mécanismes n'est garanti (repli documenté dans le rapport de tranche).
  useEffect(() => {
    if (Platform.OS !== 'ios' || errorAnnouncement === null) {
      return;
    }
    AccessibilityInfo.announceForAccessibility(errorAnnouncement.message);
  }, [errorAnnouncement]);

  const submit = () => {
    const parsedWeight = canCustomizeWeight ? Number(weight) : 1;
    const input = { name, category, weight: parsedWeight };
    const error = validateTaskInput(input);
    if (error !== null) {
      setErrorAnnouncement(computeErrorAnnouncement(errorAnnouncement, error));
      return;
    }
    setErrorAnnouncement(null);
    if (onSubmit(input)) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
      // `onShow` remplace l'ancien délai magique de 200 ms : il ne se déclenche
      // qu'une fois la fenêtre de la modale réellement attachée, ce qui rend le
      // focus du champ fiable sur iOS et Android. Repli documenté : si une
      // plateforme ne déclenche pas `onShow` (ex. react-native-web), le focus
      // ne bouge pas automatiquement — échec bénin identique à l'ancien
      // comportement Android, le champ reste atteignable au clavier.
      onShow={() => {
        if (isOpenRef.current) {
          nameInputRef.current?.focus();
        }
      }}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={styles.title}>
              {isEditing ? 'Modifier la tâche' : 'Nouvelle tâche'}
            </Text>
            <Text style={styles.helper}>
              {isEditing
                ? 'Les temps déjà enregistrés conservent leur score d’origine : seule cette définition change.'
                : 'Le foyer pourra ensuite enregistrer du temps sur cette tâche.'}
            </Text>

            <Text style={styles.label}>Nom</Text>
            <TextInput
              ref={nameInputRef}
              accessibilityLabel="Nom de la tâche"
              value={name}
              onChangeText={setName}
              maxLength={60}
              placeholder="Ex. Ranger le salon"
              placeholderTextColor={COLORS.textDisabled}
              style={styles.input}
              returnKeyType="next"
            />

            <Text style={styles.label}>Catégorie</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Catégorie de la tâche" style={styles.chips}>
              {CATEGORY_OPTIONS.map((option) => {
                const selected = category === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setCategory(option.value)}
                    style={[styles.chip, selected && styles.selectedChip]}
                  >
                    <Text style={[styles.chipText, selected && styles.selectedChipText]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.weightHeader}>
              <Text style={styles.label}>Poids convenu</Text>
              {!canCustomizeWeight ? <Text style={styles.locked}>Fonction premium</Text> : null}
            </View>
            {canCustomizeWeight ? (
              <TextInput
                accessibilityLabel="Poids de la tâche"
                value={weight}
                onChangeText={setWeight}
                keyboardType="number-pad"
                maxLength={4}
                style={styles.input}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Découvrir la pondération premium"
                onPress={onLockedWeight}
                style={styles.lockedField}
              >
                <Text style={styles.lockedFieldText}>Le mode gratuit utilise le temps brut, poids 1.</Text>
              </Pressable>
            )}
            <Text style={styles.footnote}>Le poids doit rester compris entre 1 et 1000. Il ne mesure pas une vérité absolue.</Text>
            {errorAnnouncement === null ? null : (
              // `key` = jeton : une erreur identique répétée remonte un nœud
              // frais, donc la région live Android re-annonce l'énoncé. Niveau
              // `assertive` voulu : erreur bloquante interrompant l'énoncé en
              // cours, à la différence d'une région `polite` qui attend son tour.
              <View key={errorAnnouncement.token} accessibilityLiveRegion="assertive">
                <Text style={styles.errorText}>{errorAnnouncement.message}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <AppButton label="Annuler" variant="ghost" onPress={onClose} style={styles.action} />
              <AppButton
                label={isEditing ? 'Enregistrer' : 'Ajouter la tâche'}
                onPress={submit}
                style={styles.action}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '92%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  helper: {
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  label: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  selectedChip: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.secondary,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  selectedChipText: {
    color: COLORS.textPrimary,
  },
  weightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  locked: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  lockedField: {
    minHeight: 50,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.md,
  },
  lockedFieldText: {
    color: COLORS.textSecondary,
  },
  footnote: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: SPACING.sm,
  },
  errorText: {
    color: '#A9422F',
    backgroundColor: '#FFF4F1',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  action: {
    flex: 1,
  },
});
