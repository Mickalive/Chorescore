import type { Household, PlanScenario, PremiumFeature } from './types';

export type Entitlements = {
  useWeights: boolean;
  canCustomizeWeights: boolean;
  canViewMonthlyLeaderboard: boolean;
  canViewAdvancedHistory: boolean;
  canExportPdf: boolean;
  canUseMultipleHouseholds: boolean;
  /** Quota numérique de foyers autorisés : ne jamais simplifier en booléen. */
  householdLimit: number;
  historyDays: number | null;
  maxMembers: number | null;
};

const PREMIUM_ENTITLEMENTS: Omit<Entitlements, 'maxMembers' | 'householdLimit'> = {
  useWeights: true,
  canCustomizeWeights: true,
  canViewMonthlyLeaderboard: true,
  canViewAdvancedHistory: true,
  canExportPdf: true,
  canUseMultipleHouseholds: true,
  historyDays: null,
};

export function getEntitlements(plan: PlanScenario): Entitlements {
  if (plan === 'free') {
    return {
      useWeights: false,
      canCustomizeWeights: false,
      canViewMonthlyLeaderboard: false,
      canViewAdvancedHistory: false,
      canExportPdf: false,
      canUseMultipleHouseholds: false,
      householdLimit: 1,
      historyDays: 30,
      maxMembers: null,
    };
  }

  return {
    ...PREMIUM_ENTITLEMENTS,
    maxMembers: plan === 'standard' ? 7 : null,
    householdLimit: plan === 'trial' ? 3 : plan === 'standard' ? 5 : 10,
  };
}

export function canAccessFeature(household: Household, feature: PremiumFeature): boolean {
  const entitlements = getEntitlements(household.plan);
  const featureMap: Record<PremiumFeature, boolean> = {
    custom_weights: entitlements.canCustomizeWeights,
    advanced_history: entitlements.canViewAdvancedHistory,
    export_pdf: entitlements.canExportPdf,
    multiple_households: entitlements.canUseMultipleHouseholds,
  };
  return featureMap[feature];
}

export function getEffectiveWeight(plan: PlanScenario, configuredWeight: number): number {
  return getEntitlements(plan).useWeights ? configuredWeight : 1;
}

export function getPlanLabel(plan: PlanScenario): string {
  const labels: Record<PlanScenario, string> = {
    trial: 'Essai complet',
    free: 'Gratuit',
    standard: 'Standard',
    pro: 'Pro',
  };
  return labels[plan];
}
