import type { TaskDefinition } from './types';

/**
 * Sélection pure des tâches actives d'un foyer, dans l'ordre du store
 * (les ajouts récents d'abord). L'écran Tâches l'utilise pour décider
 * entre la liste et son état vide ; la logique reste testable hors UI.
 */
export function selectActiveTasks(tasks: readonly TaskDefinition[]): TaskDefinition[] {
  return tasks.filter((task) => task.active);
}
