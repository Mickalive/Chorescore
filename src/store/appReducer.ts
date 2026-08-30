import { getEffectiveWeight, getEntitlements } from '../domain/entitlements';
import type {
  AppSnapshot,
  ConsentState,
  Household,
  Membership,
  PlanScenario,
  PremiumFeature,
  TaskCategory,
  TaskDefinition,
  TaskEntry,
} from '../domain/types';
import { normalizeTaskName, validateManualMinutes, validateTaskInput } from '../domain/validation';

export type HydrationPhase =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string };

export type AppState = AppSnapshot & {
  /**
   * DRC-04 : collection complète des foyers locaux du document persisté.
   * `household` (hérité d'AppSnapshot) reste le foyer actif matérialisé ; il
   * doit toujours être l'élément de `households` désigné par
   * `currentHouseholdId` — invariant maintenu par les seules actions qui
   * touchent au roster et vérifié par les tests.
   */
  households: Household[];
  currentHouseholdId: string;
  hydration: HydrationPhase;
  onboardingComplete: boolean;
  consent: ConsentState;
  paywallFeature: PremiumFeature | null;
  notice: string | null;
  analyticsEventCount: number;
};

export type Action =
  | {
      type: 'HYDRATION_READY';
      snapshot: AppSnapshot;
      roster: { households: Household[]; currentHouseholdId: string };
      durable: { onboardingComplete: boolean; consent: ConsentState };
      notice: string | null;
    }
  | { type: 'HYDRATION_FAILED'; message: string }
  | { type: 'HYDRATION_RESTART' }
  | { type: 'COMPLETE_ONBOARDING'; consent: ConsentState }
  | { type: 'SET_ANALYTICS_CONSENT'; enabled: boolean; eventCount: number }
  | { type: 'SET_PLAN'; plan: PlanScenario; maxMembers: number | null }
  | { type: 'SET_USER'; userId: string }
  | { type: 'ADD_TASK'; task: TaskDefinition }
  | { type: 'UPDATE_TASK'; task: TaskDefinition }
  | { type: 'ARCHIVE_TASK'; taskId: string }
  | { type: 'ADD_ENTRY'; entry: TaskEntry; eventCount: number }
  | { type: 'REPLACE_ENTRY'; entry: TaskEntry; eventCount: number }
  | { type: 'EDIT_ENTRY'; entry: TaskEntry }
  | { type: 'DELETE_ENTRY'; entryId: string }
  | { type: 'CANCEL_TIMER'; entryId: string }
  | { type: 'CREATE_HOUSEHOLD'; household: Household; joinedAt: string }
  | { type: 'SWITCH_HOUSEHOLD'; householdId: string }
  | { type: 'SHOW_PAYWALL'; feature: PremiumFeature }
  | { type: 'HIDE_PAYWALL' }
  | { type: 'SET_NOTICE'; notice: string | null }
  | { type: 'RESET_DEMO'; snapshot: AppSnapshot };

export const TERMS_VERSION = 'demo-v1';

const EPOCH_ISO = '1970-01-01T00:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Plafond de foyers locaux conservés dans le document persisté : la démo reste
 * un outil d'exploration, pas un gestionnaire illimité, et la taille du
 * document reste sous le garde-fou de persistance.
 */
export const MAX_LOCAL_HOUSEHOLDS = 4;

/**
 * Rétablit la cohérence entre le roster complet et le foyer actif matérialisé.
 * Appelée par les seules actions qui modifient `households` ou
 * `currentHouseholdId` ; toute autre action préserve les deux par spread.
 */
function withActiveHousehold(
  state: AppState,
  households: Household[],
  currentHouseholdId: string,
): AppState {
  const household = households.find((candidate) => candidate.id === currentHouseholdId);
  if (household === undefined) {
    // Inconstructible via les planners : le foyer actif existe toujours dans
    // le roster. Le repli conserve l'état entrant plutôt que d'inventer.
    return state;
  }
  return { ...state, households, currentHouseholdId, household };
}

