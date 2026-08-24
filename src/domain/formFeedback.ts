/**
 * Décision pure d'annonce des erreurs de formulaire aux lecteurs d'écran.
 *
 * Une région live Android n'annonce qu'un *changement* de contenu : si
 * l'utilisateur soumet deux fois la même erreur (ex. nom vide deux fois de
 * suite), le texte identique ne serait pas re-annoncé. Le jeton `token`
 * augmente à chaque nouvelle erreur, même identique ; les composants l'utilisent
 * comme `key` de rendu pour remonter un nœud frais, et comme déclencheur de
 * l'annonce impérative sur iOS (où `accessibilityLiveRegion` est ignoré).
 *
 * La décision reste pure et testable hors UI : aucun lecteur d'écran n'est
 * simulé ici, seules les conditions de données de l'annonce le sont.
 */
export type ErrorAnnouncement = {
  /** Message affiché à l'écran et annoncé au lecteur d'écran. */
  message: string;
  /**
   * Jeton strictement croissant à chaque annonce. Change même pour un message
   * identique afin de forcer une nouvelle annonce.
   */
  token: number;
};

export function computeErrorAnnouncement(
  previous: ErrorAnnouncement | null,
  message: string | null,
): ErrorAnnouncement | null {
  // Aucune annonce inventée : un message absent ou vide réinitialise l'état.
  if (message === null || message.length === 0) {
    return null;
  }
  return { message, token: (previous?.token ?? 0) + 1 };
}
