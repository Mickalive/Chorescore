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