/**
 * État d'amorçage utilisé pendant l'hydratation : volontairement vide, il ne
 * contient aucune donnée fictive de démonstration afin qu'aucun écran ne puisse
 * afficher un flash de `demoData` avant la lecture du stockage.
 */
export function createLoadingState(): AppState {
  return {
    users: [],
    household: {
      id: '',
      name: '',
      timezone: 'UTC',
      plan: 'trial',
      trialStartedAt: EPOCH_ISO,
      trialEndsAt: EPOCH_ISO,
      maxMembers: null,
    },
    households: [],
    currentHouseholdId: '',
    memberships: [],
    tasks: [],
    entries: [],
    currentUserId: '',
    hydration: { phase: 'loading' },
    onboardingComplete: false,
    consent: {
      termsAccepted: false,
      termsVersion: TERMS_VERSION,
      acceptedAt: null,
      analyticsOptIn: false,
    },
    paywallFeature: null,
    notice: null,
    analyticsEventCount: 0,
  };
}

export function createInitialState(snapshot: AppSnapshot): AppState {
  return {
    ...snapshot,
    households: [snapshot.household],
    currentHouseholdId: snapshot.household.id,
    hydration: { phase: 'ready' },
    onboardingComplete: false,
    consent: {
      termsAccepted: false,
      termsVersion: TERMS_VERSION,
      acceptedAt: null,
      analyticsOptIn: false,
    },
    paywallFeature: null,
    notice: null,
    analyticsEventCount: 0,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATION_READY':
      return {
        ...action.snapshot,
        households: action.roster.households,
        currentHouseholdId: action.roster.currentHouseholdId,
        hydration: { phase: 'ready' },
        onboardingComplete: action.durable.onboardingComplete,
        consent: action.durable.consent,
        paywallFeature: null,
        notice: action.notice,
        analyticsEventCount: 0,
      };
    case 'HYDRATION_FAILED':
      return { ...createLoadingState(), hydration: { phase: 'error', message: action.message } };
    case 'HYDRATION_RESTART':
      return createLoadingState();
    case 'COMPLETE_ONBOARDING':
      return { ...state, onboardingComplete: true, consent: action.consent, notice: null };
    case 'SET_ANALYTICS_CONSENT':
      return {
        ...state,
        consent: { ...state.consent, analyticsOptIn: action.enabled },
        analyticsEventCount: action.eventCount,
      };
    case 'SET_PLAN': {
      // DRC-04 : le scénario s'applique au foyer actif et à sa copie dans le
      // roster persisté — les deux restent une seule et même vérité.
      const households = state.households.map((candidate) =>
        candidate.id === state.currentHouseholdId
          ? { ...candidate, plan: action.plan, maxMembers: action.maxMembers }
          : candidate,
      );
      const next = withActiveHousehold(
        { ...state, household: { ...state.household, plan: action.plan, maxMembers: action.maxMembers } },
        households,
        state.currentHouseholdId,
      );
      return { ...next, notice: `Scénario ${action.plan} activé pour tout le foyer.` };
    }
    case 'SET_USER':
      return { ...state, currentUserId: action.userId, notice: null };
    case 'ADD_TASK':
      return { ...state, tasks: [action.task, ...state.tasks], notice: 'La tâche a été ajoutée.' };
    case 'UPDATE_TASK':
      // DRC-03 : seule la définition courante change ; les entrées existantes
      // conservent leur `weightSnapshot` et leur score figés.
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.task.id ? action.task : task)),
        notice: 'La tâche a été mise à jour.',
      };
    case 'ARCHIVE_TASK':
      // DRC-03 : l'archivage retire la tâche des propositions mais conserve sa
      // définition pour que l'historique reste libellé sans rupture.
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId ? { ...task, active: false } : task,
        ),
        notice: 'Tâche archivée : elle reste visible dans l’historique.',
      };
    case 'ADD_ENTRY':
      return {
        ...state,
        entries: [action.entry, ...state.entries],
        notice: action.entry.status === 'in_progress' ? 'Chrono démarré.' : 'Temps ajouté.',
        analyticsEventCount: action.eventCount,
      };
    case 'REPLACE_ENTRY':
      return {
        ...state,
        entries: state.entries.map((entry) => (entry.id === action.entry.id ? action.entry : entry)),
        notice: 'Tâche terminée et score mis à jour.',
        analyticsEventCount: action.eventCount,
      };
    case 'EDIT_ENTRY':
      return {
        ...state,
        entries: state.entries.map((entry) => (entry.id === action.entry.id ? action.entry : entry)),
        notice: 'Durée corrigée et score recalculé.',
      };
    case 'DELETE_ENTRY':
      // DRC-03 : suppression réelle et confirmée ; classement, historique et
      // document persisté sont recalculés depuis `entries`, donc sans orpheline.
      return {
        ...state,
        entries: state.entries.filter((entry) => entry.id !== action.entryId),
        notice: 'Entrée supprimée.',
      };
    case 'CANCEL_TIMER':
      // DRC-03 : annulation déterministe d'un chrono actif — l'entrée en cours
      // disparaît, aucune entrée fantôme n'est créée, et une relance suivante
      // ne produit aucun événement de reprise pour elle (cohérent avec
      // `applyRestartRules`).
      return {
        ...state,
        entries: state.entries.filter((entry) => entry.id !== action.entryId),
        notice: 'Chrono annulé : aucune entrée créée.',
      };
    case 'CREATE_HOUSEHOLD': {
      // DRC-04 : création réelle d'un foyer local. Il démarre vide (aucune
      // tâche, aucune entrée) : tâches, classement, historique et entrées sont
      // isolés par foyer dans le document persisté. La personne courante en
      // devient propriétaire ; les autres membres ne sont pas dupliqués.
      const memberships: Membership[] = [
        ...state.memberships,
        {
          householdId: action.household.id,
          userId: state.currentUserId,
          role: 'owner' as const,
          joinedAt: action.joinedAt,
        },
      ];
      const next = withActiveHousehold(
        { ...state, memberships },
        [...state.households, action.household],
        action.household.id,
      );
      return {
        ...next,
        notice: `Foyer « ${action.household.name} » créé : ses données sont séparées des autres foyers.`,
      };
    }
    case 'SWITCH_HOUSEHOLD': {
      const target = state.households.find((candidate) => candidate.id === action.householdId);
      if (target === undefined) {
        return state;
      }
      const next = withActiveHousehold(state, state.households, target.id);
      // DRC-04 : un chrono lancé dans un autre foyer reste actif mais
      // invisible dans le foyer cible (la liste ne montre que ses tâches).
      // La bascule l'annonce explicitement, foyer d'origine nommé, pour que
      // l'arrêt reste découvrable sans deviner où il tourne.
      const running = state.entries.find(
        (entry) =>
          entry.userId === state.currentUserId &&
          entry.status === 'in_progress' &&
          entry.householdId !== target.id,
      );
      if (running === undefined) {
        return { ...next, notice: `Foyer actif : ${target.name}.` };
      }
      const originName =
        state.households.find((candidate) => candidate.id === running.householdId)?.name ??
        'l’autre foyer';
      return {
        ...next,
        notice: `Foyer actif : ${target.name}. Un chrono lancé dans « ${originName} » continue de tourner : retourne dans ce foyer pour l’arrêter.`,
      };
    }
    case 'SHOW_PAYWALL':
      return { ...state, paywallFeature: action.feature };
    case 'HIDE_PAYWALL':
      return { ...state, paywallFeature: null };
    case 'SET_NOTICE':
      return { ...state, notice: action.notice };
    case 'RESET_DEMO': {
      // La réinitialisation restaure le semis à foyer unique : les foyers
      // locaux ajoutés disparaissent avec le reste des données fictives.
      const next = withActiveHousehold(
        { ...state, ...action.snapshot },
        [action.snapshot.household],
        action.snapshot.household.id,
      );
      return { ...next, paywallFeature: null, notice: 'Les données fictives ont été réinitialisées.' };
    }
  }
}

