import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TaskCategory } from '../domain/types';
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
  onClose,
  onSubmit,
  onLockedWeight,
}: {
  visible: boolean;
  canCustomizeWeight: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; category: TaskCategory; weight: number }) => boolean;
  onLockedWeight: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TaskCategory>('other');
  const [weight, setWeight] = useState('2');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setName('');
      setCategory('other');
      setWeight('2');
      setLocalError(null);
    }
  }, [visible]);

  const submit = () => {
    const parsedWeight = canCustomizeWeight ? Number(weight) : 1;
    const input = { name, category, weight: parsedWeight };
    const error = validateTaskInput(input);
    if (error !== null) {
      setLocalError(error);
      return;
    }
    setLocalError(null);
    if (onSubmit(input)) {
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={styles.title}>Nouvelle tâche</Text>
            <Text style={styles.helper}>Le foyer pourra ensuite enregistrer du temps sur cette tâche.</Text>

            <Text style={styles.label}>Nom</Text>
            <TextInput
              accessibilityLabel="Nom de la tâche"
              autoFocus
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
            {localError === null ? null : (
              <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{localError}</Text>
            )}

            <View style={styles.actions}>
              <AppButton label="Annuler" variant="ghost" onPress={onClose} style={styles.action} />
              <AppButton label="Ajouter la tâche" onPress={submit} style={styles.action} />
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
