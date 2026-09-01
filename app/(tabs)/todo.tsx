import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { DemoBanner } from '@/src/components/DemoBanner';
import { NoticeBanner } from '@/src/components/NoticeBanner';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { SegmentedControl } from '@/src/components/SegmentedControl';
import { COLORS, RADIUS, SPACING } from '@/src/components/theme';
import { getPlanLabel } from '@/src/domain/entitlements';
import { validateManualMinutes } from '@/src/domain/validation';
import type { TodoItem } from '@/src/domain/types';
import { useApp } from '@/src/store/AppProvider';
import { selectVisibleTodos } from '@/src/store/appReducer';

/* ------------------------------------------------------------------ */
/* Mini-formulaire de création de TodoItem                              */
/* ------------------------------------------------------------------ */

function CreateTodoModal({
  visible,
  householdMembers,
  currentUserId,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  householdMembers: { id: string; name: string }[];
  currentUserId: string;
  onClose: () => void;
  onSubmit: (input: {
    label: string;
    assigneeMemberId: string | null;
    beneficiaryMemberIds: string[];
    dueDate: string | null;
    note: string;
  }) => boolean;
}) {
  const [label, setLabel] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(currentUserId);
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState<string[]>(
    householdMembers.map((m) => m.id),
  );
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  if (!visible) return null;

  const toggleBeneficiary = (id: string) => {
    setSelectedBeneficiaries((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAll = () => setSelectedBeneficiaries(householdMembers.map((m) => m.id));
  const selectNone = () => setSelectedBeneficiaries([]);

  const handleSubmit = () => {
    if (label.trim().length === 0) {
      Alert.alert('Erreur', 'Le libellé ne peut pas être vide.');
      return;
    }
    if (selectedBeneficiaries.length === 0) {
      Alert.alert('Erreur', 'Sélectionne au moins un bénéficiaire.');
      return;
    }
    const parsedDate = dueDate.trim().length > 0 ? parseFrenchDate(dueDate.trim()) : null;
    if (dueDate.trim().length > 0 && parsedDate === null) {
      Alert.alert('Erreur', 'La date doit être au format JJ/MM/AAAA ou AAAA-MM-JJ.');
      return;
    }
    const ok = onSubmit({
      label: label.trim(),
      assigneeMemberId: assigneeId,
      beneficiaryMemberIds: selectedBeneficiaries,
      dueDate: parsedDate,
      note: note.trim(),
    });
    if (ok) {
      setLabel('');
      setAssigneeId(currentUserId);
      setSelectedBeneficiaries(householdMembers.map((m) => m.id));
      setDueDate('');
      setNote('');
      onClose();
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <Card style={styles.modalCard}>
        <Text style={styles.modalTitle}>Nouvelle tâche à venir</Text>

        <Text style={styles.fieldLabel}>Libellé *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Ex : Passer l'aspirateur"
          placeholderTextColor={COLORS.textMuted}
          value={label}
          onChangeText={setLabel}
          maxLength={100}
          accessibilityLabel="Libellé de la tâche"
        />

        <Text style={styles.fieldLabel}>Assigné à (optionnel)</Text>
        <SegmentedControl
          accessibilityLabel="Membre assigné"
          options={householdMembers.map((m) => ({ value: m.id, label: m.name }))}
          value={assigneeId ?? ''}
          onChange={(v) => setAssigneeId(v || null)}
          wrap
        />

        <Text style={styles.fieldLabel}>Fait pour</Text>
        <View style={styles.beneficiaryRow}>
          <Pressable onPress={selectAll} style={styles.chipAction}>
            <Text style={styles.chipActionText}>Tout le monde</Text>
          </Pressable>
          <Pressable onPress={selectNone} style={styles.chipAction}>
            <Text style={styles.chipActionText}>Aucun</Text>
          </Pressable>
        </View>
        <View style={styles.chipWrap}>
          {householdMembers.map((m) => {
            const selected = selectedBeneficiaries.includes(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggleBeneficiary(m.id)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityLabel={`${m.name} — ${selected ? 'sélectionné' : 'non sélectionné'}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Date d'échéance (optionnel)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="JJ/MM/AAAA ou AAAA-MM-JJ"
          placeholderTextColor={COLORS.textMuted}
          value={dueDate}
          onChangeText={setDueDate}
          keyboardType={Platform.OS === 'ios' ? 'default' : 'default'}
          accessibilityLabel="Date d'échéance"
        />

        <Text style={styles.fieldLabel}>Note (optionnel)</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Détails ou rappel…"
          placeholderTextColor={COLORS.textMuted}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          accessibilityLabel="Note"
        />

        <View style={styles.modalActions}>
          <AppButton label="Annuler" onPress={onClose} style={styles.cancelBtn} />
          <AppButton label="Créer" onPress={handleSubmit} />
        </View>
      </Card>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Mini-formulaire de validation (conversion → CompletedEntry)          */
/* ------------------------------------------------------------------ */

function CompleteTodoModal({
  todo,
  householdMembers,
  currentUserId,
  onClose,
  onSubmit,
}: {
  todo: TodoItem | null;
  householdMembers: { id: string; name: string }[];
  currentUserId: string;
  onClose: () => void;
  onSubmit: (
    todoId: string,
    input: {
      performedByMemberId: string;
      durationMinutes: number;
      beneficiaryMemberIds: string[];
    },
  ) => boolean;
}) {
  const [performedBy, setPerformedBy] = useState(currentUserId);
  const [durationText, setDurationText] = useState('');
  const [beneficiaryIds, setBeneficiaryIds] = useState<string[]>([]);

  // Réinitialiser quand un nouveau todo est ouvert
  if (todo !== null && beneficiaryIds.length === 0 && todo.beneficiaryMemberIds.length > 0) {
    // Will be set on first render of a new todo
  }

  if (todo === null) return null;

  const initialBeneficiaries =
    todo.beneficiaryMemberIds.length > 0
      ? todo.beneficiaryMemberIds
      : householdMembers.map((m) => m.id);

  const toggleBeneficiary = (id: string) => {
    setBeneficiaryIds((prev) => {
      const current = prev.length === 0 ? initialBeneficiaries : prev;
      return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    });
  };

  const handleSubmit = () => {
    const duration = Number(durationText);
    if (!Number.isFinite(duration) || !Number.isInteger(duration)) {
      Alert.alert('Erreur', 'La durée doit être un nombre entier de minutes.');
      return;
    }
    const validationError = validateManualMinutes(duration);
    if (validationError !== null) {
      Alert.alert('Erreur', validationError);
      return;
    }
    const finalBeneficiaries = beneficiaryIds.length > 0 ? beneficiaryIds : initialBeneficiaries;
    if (finalBeneficiaries.length === 0) {
      Alert.alert('Erreur', 'Sélectionne au moins un bénéficiaire.');
      return;
    }
    const ok = onSubmit(todo.id, {
      performedByMemberId: performedBy,
      durationMinutes: duration,
      beneficiaryMemberIds: finalBeneficiaries,
    });
    if (ok) {
      setDurationText('');
      setBeneficiaryIds([]);
      onClose();
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <Card style={styles.modalCard}>
        <Text style={styles.modalTitle}>Terminer « {todo.label} »</Text>

        <Text style={styles.fieldLabel}>Fait par</Text>
        <SegmentedControl
          accessibilityLabel="Fait par"
          options={householdMembers.map((m) => ({ value: m.id, label: m.name }))}
          value={performedBy}
          onChange={setPerformedBy}
          wrap
        />

        <Text style={styles.fieldLabel}>Durée réelle (minutes) *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Ex : 30"
          placeholderTextColor={COLORS.textMuted}
          value={durationText}
          onChangeText={setDurationText}
          keyboardType="numeric"
          accessibilityLabel="Durée en minutes"
        />

        <Text style={styles.fieldLabel}>Fait pour</Text>
        <View style={styles.chipWrap}>
          {householdMembers.map((m) => {
            const currentSelection =
              beneficiaryIds.length > 0 ? beneficiaryIds : initialBeneficiaries;
            const selected = currentSelection.includes(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggleBeneficiary(m.id)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.modalActions}>
          <AppButton label="Annuler" onPress={onClose} style={styles.cancelBtn} />
          <AppButton label="Valider" onPress={handleSubmit} />
        </View>
      </Card>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Écran principal To-do                                               */
/* ------------------------------------------------------------------ */

export default function TodoScreen() {
  const { state, dismissNotice, createTodoItem, completeTodoItem, deleteTodoItem } = useApp();
  const [createVisible, setCreateVisible] = useState(false);
  const [completingTodo, setCompletingTodo] = useState<TodoItem | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const householdMembers = useMemo(
    () =>
      state.users.filter((user) =>
        state.memberships.some(
          (m) => m.householdId === state.household.id && m.userId === user.id,
        ),
      ),
    [state.users, state.memberships, state.household.id],
  );

  const { active, completed } = useMemo(
    () => selectVisibleTodos(state),
    [state.todoItems, state.household.id],
  );

  const confirmDelete = (todo: TodoItem) => {
    Alert.alert('Supprimer cette tâche ?', `« ${todo.label} » sera définitivement supprimée.`, [
      { text: 'Conserver', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => deleteTodoItem(todo.id),
      },
    ]);
  };

  return (
    <Screen>
      <DemoBanner />
      <ScreenHeader
        eyebrow={`${state.household.name} · ${getPlanLabel(state.household.plan)}`}
        title="To-do"
        subtitle="Planifie les tâches à venir du foyer."
      />
      <NoticeBanner message={state.notice} onDismiss={dismissNotice} />

      <View style={styles.sectionRow}>
        <SectionTitle
          title="Tâches à venir"
          detail={`${active.length} ${active.length > 1 ? 'tâches' : 'tâche'}`}
        />
        <AppButton label="Ajouter" onPress={() => setCreateVisible(true)} style={styles.addButton} />
      </View>

      {active.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyTitle}>Aucune tâche planifiée</Text>
          <Text style={styles.emptyText}>
            Crée une tâche pour commencer à planifier les tâches du foyer.
          </Text>
        </Card>
      ) : (
        <View style={styles.todoList}>
          {active.map((todo) => {
            const assignee = householdMembers.find((m) => m.id === todo.assigneeMemberId);
            const dueLabel =
              todo.dueDate !== null
                ? new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' }).format(
                    new Date(todo.dueDate),
                  )
                : null;
            return (
              <Card key={todo.id} style={styles.todoCard}>
                <View style={styles.todoRow}>
                  <Pressable
                    onPress={() => {
                      setCompletingTodo(todo);
                    }}
                    style={styles.checkCircle}
                    accessibilityLabel={`Terminer ${todo.label}`}
                  >
                    <Text style={styles.checkCircleText}>✓</Text>
                  </Pressable>
                  <View style={styles.todoCopy}>
                    <Text style={styles.todoLabel}>{todo.label}</Text>
                    <Text style={styles.todoMeta}>
                      {assignee !== undefined ? `Assigné à ${assignee.name}` : ''}
                      {dueLabel !== null ? `${assignee !== undefined ? ' · ' : ''}Échéance ${dueLabel}` : ''}
                      {todo.note.length > 0 ? `\n📝 ${todo.note}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => confirmDelete(todo)}
                    style={styles.deleteAction}
                    accessibilityLabel={`Supprimer ${todo.label}`}
                  >
                    <Text style={styles.deleteActionText}>🗑️</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {completed.length > 0 ? (
        <>
          <Pressable
            onPress={() => setShowCompleted((prev) => !prev)}
            style={styles.completedToggle}
          >
            <Text style={styles.completedToggleText}>
              {showCompleted ? '▼' : '▶'} Terminées ({completed.length})
            </Text>
          </Pressable>
          {showCompleted ? (
            <View style={styles.todoList}>
              {completed.map((todo) => {
                const completedAt =
                  todo.completedAt !== null ? new Date(todo.completedAt) : null;
                return (
                  <Card key={todo.id} style={styles.completedCard}>
                    <View style={styles.todoRow}>
                      <Text style={styles.completedCheck}>✓</Text>
                      <View style={styles.todoCopy}>
                        <Text style={styles.completedLabel}>{todo.label}</Text>
                        <Text style={styles.todoMeta}>
                          {completedAt !== null
                            ? `Terminée le ${new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: 'short' }).format(completedAt)}`
                            : 'Terminée'}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}

      {/* Reminders : désactivés honnêtement (pas de expo-notifications dans les dépendances) */}
      <Card style={styles.reminderNotice}>
        <Text style={styles.reminderTitle}>Rappels locaux</Text>
        <Text style={styles.reminderText}>
          Les rappels locaux seront disponibles dans une prochaine mise à jour.
        </Text>
      </Card>

      <CreateTodoModal
        visible={createVisible}
        householdMembers={householdMembers.map((m) => ({ id: m.id, name: m.name }))}
        currentUserId={state.currentUserId}
        onClose={() => setCreateVisible(false)}
        onSubmit={(input) => createTodoItem(input)}
      />
      <CompleteTodoModal
        todo={completingTodo}
        householdMembers={householdMembers.map((m) => ({ id: m.id, name: m.name }))}
        currentUserId={state.currentUserId}
        onClose={() => setCompletingTodo(null)}
        onSubmit={(todoId, input) => completeTodoItem(todoId, input)}
      />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse une date en format JJ/MM/AAAA ou AAAA-MM-JJ vers ISO string.
 * Retourne null si le format est invalide.
 */
function parseFrenchDate(input: string): string | null {
  // Format JJ/MM/AAAA
  const slashMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (d.getDate() !== Number(day) || d.getMonth() !== Number(month) - 1) return null;
    return d.toISOString().slice(0, 10);
  }
  // Format AAAA-MM-JJ
  const dashMatch = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashMatch) {
    const [, year, month, day] = dashMatch;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (d.getDate() !== Number(day) || d.getMonth() !== Number(month) - 1) return null;
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  addButton: {
    minWidth: 92,
    marginBottom: SPACING.sm,
  },
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
  todoList: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  todoCard: {
    padding: SPACING.md,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkCircleText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  todoCopy: {
    flex: 1,
  },
  todoLabel: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  todoMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  deleteAction: {
    padding: SPACING.xs,
  },
  deleteActionText: {
    fontSize: 14,
  },
  completedToggle: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  completedToggleText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  completedCard: {
    padding: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    opacity: 0.7,
  },
  completedCheck: {
    color: COLORS.success,
    fontSize: 16,
    fontWeight: '800',
    width: 28,
    textAlign: 'center',
    marginTop: 2,
  },
  completedLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  reminderNotice: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
    padding: SPACING.md,
  },
  reminderTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  reminderText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.xs,
  },
  /* Modal */
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    zIndex: 100,
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    padding: SPACING.lg,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  beneficiaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  chipAction: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  chipActionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  cancelBtn: {
    backgroundColor: COLORS.surfaceAlt,
  },
});