export type InteractionPlan<T> = { ok: true; value: T } | { ok: false; error: string };

export type AddTaskFormInput = {
  name: string;
  category: TaskCategory;
  weight: number;
};

export type PlannedTaskCreation = {
  name: string;
  category: TaskCategory;
  weight: number;
};

export function planAddTask(state: AppState, input: AddTaskFormInput): InteractionPlan<PlannedTaskCreation> {
  const error = validateTaskInput(input);
  if (error !== null) {
    return { ok: false, error };
  }
  const entitlements = getEntitlements(state.household.plan);
  return {
    ok: true,
    value: {
      name: input.name,
      category: input.category,
      weight: entitlements.canCustomizeWeights ? input.weight : 1,
    },
  };
}

export type PlannedTimerStart = {
  task: TaskDefinition;
  effectiveWeight: number;
};

export function planStartTimer(state: AppState, taskId: string): InteractionPlan<PlannedTimerStart> {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    return { ok: false, error: 'Cette tâche n’existe plus.' };
  }
  // DRC-04 : isolation par foyer — une tâche d'un autre foyer n'est jamais
  // actionnable depuis le foyer actif.
  if (task.householdId !== state.household.id) {
    return { ok: false, error: 'Cette tâche appartient à un autre foyer.' };
  }
  if (!task.active) {
    // DRC-03 : une tâche archivée n'est plus proposée aux nouveaux chronos.
    return { ok: false, error: 'Cette tâche est archivée : elle reste consultable dans l’historique.' };
  }
  const alreadyRunning = state.entries.some(
    (entry) => entry.userId === state.currentUserId && entry.status === 'in_progress',
  );
  if (alreadyRunning) {
    return { ok: false, error: 'Termine le chrono actif avant d’en lancer un autre.' };
  }
  return {
    ok: true,
    value: {
      task,
      effectiveWeight: getEffectiveWeight(state.household.plan, task.weight),
    },
  };
}

