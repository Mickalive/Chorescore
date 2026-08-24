/**
 * Décision d'ordre pour les événements d'abonnement Stripe, en logique pure.
 *
 * Invariant constitutionnel (MAIN_PROMPT.md §7) : aucun événement ancien ne
 * peut écraser un état d'abonnement plus récent. La déduplication par
 * identifiant protège du rejeu exact ; la comparaison des horodatages
 * `created` (secondes entières côté Stripe) protège des livraisons
 * désordonnées ou tardives.
 *
 * Ce module ne dépend ni de Firestore ni d'Admin SDK afin de rester testable
 * hors émulateur et sans effet de bord.
 */

export interface IncomingSubscriptionEvent {
  /** Identifiant d'événement Stripe (`evt_...`). */
  readonly eventId: string;
  /** Horodatage Stripe `created`, en secondes entières. */
  readonly eventCreatedSeconds: number;
}

/** Marqueur du dernier état appliqué, tel que stocké dans Firestore. */
export interface AppliedSubscriptionMarker {
  readonly lastStripeEventId: unknown;
  readonly lastStripeEventCreated: unknown;
}

export type SubscriptionEventDecision =
  | { readonly outcome: "apply" }
  | { readonly outcome: "duplicate" }
  | {
      readonly outcome: "reject";
      readonly reason: "stale_event" | "invalid_event_envelope";
    };

const MAX_EVENT_ID_LENGTH = 256;

export function decideSubscriptionEventOrder(
  incoming: IncomingSubscriptionEvent,
  applied: AppliedSubscriptionMarker,
): SubscriptionEventDecision {
  const eventId = incoming.eventId;
  const created = incoming.eventCreatedSeconds;

  if (
    typeof eventId !== "string" ||
    eventId.length === 0 ||
    eventId.length > MAX_EVENT_ID_LENGTH ||
    !Number.isSafeInteger(created) ||
    created < 0
  ) {
    // Échec fermé : un événement que l'on ne sait pas ordonner n'est jamais
    // appliqué sur l'état d'abonnement.
    return { outcome: "reject", reason: "invalid_event_envelope" };
  }

  if (applied.lastStripeEventId === eventId) {
    return { outcome: "duplicate" };
  }

  const marker = applied.lastStripeEventCreated;
  if (typeof marker === "number" && Number.isFinite(marker) && created < marker) {
    return { outcome: "reject", reason: "stale_event" };
  }

  return { outcome: "apply" };
}

/** Champs de facturation stockés, tels que lus dans la transaction (non fiables). */
export interface StoredBillingFields {
  readonly stripeSubscriptionId: unknown;
  readonly lastStripeEventCreated: unknown;
  readonly paidTier: unknown;
  readonly stripeCurrentPeriodEnd: unknown;
  readonly stripeStatus: unknown;
}

/**
 * Échec fermé : un champ d'ordre présent mais illisible désactiverait les
 * gardes ; l'état doit alors être rejeté (`billing_state_unparseable`) plutôt
 * qu'appliqué sans protection. Le test d'horodatage Firestore est injecté afin
 * de garder ce module indépendant du SDK et testable hors émulateur.
 */
export function storedBillingStateIsUnreadable(
  fields: StoredBillingFields,
  isFirestoreTimestamp: (value: unknown) => boolean,
): boolean {
  return (
    (fields.stripeSubscriptionId !== undefined &&
      fields.stripeSubscriptionId !== null &&
      typeof fields.stripeSubscriptionId !== "string") ||
    (fields.lastStripeEventCreated !== undefined &&
      fields.lastStripeEventCreated !== null &&
      (typeof fields.lastStripeEventCreated !== "number" ||
        !Number.isFinite(fields.lastStripeEventCreated))) ||
    (fields.paidTier !== undefined &&
      fields.paidTier !== null &&
      fields.paidTier !== "standard" &&
      fields.paidTier !== "pro") ||
    (fields.stripeCurrentPeriodEnd !== undefined &&
      fields.stripeCurrentPeriodEnd !== null &&
      !isFirestoreTimestamp(fields.stripeCurrentPeriodEnd)) ||
    (fields.stripeStatus !== undefined &&
      fields.stripeStatus !== null &&
      typeof fields.stripeStatus !== "string")
  );
}
