import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TaskDefinition } from '../domain/types';
import { validateManualMinutes } from '../domain/validation';
import { AppButton } from './AppButton';
import { COLORS, RADIUS, SPACING } from './theme';

export function ManualEntryModal({
  task,
  onClose,
  onSubmit,
}: {
  task: TaskDefinition | null;
  onClose: () => void;
  onSubmit: (minutes: number) => boolean;
}) {
  const [minutes, setMinutes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (task === null) {
      setMinutes('');
      setLocalError(null);
    }
  }, [task]);

  const submit = () => {
    const parsedMinutes = Number(minutes);
    const error = validateManualMinutes(parsedMinutes);
    if (error !== null) {
      setLocalError(error);
      return;
    }
    setLocalError(null);
    if (onSubmit(parsedMinutes)) {
      onClose();
    }
  };

  return (
    <Modal visible={task !== null} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.title}>Ajouter un temps</Text>
          <Text style={styles.taskName}>{task?.name}</Text>
          <Text style={styles.label}>Durée en minutes</Text>
          <TextInput
            autoFocus
            accessibilityLabel="Durée en minutes"
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            placeholder="Ex. 25"
            placeholderTextColor={COLORS.textDisabled}
            maxLength={4}
            style={styles.input}
          />
          <Text style={styles.help}>Entre 1 minute et 24 heures.</Text>
          {localError === null ? null : (
            <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{localError}</Text>
          )}
          <View style={styles.actions}>
            <AppButton label="Annuler" variant="ghost" onPress={onClose} style={styles.action} />
            <AppButton label="Enregistrer" onPress={submit} style={styles.action} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  taskName: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: SPACING.xs,
  },
  label: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    fontSize: 18,
  },
  help: {
    color: COLORS.textMuted,
    fontSize: 12,
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
