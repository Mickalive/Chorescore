export function buildContributionMessage(contribution: number, hasEntries: boolean): string {
  if (!hasEntries) {
    return 'Aucune tâche n’a encore été enregistrée pour cette période.';
  }

  const rounded = Math.round(contribution);
  if (rounded >= 60) {
    return `Ton activité enregistrée représente ${rounded} % du score du foyer. Pense aussi à garder du temps pour toi.`;
  }
  if (rounded >= 40) {
    return `Ton activité enregistrée représente ${rounded} % du score du foyer cette semaine.`;
  }
  return `Ton activité enregistrée représente ${rounded} % du score du foyer. Ce résultat couvre uniquement les tâches saisies.`;
}
