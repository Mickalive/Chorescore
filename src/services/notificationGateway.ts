/**
 * DRC-05 : gateway de notifications locales.
 *
 * Ce module prépare l'interface pour des notifications locales réelles via
 * expo-notifications lorsque la dépendance sera ajoutée. En l'absence de
 * expo-notifications (démo), il fonctionne en mode désactivé-honnête :
 * l'utilisateur est informé que la fonctionnalité n'est pas encore
 * disponible sur cet appareil.
 *
 * Aucune simulation de push distant réel.
 * Aucun faux service cloud.
 */

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export type NotificationGatewayStatus = {
  readonly supported: boolean;
  readonly permission: NotificationPermission;
  readonly message: string | null;
};

/**
 * Statut du gateway en mode démo (sans expo-notifications).
 * Le support est honnêtement signalé comme non disponible.
 */
export function getNotificationGatewayStatus(): NotificationGatewayStatus {
  return {
    supported: false,
    permission: 'undetermined',
    message:
      'Les notifications locales seront disponibles dans une prochaine mise à jour.',
  };
}

/**
 * Demande la permission de notification.
 * En mode démo, retourne 'denied' sans interaction utilisateur.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return 'denied';
}

/**
 * Programme une notification locale simple.
 * En mode démo, retourne false (non supporté).
 */
export async function scheduleLocalNotification(opts: {
  title: string;
  body: string;
  seconds: number;
}): Promise<boolean> {
  void opts;
  return false;
}

/**
 * Annule toutes les notifications programmées.
 * En mode démo, opération neutre.
 */
export async function cancelAllNotifications(): Promise<void> {
  // No-op en mode démo.
}

/**
 * Statut du gateway calendrier.
 * Calendrier réel réservé à une intégration future avec
 * expo-calendar lorsque la dépendance sera ajoutée.
 */
export type CalendarGatewayStatus = {
  readonly supported: boolean;
  readonly permission: NotificationPermission;
  readonly message: string | null;
};

export function getCalendarGatewayStatus(): CalendarGatewayStatus {
  return {
    supported: false,
    permission: 'undetermined',
    message:
      'L\'intégration calendrier sera disponible dans une prochaine mise à jour.',
  };
}
