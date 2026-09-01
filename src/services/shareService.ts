import { Share, Platform } from 'react-native';

/**
 * DRC-05 : partage système natif via le share sheet du téléphone.
 * Aucun SDK social spécifique ; le contenu est transmis tel quel à
 * l'API Share de React Native qui délègue à l'OS.
 *
 * Le contenu partagé est informatif, jamais jugemental ni moralisateur.
 */

// Re-export des fonctions pures (sans dépendance React Native)
export {
  formatDurationHuman,
  buildScoreShareText,
  buildEntryShareText,
  buildTodoShareText,
} from './shareContent';

export type ShareResult = {
  readonly action: 'shared' | 'dismissed';
};

/**
 * Partage un texte via le share sheet système.
 * Retourne 'shared' si l'utilisateur a partagé, 'dismissed' sinon.
 */
export async function shareText(message: string): Promise<ShareResult> {
  try {
    const result = await Share.share(
      { message },
      { dialogTitle: Platform.OS === 'ios' ? undefined : 'Partager via' },
    );
    return { action: result.action === Share.sharedAction ? 'shared' : 'dismissed' };
  } catch {
    return { action: 'dismissed' };
  }
}
