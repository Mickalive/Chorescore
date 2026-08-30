export type PlanScenario = 'trial' | 'free' | 'standard' | 'pro';

export type TaskCategory =
  | 'dishes'
  | 'cooking'
  | 'cleaning'
  | 'laundry'
  | 'shopping'
  | 'other';

export type User = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

export type Household = {
  id: string;
  name: string;
  timezone: string;
  plan: PlanScenario;
  trialStartedAt: string;
  trialEndsAt: string;
  maxMembers: number | null;
};

export type Membership = {
  householdId: string;
  userId: string;
  role: 'owner' | 'member';
  joinedAt: string;
};

export type TaskDefinition = {
  id: string;
  householdId: string;
  name: string;
  category: TaskCategory;
  weight: number;
  active: boolean;
  createdAt: string;
};

export type TaskEntryStatus = 'in_progress' | 'completed';

export type TaskEntry = {
  id: string;
  taskId: string;
  householdId: string;
  userId: string;
  status: TaskEntryStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number;
  weightSnapshot: number;
  score: number;
  isManual: boolean;
  periodKey: string;
};

export type ConsentState = {
  termsAccepted: boolean;
  termsVersion: string;
  acceptedAt: string | null;
  analyticsOptIn: boolean;
};

export type AppSnapshot = {
  users: User[];
  household: Household;
  memberships: Membership[];
  tasks: TaskDefinition[];
  entries: TaskEntry[];
  currentUserId: string;
};

export type Period = 'week' | 'month';

export type PremiumFeature =
  | 'custom_weights'
  | 'advanced_history'
  | 'export_pdf'
  | 'multiple_households';

/* ------------------------------------------------------------------ */
/* V2 canonical model (DRC-01)                                         */
/* ------------------------------------------------------------------ */

/**
 * Réalisation passée : libellé libre, fait par qui, fait pour qui, durée
 * réelle, date, foyer, tâche persistante facultative et coefficient de
 * pondération avancé. Le modèle est compatible Tricount : pour D fait par P
 * pour N bénéficiaires, P reçoit +D et chaque bénéficiaire -D/N.
 */
export type CompletedEntry = {
  id: string;
  label: string;
  householdId: string;
  performedByMemberId: string;
  beneficiaryMemberIds: string[];
  durationSeconds: number;
  completedAt: string;
  persistentTaskId: string | null;
  weight: number;
};

/**
 * Tâche persistante facultative : raccourci de saisie et exactement un filtre
 * Score. Les libellés ponctuels ne deviennent jamais des PersistentTask ;
#  ils relèvent du filtre « Autres » dans Score.
 */
export type PersistentTask = {
  id: string;
  householdId: string;
  name: string;
  defaultWeight: number;
  createdAt: string;
};

/**
 * Tâche future : peut être datée, assignée, avoir des bénéficiaires et une
 * note. Le check terminé créera une CompletedEntry.
 */
export type TodoItem = {
  id: string;
  householdId: string;
  label: string;
  assigneeMemberId: string | null;
  beneficiaryMemberIds: string[];
  dueDate: string | null;
  note: string;
  persistentTaskId: string | null;
  createdAt: string;
  completedAt: string | null;
};