export function planCompleteTimer(state: AppState, entryId: string): InteractionPlan<{ entry: TaskEntry }> {
  const entry = state.entries.find(
    (candidate) => candidate.id === entryId && candidate.userId === state.currentUserId,
  );
  if (entry === undefined || entry.status !== 'in_progress') {
    return { ok: false, error: 'Ce chrono n’est pas disponible.' };
  }
  // DRC-04 : une entrée d'un autre foyer n'est pas manipulable ici.
  if (entry.householdId !== state.household.id) {
    return { ok: false, error: 'Cette entrée appartient à un autre foyer.' };
  }
  return { ok: true, value: { entry } };
}

export function planSetUser(state: AppState, userId: string): InteractionPlan<string> {
  if (!state.users.some((user) => user.id === userId)) {
    return { ok: false, error: 'Ce membre est introuvable dans ce foyer.' };
  }
  return { ok: true, value: userId };
}

export type PlannedManualEntry = {
  task: TaskDefinition;
  durationMinutes: number;
  effectiveWeight: number;
  performedByMemberId: string;
};

export function planManualEntry(
  state: AppState,
  taskId: string,
  durationMinutes: number,
  performedByMemberId: string,
): InteractionPlan<PlannedManualEntry> {
  const error = validateManualMinutes(durationMinutes);
  if (error !== null) {
    return { ok: false, error };
  }
  if (performedByMemberId.length === 0) {
    return { ok: false, error: 'Un membre doit être sélectionné pour « Fait par ».' };
  }
  const isMember = state.memberships.some(
    (m) => m.householdId === state.household.id && m.userId === performedByMemberId,
  );
  if (!isMember) {
    return { ok: false, error: 'Le membre sélectionné n\u2019appartient pas à ce foyer.' };
  }
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    return { ok: false, error: 'Cette tâche n’existe plus.' };
  }
  // DRC-04 : isolation par foyer (même garde que pour les chronos).
  if (task.householdId !== state.household.id) {
    return { ok: false, error: 'Cette tâche appartient à un autre foyer.' };
  }
  if (!task.active) {
    // DRC-03 : une tâche archivée n'accepte plus de nouvelle saisie.
    return { ok: false, error: 'Cette tâche est archivée : elle reste consultable dans l’historique.' };
  }
  return {
    ok: true,
    value: {
      task,
      durationMinutes,
      effectiveWeight: getEffectiveWeight(state.household.plan, task.weight),
      performedByMemberId,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Contrôle des données (DRC-03)                                       */
/* ------------------------------------------------------------------ */

export type PlannedTaskUpdate = {
  task: TaskDefinition;
  name: string;
  category: TaskCategory;
  weight: number;
};

/**
 * Modification d'une tâche existante : le nom et la catégorie sont validés
 * comme à la création. En scénario sans pondération personnalisée, le poids
 * soumis est ignoré et le poids existant est conservé : un champ que la
 * personne ne peut pas contrôler n'est jamais réécrit en cachette. Les
 * entrées déjà validées ne sont pas concernées (snapshot figé).
 */
export function planUpdateTask(
  state: AppState,
  taskId: string,
  input: AddTaskFormInput,
): InteractionPlan<PlannedTaskUpdate> {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    return { ok: false, error: 'Cette tâche n’existe plus.' };
  }
  // DRC-04 : isolation par foyer.
  if (task.householdId !== state.household.id) {
    return { ok: false, error: 'Cette tâche appartient à un autre foyer.' };
  }
  const error = validateTaskInput(input);
  if (error !== null) {
    return { ok: false, error };
  }
  const entitlements = getEntitlements(state.household.plan);
  return {
    ok: true,
    value: {
      task,
      name: input.name,
      category: input.category,
      weight: entitlements.canCustomizeWeights ? input.weight : task.weight,
    },
  };
}

export function planArchiveTask(state: AppState, taskId: string): InteractionPlan<TaskDefinition> {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    return { ok: false, error: 'Cette tâche n’existe plus.' };
  }
  // DRC-04 : isolation par foyer.
  if (task.householdId !== state.household.id) {
    return { ok: false, error: 'Cette tâche appartient à un autre foyer.' };
  }
  if (!task.active) {
    return { ok: false, error: 'Cette tâche est déjà archivée.' };
  }
  return { ok: true, value: task };
}

