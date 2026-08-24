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
  const [errorAnnouncement, setErrorAnnouncement] = useState<ErrorAnnouncement | null>(null);
  const minutesInputRef = useRef<TextInput>(null);
  // Miroir de visibilité consulté par `onShow` : si la modale est fermée
  // pendant son animation d'ouverture, un `onShow` tardif ne doit pas focus
  // un TextInput monté mais invisible (le clavier surgirait au-dessus de
  // l'écran sous-jacent). Le ref évite toute closure périmée.
  const isOpenRef = useRef(false);
  isOpenRef.current = task !== null;

  useEffect(() => {
    if (task === null) {
      setMinutes('');
      setErrorAnnouncement(null);
    }
  }, [task]);

  // Annonce impérative pour VoiceOver : `accessibilityLiveRegion` est ignoré
  // sur iOS. Même motif que TaskFormModal ; sur Android la région live
  // ci-dessous suffit, sur web aucun mécanisme n'est garanti (repli documenté).
  useEffect(() => {
    if (Platform.OS !== 'ios' || errorAnnouncement === null) {
      return;
    }
    AccessibilityInfo.announceForAccessibility(errorAnnouncement.message);
  }, [errorAnnouncement]);

  const submit = () => {
    const parsedMinutes = Number(minutes);
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
      visible={task !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
      // `onShow` remplace l'ancien délai magique de 200 ms : il ne se
      // déclenche qu'une fois la fenêtre de la modale réellement attachée.
      // Repli documenté : sans `onShow`, le focus ne bouge pas
      // automatiquement — échec bénin, le champ reste atteignable au clavier.
      onShow={() => {
        if (isOpenRef.current) {
          minutesInputRef.current?.focus();
        }
      }}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.title}>Ajouter un temps</Text>
          <Text style={styles.taskName}>{task?.name}</Text>
          <Text style={styles.label}>Durée en minutes</Text>
          <TextInput
            ref={minutesInputRef}
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
