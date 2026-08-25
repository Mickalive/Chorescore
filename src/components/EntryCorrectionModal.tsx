import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ErrorAnnouncement } from '../domain/formFeedback';
import { computeErrorAnnouncement } from '../domain/formFeedback';
import { calculateScore, formatMetric } from '../domain/scoring';
import type { TaskEntry } from '../domain/types';
import { validateManualMinutes } from '../domain/validation';
import { AppButton } from './AppButton';
import { COLORS, RADIUS, SPACING } from './theme';

/**
 * Correction de la durée d'une entrée terminée (DRC-03).
 *
 * L'aperçu est calculé en direct depuis le `weightSnapshot` figé de l'entrée —
 * jamais depuis le poids courant de la tâche — et reste visible avant la
 * confirmation : la personne voit exactement le nouveau score qu'elle valide.
 */
export function EntryCorrectionModal({
  entry,
  taskName,
  useWeights,
  onClose,
  onSubmit,
}: {
  entry: TaskEntry | null;
  taskName: string;
  useWeights: boolean;
  onClose: () => void;
  onSubmit: (minutes: number) => boolean;
}) {
  const [minutes, setMinutes] = useState('');
  const [errorAnnouncement, setErrorAnnouncement] = useState<ErrorAnnouncement | null>(null);
  const minutesInputRef = useRef<TextInput>(null);
  // Même miroir de visibilité que les autres modales : un `onShow` tardif ne
  // doit pas focus un champ invisible.
  const isOpenRef = useRef(false);
  isOpenRef.current = entry !== null;

  useEffect(() => {
    if (entry === null) {
      setMinutes('');
      setErrorAnnouncement(null);
      return;
    }
    setMinutes(String(Math.round(entry.durationSeconds / 60)));
    setErrorAnnouncement(null);
  }, [entry]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || errorAnnouncement === null) {
      return;
    }
    AccessibilityInfo.announceForAccessibility(errorAnnouncement.message);
  }, [errorAnnouncement]);

  const parsedMinutes = Number(minutes);
  const previewError = validateManualMinutes(parsedMinutes);
  const previewScore =
    entry !== null && previewError === null ? calculateScore(parsedMinutes * 60, entry.weightSnapshot) : null;

  const submit = () => {
    const error = validateManualMinutes(parsedMinutes);
    if (error !== null) {
      setErrorAnnouncement(computeErrorAnnouncement(errorAnnouncement, error));
      return;
    }
    setErrorAnnouncement(null);
    if (onSubmit(parsedMinutes)) {
      onClose();
    }
  };

  return (
    <Modal
      visible={entry !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
      onShow={() => {
        if (isOpenRef.current) {
          minutesInputRef.current?.focus();
        }
      }}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.title}>Corriger la durée</Text>
          <Text style={styles.taskName}>{taskName}</Text>
          {entry === null ? null : (
            <Text style={styles.current}>
              Actuel : {Math.round(entry.durationSeconds / 60)} min ·{' '}
              {formatMetric(entry.score, true)} · poids figé {entry.weightSnapshot}
            </Text>
          )}

          <Text style={styles.label}>Durée corrigée en minutes</Text>
          <TextInput
            ref={minutesInputRef}
            accessibilityLabel="Durée corrigée en minutes"
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            placeholder="Ex. 25"
            placeholderTextColor={COLORS.textDisabled}
            maxLength={4}
            style={styles.input}
          />
          <Text style={styles.help}>Entre 1 minute et 24 heures. Le poids figé au départ ne change pas.</Text>

          {/* Aperçu annoncé en région live : le score validé est toujours celui
              affiché ici avant confirmation. */}
          <View style={styles.preview} accessibilityLiveRegion="polite">
            {previewError !== null || entry === null || previewScore === null ? (
              <Text style={styles.previewPending}>Saisis une durée valide pour voir le score recalculé.</Text>
            ) : (
              <Text style={styles.previewValue}>
                Aperçu : {parsedMinutes} min × poids figé {entry.weightSnapshot} ={' '}
                {formatMetric(previewScore, true)}
                {useWeights ? '' : ' (comparaison du foyer en temps brut)'}
              </Text>
            )}
          </View>

          {errorAnnouncement === null ? null : (
            <View key={errorAnnouncement.token} accessibilityLiveRegion="assertive">
              <Text style={styles.errorText}>{errorAnnouncement.message}</Text>
            </View>
          )}
          <View style={styles.actions}>
            <AppButton label="Annuler" variant="ghost" onPress={onClose} style={styles.action} />
            <AppButton label="Corriger" onPress={submit} style={styles.action} />
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
  current: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
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
  preview: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.success,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  previewValue: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    lineHeight: 20,
  },
  previewPending: {
    color: COLORS.textSecondary,
    lineHeight: 20,
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