export type PlannedEntryDurationEdit = {
  entry: TaskEntry;
  durationMinutes: number;
};

/**
 * Correction d'une entrée terminée du membre actif : la durée suit les mêmes
 * bornes qu'une saisie manuelle ; le score sera recalculé par le service
 * depuis le `weightSnapshot` figé, jamais depuis le poids courant.
 */
export function planEditEntryDuration(
  state: AppState,
  entryId: string,
  durationMinutes: number,
): InteractionPlan<PlannedEntryDurationEdit> {
  const error = validateManualMinutes(durationMinutes);
  if (error !== null) {
    return { ok: false, error };
  }
  const entry = state.entries.find(
    (candidate) => candidate.id === entryId && candidate.userId === state.currentUserId,
  );
  if (entry === undefined || entry.status !== 'completed') {
    return { ok: false, error: 'Cette entrée ne peut pas être corrigée.' };
  }
  // DRC-04 : une entrée d'un autre foyer n'est pas corrigeable ici.
  if (entry.householdId !== state.household.id) {
    return { ok: false, error: 'Cette entrée appartient à un autre foyer.' };
  }
  return { ok: true, value: { entry, durationMinutes } };
}

/** Suppression confirmée d'une entrée terminée du membre actif. */
export function planDeleteEntry(state: AppState, entryId: string): InteractionPlan<string> {
  const entry = state.entries.find(
    (candidate) => candidate.id === entryId && candidate.userId === state.currentUserId,
  );
  if (entry === undefined || entry.status !== 'completed') {
    return { ok: false, error: 'Cette entrée ne peut pas être supprimée.' };
  }
  // DRC-04 : une entrée d'un autre foyer n'est pas supprimable ici.
  if (entry.householdId !== state.household.id) {
    return { ok: false, error: 'Cette entrée appartient à un autre foyer.' };
  }
  return { ok: true, value: entryId };
}

