import type { CompletedEntry, TaskEntry } from './types';

export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 1000;
export const MAX_DURATION_SECONDS = 24 * 60 * 60;

export function isValidWeight(weight: number): boolean {
  return Number.isInteger(weight) && weight >= MIN_WEIGHT && weight <= MAX_WEIGHT;
}

export function isValidDuration(durationSeconds: number): boolean {
  return (
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0 &&
    durationSeconds <= MAX_DURATION_SECONDS
  );
}

export function calculateScore(durationSeconds: number, weight: number): number {
  if (!isValidDuration(durationSeconds)) {
    throw new RangeError('La durée doit être comprise entre 1 seconde et 24 heures.');
  }

  if (!isValidWeight(weight)) {
    throw new RangeError('Le poids doit être un entier compris entre 1 et 1000.');
  }

  return (durationSeconds / 60) * weight;
}

export function getEntryValue(entry: TaskEntry, useWeights: boolean): number {
  return useWeights ? entry.score : entry.durationSeconds / 60;
}

export function formatMetric(value: number, useWeights: boolean): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('fr-CH')} ${useWeights ? 'pts' : 'min'}`;
}

/* ------------------------------------------------------------------ */
/* Tricount-like settlement (DRC-01)                                   */
/* ------------------------------------------------------------------ */

export type Compensation = {
  fromMemberId: string;
  toMemberId: string;
  seconds: number;
};

/**
 * Calcule les soldes en secondes pour chaque membre selon la logique Tricount :
 * pour une entrée de durée D faite par P pour N bénéficiaires, P reçoit +D et
 * chaque bénéficiaire reçoit -D/N. Si P fait partie des bénéficiaires, il
 * reçoit naturellement son crédit puis sa propre quote-part de charge.
 *
 * La somme de tous les soldes est (à arrondi près) zéro.
 */
export function calculateBalances(
  entries: CompletedEntry[],
  memberIds: readonly string[],
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const id of memberIds) {
    balances.set(id, 0);
  }

  for (const entry of entries) {
    const beneficiaryCount = entry.beneficiaryMemberIds.length;
    if (beneficiaryCount === 0) continue;

    // performedBy gets +D (pondéré si weight !== 1)
    const effectiveDuration = entry.durationSeconds * entry.weight;
    const currentPerformer = balances.get(entry.performedByMemberId) ?? 0;
    balances.set(entry.performedByMemberId, currentPerformer + effectiveDuration);

    // each beneficiary gets -D×weight / N
    const sharePerBeneficiary = effectiveDuration / beneficiaryCount;
    for (const beneficiaryId of entry.beneficiaryMemberIds) {
      const currentBeneficiary = balances.get(beneficiaryId) ?? 0;
      balances.set(beneficiaryId, currentBeneficiary - sharePerBeneficiary);
    }
  }

  return balances;
}

/**
 * Produit une liste de compensations pair-à-pair déterministe à partir des
 * soldes. L'algorithme glouton trie les débiteurs et créditeurs par montant
 * décroissant puis par identifiant pour garantir la stabilité.
 */
export function calculateCompensations(balances: Map<string, number>): Compensation[] {
  const compensations: Compensation[] = [];
  const debtors: { memberId: string; amount: number }[] = [];
  const creditors: { memberId: string; amount: number }[] = [];

  for (const [memberId, balance] of balances) {
    if (balance < -0.01) {
      debtors.push({ memberId, amount: -balance });
    } else if (balance > 0.01) {
      creditors.push({ memberId, amount: balance });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount || a.memberId.localeCompare(b.memberId));
  creditors.sort((a, b) => b.amount - a.amount || a.memberId.localeCompare(b.memberId));

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const transfer = Math.min(debtor.amount, creditor.amount);

    if (transfer > 0.01) {
      compensations.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        seconds: Math.round(transfer),
      });
    }

    debtor.amount -= transfer;
    creditor.amount -= transfer;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return compensations;
}