/**
 * Annulation d'un chrono actif du membre actif : l'entrée en cours est
 * retirée sans créer d'entrée fantôme ; à la relance suivante,
 * `applyRestartRules` ne produit aucun événement pour elle.
 */
export function planCancelTimer(state: AppState, entryId: string): InteractionPlan<string> {
  const entry = state.entries.find(
    (candidate) => candidate.id === entryId && candidate.userId === state.currentUserId,
  );
  if (entry === undefined || entry.status !== 'in_progress') {
    return { ok: false, error: 'Ce chrono n’est pas disponible.' };
  }
  // DRC-04 : une entrée d'un autre foyer n'est pas annulable ici.
  if (entry.householdId !== state.household.id) {
    return { ok: false, error: 'Cette entrée appartient à un autre foyer.' };
  }
  return { ok: true, value: entryId };
}

/* ------------------------------------------------------------------ */
/* Foyers locaux multiples (DRC-04)                                    */
/* ------------------------------------------------------------------ */

let householdSequence = 0;

/**
 * Fabrique pure d'un foyer local de démonstration. Il hérite du scénario et du
 * fuseau du foyer courant (continuité d'exploration) et démarre un essai neuf
 * de 30 jours ; il ne contient aucune tâche ni entrée.
 */
export function createLocalHousehold(name: string, source: Household, now: Date): Household {
  householdSequence += 1;
  return {
    id: `household_${now.getTime()}_${householdSequence}`,
    name,
    timezone: source.timezone,
    plan: source.plan,
    trialStartedAt: now.toISOString(),
    trialEndsAt: new Date(now.getTime() + 30 * DAY_MS).toISOString(),
    maxMembers: getEntitlements(source.plan).maxMembers,
  };
}

/**
 * Création d'un foyer local : réservée aux scénarios qui ouvrent la fonction,
 * avec nom normalisé et plafond documenté. Le double contrôle du droit
 * (ici et à l'écran) est volontaire : la porte logique ne repose pas
 * uniquement sur l'interface.
 */
export function planCreateHousehold(state: AppState, rawName: string): InteractionPlan<{ name: string }> {
  if (!getEntitlements(state.household.plan).canUseMultipleHouseholds) {
    return { ok: false, error: 'Créer un autre foyer fait partie des offres complètes.' };
  }
  if (state.households.length >= MAX_LOCAL_HOUSEHOLDS) {
    return {
      ok: false,
      error: `La démo conserve au plus ${MAX_LOCAL_HOUSEHOLDS} foyers sur cet appareil.`,
    };
  }
  const name = normalizeTaskName(rawName);
  if (name.length < 2) {
    return { ok: false, error: 'Le nom du foyer doit contenir au moins 2 caractères.' };
  }
  if (name.length > 40) {
    return { ok: false, error: 'Le nom du foyer ne peut pas dépasser 40 caractères.' };
  }
  return { ok: true, value: { name } };
}

/** Bascule réelle vers un foyer local existant du document persisté. */
export function planSwitchHousehold(
  state: AppState,
  householdId: string,
): InteractionPlan<Household> {
  const target = state.households.find((candidate) => candidate.id === householdId);
  if (target === undefined) {
    return { ok: false, error: 'Ce foyer est introuvable sur cet appareil.' };
  }
  if (target.id === state.currentHouseholdId) {
    return { ok: false, error: 'Tu es déjà dans ce foyer.' };
  }
  return { ok: true, value: target };
}

/**
 * Tâches affichées par l'écran Tâches : actives ET rattachées au foyer actif.
 * Sans ce filtre, les tâches d'un autre foyer local fuiteraient dans la liste
 * dès qu'un second foyer existe.
 */
export function selectVisibleTasks(state: AppState): TaskDefinition[] {
  return state.tasks.filter(
    (task) => task.active && task.householdId === state.currentHouseholdId,
  );
}

