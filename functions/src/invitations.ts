/**
 * Décisions d'autorisation du domaine des invitations, en logique pure.
 *
 * Invariants constitutionnels (MAIN_PROMPT.md §7 et §9) :
 * - le client est non fiable : l'identité, l'attestation App Check, l'email
 *   vérifié, l'adhésion au foyer ciblé et le rôle viennent des adhésions
 *   stockées, jamais d'une valeur fournie par le client ;
 * - le jeton d'invitation est à forte entropie, borné en taille, jamais
 *   stocké en clair : seul son condensat SHA-256 désigne le document ;
 * - l'expiration est décidée par le temps serveur ;
 * - le rôle attribué à l'arrivée est toujours « member », jamais un rôle
 *   administratif ;
 * - une double acceptation rejoue le résultat initial sans nouvelle écriture ;
 * - toute donnée stockée arrive comme `unknown` : un champ présent mais
 *   illisible conduit à un refus ou à un échec fermé, jamais à une coercion
 *   implicite.
 *
 * Ce module ne dépend ni de Firestore ni d'Admin SDK afin de rester testable
 * hors émulateur et sans effet de bord ; il ne jette jamais, il décide.
 * Les gardes Stripe intégrées ne sont pas touchées.
 */

import { sha256 } from "./domain";

/** Matière binaire du jeton : 32 octets ⇒ 256 bits d'entropie réelle. */
export const INVITE_TOKEN_BYTES = 32;

/** Longueur canonique du jeton : encodage base64url de 32 octets. */
export const INVITE_TOKEN_LENGTH = 43;

/** Plancher de conception ; l'entropie réelle produite est de 256 bits. */
export const MIN_INVITE_TOKEN_ENTROPY_BITS = 128;

/** Bornes de la durée de vie d'une invitation, en heures. */
export const MIN_INVITE_EXPIRY_HOURS = 1;
export const MAX_INVITE_EXPIRY_HOURS = 72;

/** Bornes de la composition d'un foyer lue depuis le document stocké. */
export const MIN_HOUSEHOLD_MEMBER_COUNT = 1;
export const MAX_HOUSEHOLD_MEMBER_COUNT = 100;

export type InviteRole = "owner" | "admin" | "member";

/** Rôles autorisés à créer une invitation, alignés sur le câblage existant. */
export const INVITE_CREATION_ROLES: readonly InviteRole[] = ["owner", "admin"];

/** Rôle attribué à l'arrivée : jamais un rôle administratif. */
export const INVITE_ASSIGNED_ROLE: InviteRole = "member";

export function inviteTokenEntropyBits(): number {
  return INVITE_TOKEN_BYTES * 8;
}

/**
 * Forme canonique d'un jeton brut : exactement 43 caractères base64url.
 * Toute autre forme est une entrée cliente invalide, jamais un secret à
 * comparer.
 */
export function isValidInviteTokenShape(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === INVITE_TOKEN_LENGTH &&
    /^[A-Za-z0-9_-]+$/u.test(value)
  );
}

/**
 * Seul le condensat est stocké et utilisé comme identifiant de document ;
 * le jeton brut ne transite jamais en base.
 */
export function inviteDigest(rawToken: string): string {
  return sha256(rawToken);
}

const HOUSEHOLD_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;
const DUNDER_ID_PATTERN = /^__.*__$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/u;

/**
 * Miroir non lançant de `validation.firestoreId` pour un identifiant de foyer
 * lu depuis un document stocké : même normalisation, mêmes bornes, même
 * motif. Une valeur stockée qui viole ces règles trahit une corruption.
 */
export function isValidStoredHouseholdId(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.normalize("NFC").trim();
  if (normalized.length < 1 || normalized.length > 128) {
    return false;
  }
  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    return false;
  }
  return HOUSEHOLD_ID_PATTERN.test(normalized) && !DUNDER_ID_PATTERN.test(normalized);
}

/** Identité déjà filtrée par `requireCaller`, re-vérifiée ici en défense profonde. */
export interface InviteCaller {
  readonly authenticated: boolean;
  readonly appCheckAttested: boolean;
  readonly emailVerified: boolean;
  readonly uid: unknown;
}

/** Document `households/{id}/members/{uid}`, tel que lu dans la transaction. */
export interface InviteMembership {
  readonly exists: boolean;
  readonly status: unknown;
  readonly role: unknown;
}

/** Document `households/{id}`, tel que lu dans la transaction. */
export interface InviteHousehold {
  readonly exists: boolean;
  /** Valeur brute stockée de `memberCount`, revalidée par la décision. */
  readonly memberCount: unknown;
}

/**
 * Capacité d'accueil du foyer, calculée par le câblage à partir de la
 * composition stockée et de l'état de facturation. Les indécisions deviennent
 * des données afin que la décision préserve l'ordre observable des refus :
 * elle ne consulte la capacité qu'après les portes d'autorisation et, à
 * l'acceptation, après les portes de validité de l'invitation.
 */
export type InviteCapacity =
  | {
      readonly status: "available";
      readonly memberLimit: number;
      readonly standardMemberLimitExceeded: boolean;
    }
  | { readonly status: "invalid_household_state" }
  | { readonly status: "billing_unavailable" };

/** Document `invites/{condensat}`, tel que lu dans la transaction. */
export interface InviteRecord {
  readonly exists: boolean;
  /** Valeur brute stockée de `householdId` : la cible vient du serveur. */
  readonly householdId: unknown;
  readonly status: unknown;
  readonly useCount: unknown;
  readonly redeemedBy: unknown;
  /** `expiresAt.toMillis()` si Timestamp lisible, sinon toute autre valeur. */
  readonly expiresAtMs: unknown;
  readonly revokedAt: unknown;
}

export type InviteRejectionCode =
  | "unauthenticated"
  | "failed-precondition"
  | "permission-denied"
  | "not-found"
  | "invalid-argument";

export type InviteFailClosedReason =
  | "invalid_request_envelope"
  | "invalid_household_state"
  | "invalid_invite_record"
  | "billing_unavailable";

export type InviteRejectionDecision =
  | {
      readonly outcome: "reject";
      readonly code: InviteRejectionCode;
      readonly message: string;
    }
  | {
      readonly outcome: "fail_closed";
      readonly reason: InviteFailClosedReason;
    };

export type InviteCreationDecision =
  | InviteRejectionDecision
  | { readonly outcome: "accept"; readonly expiresAtMs: number };

/**
 * Première phase de l'acceptation : toutes les portes qui ne dépendent pas de
 * la capacité du foyer. La capacité n'est chargée par le câblage que si cette
 * phase retourne « evaluate_capacity », préservant l'ordre historique des
 * lectures et des refus.
 */
export type InviteRedemptionPreDecision =
  | InviteRejectionDecision
  | {
      readonly outcome: "replay";
      readonly householdId: string;
      readonly alreadyMember: true;
    }
  | { readonly outcome: "evaluate_capacity"; readonly householdId: string };

/** Seconde phase de l'acceptation : capacité puis rattachement. */
export type InviteRedemptionDecision =
  | InviteRejectionDecision
  | {
      readonly outcome: "accept";
      readonly householdId: string;
      readonly assignedRole: InviteRole;
    };

const MESSAGE_UNAUTHENTICATED = "Authentification requise.";
const MESSAGE_APP_CHECK = "Attestation App Check requise.";
const MESSAGE_EMAIL_VERIFIED = "Une adresse email vérifiée est requise.";
const MESSAGE_HOUSEHOLD_ACCESS = "Accès au foyer refusé.";
const MESSAGE_INSUFFICIENT_ROLE = "Autorisation insuffisante.";
const MESSAGE_HOUSEHOLD_NOT_FOUND = "Foyer introuvable.";
const MESSAGE_CREATE_CAPACITY =
  "Ce foyer doit utiliser le plan Pro avant d'inviter un membre supplémentaire.";
const MESSAGE_REDEEM_CAPACITY =
  "Ce foyer doit utiliser le plan Pro avant d'ajouter un membre.";
const MESSAGE_INVITE_UNAVAILABLE = "Cette invitation est invalide ou indisponible.";
const MESSAGE_TOKEN_INVALID = "token est invalide.";
const MESSAGE_EXPIRY_INVALID = "expiresInHours doit être un entier entre 1 et 72.";

function reject(
  code: InviteRejectionCode,
  message: string,
): InviteRejectionDecision {
  return { outcome: "reject", code, message };
}

function isReadableRole(value: unknown): value is InviteRole {
  return value === "owner" || value === "admin" || value === "member";
}

function identityRejection(caller: InviteCaller): InviteRejectionDecision | null {
  if (!caller.authenticated) {
    return reject("unauthenticated", MESSAGE_UNAUTHENTICATED);
  }
  if (!caller.appCheckAttested) {
    return reject("failed-precondition", MESSAGE_APP_CHECK);
  }
  if (caller.emailVerified !== true) {
    return reject("failed-precondition", MESSAGE_EMAIL_VERIFIED);
  }
  if (typeof caller.uid !== "string" || caller.uid.length === 0) {
    return reject("unauthenticated", MESSAGE_UNAUTHENTICATED);
  }
  return null;
}

type EffectiveCapacity =
  | {
      readonly ok: true;
      readonly memberCount: number;
      readonly memberLimit: number;
      readonly standardMemberLimitExceeded: boolean;
    }
  | { readonly ok: false; readonly reason: InviteFailClosedReason };

/**
 * Revalide la capacité au moment où la décision en a besoin : une
 * composition stockée illisible ou une facturation indisponible échouent
 * fermé au lieu d'être coercées en une limite généreuse.
 */
function effectiveCapacity(
  capacity: InviteCapacity,
  rawMemberCount: unknown,
): EffectiveCapacity {
  if (capacity.status === "invalid_household_state") {
    return { ok: false, reason: "invalid_household_state" };
  }
  if (capacity.status === "billing_unavailable") {
    return { ok: false, reason: "billing_unavailable" };
  }
  if (
    typeof rawMemberCount !== "number" ||
    !Number.isInteger(rawMemberCount) ||
    rawMemberCount < MIN_HOUSEHOLD_MEMBER_COUNT ||
    rawMemberCount > MAX_HOUSEHOLD_MEMBER_COUNT
  ) {
    return { ok: false, reason: "invalid_household_state" };
  }
  return {
    ok: true,
    memberCount: rawMemberCount,
    memberLimit: capacity.memberLimit,
    standardMemberLimitExceeded: capacity.standardMemberLimitExceeded,
  };
}

export interface InviteCreationInput {
  readonly caller: InviteCaller;
  readonly membership: InviteMembership;
  readonly household: InviteHousehold;
  readonly capacity: InviteCapacity;
  /** Identifiant de foyer visé par la requête validée (jamais du client brut). */
  readonly expectedHouseholdId: string;
  /** Valeur déjà validée par le câblage, revalidée ici en défense profonde. */
  readonly expiresInHours: unknown;
  /** Temps serveur en millisecondes ; jamais une valeur fournie par le client. */
  readonly nowMs: number;
}

/**
 * Décide si `createInvite` peut aboutir, et à quelle expiration. L'ordre des
 * contrôles préserve la sémantique d'erreur existante : identité, adhésion,
 * rôle administratif, existence du foyer, capacité du plan, borne d'expiration.
 */
export function decideInviteCreation(
  input: InviteCreationInput,
): InviteCreationDecision {
  const { caller, membership, household } = input;

  // Enveloppe de la requête serveur elle-même (défensive, jamais du client).
  if (
    !Number.isSafeInteger(input.nowMs) ||
    typeof input.expectedHouseholdId !== "string" ||
    input.expectedHouseholdId.length === 0
  ) {
    return { outcome: "fail_closed", reason: "invalid_request_envelope" };
  }

  // 1. Identité : Auth, App Check, email vérifié, uid exploitable.
  const identity = identityRejection(caller);
  if (identity !== null) {
    return identity;
  }

  // 2. Adhésion au foyer ciblé : statut actif et rôle connu puis administratif.
  //    L'autorisation vient de l'adhésion stockée dans CE foyer, jamais d'un
  //    rôle détenu dans un autre foyer ni d'une valeur cliente.
  if (
    !membership.exists ||
    membership.status !== "active" ||
    !isReadableRole(membership.role)
  ) {
    return reject("permission-denied", MESSAGE_HOUSEHOLD_ACCESS);
  }
  if (!INVITE_CREATION_ROLES.includes(membership.role)) {
    return reject("permission-denied", MESSAGE_INSUFFICIENT_ROLE);
  }

  // 3. Le foyer ciblé doit exister.
  if (!household.exists) {
    return reject("not-found", MESSAGE_HOUSEHOLD_NOT_FOUND);
  }

  // 4. Capacité du plan : composition illisible ou facturation indisponible
  //    échouent fermé ; sinon la place restante décide.
  const capacity = effectiveCapacity(input.capacity, household.memberCount);
  if (!capacity.ok) {
    return { outcome: "fail_closed", reason: capacity.reason };
  }
  if (
    capacity.standardMemberLimitExceeded ||
    capacity.memberCount >= capacity.memberLimit
  ) {
    return reject("failed-precondition", MESSAGE_CREATE_CAPACITY);
  }

  // 5. Expiration : borne défensive 1–72 h, calculée depuis le temps serveur.
  const hours = input.expiresInHours;
  if (
    typeof hours !== "number" ||
    !Number.isInteger(hours) ||
    hours < MIN_INVITE_EXPIRY_HOURS ||
    hours > MAX_INVITE_EXPIRY_HOURS
  ) {
    return reject("invalid-argument", MESSAGE_EXPIRY_INVALID);
  }
  const expiresAtMs = input.nowMs + hours * 3_600_000;
  if (!Number.isSafeInteger(expiresAtMs)) {
    return { outcome: "fail_closed", reason: "invalid_request_envelope" };
  }

  return { outcome: "accept", expiresAtMs };
}

export interface InviteRedemptionInput {
  readonly caller: InviteCaller;
  readonly invite: InviteRecord;
  /** Existence du foyer désigné par l'invitation stockée. */
  readonly householdExists: boolean;
  /**
   * Statut stocké du document `members/{uid}` dans le foyer DÉSIGNÉ PAR
   * L'INVITATION — jamais dans un autre foyer ni une valeur cliente.
   */
  readonly membershipStatus: unknown;
  /** Jeton brut déjà validé par le câblage, revalidé ici en défense profonde. */
  readonly rawToken: unknown;
  /** Temps serveur en millisecondes ; jamais une valeur fournie par le client. */
  readonly nowMs: number;
}

/**
 * Première phase de `redeemInvite` : identité, forme du jeton, invitation
 * stockée, foyer désigné par le document, rejeu de double acceptation,
 * expiration serveur. Aucune donnée de capacité n'est nécessaire ici : le
 * câblage ne charge la facturation qu'après ces portes.
 */
export function decideInviteRedemption(
  input: InviteRedemptionInput,
): InviteRedemptionPreDecision {
  // Enveloppe de la requête serveur elle-même (défensive, jamais du client).
  if (!Number.isSafeInteger(input.nowMs)) {
    return { outcome: "fail_closed", reason: "invalid_request_envelope" };
  }

  // 1. Identité : Auth, App Check, email vérifié, uid exploitable.
  const identity = identityRejection(input.caller);
  if (identity !== null) {
    return identity;
  }

  // 2. Forme du jeton : le câblage a déjà renvoyé les messages fins du
  //    validateur d'entrée ; cette porte défensive protège un futur
  //    réordonnancement du code.
  if (!isValidInviteTokenShape(input.rawToken)) {
    return reject("invalid-argument", MESSAGE_TOKEN_INVALID);
  }

  // Message unique volontairement flou : aucune fuite d'information sur
  // l'existence, le statut ou la consommation d'une invitation.
  const unavailable = (): InviteRejectionDecision =>
    reject("permission-denied", MESSAGE_INVITE_UNAVAILABLE);

  // 3. L'invitation doit exister sous le condensat du jeton fourni.
  if (!input.invite.exists) {
    return unavailable();
  }

  // 4. La cible vient du document stocké, jamais du client : un identifiant
  //    absent rend l'invitation indisponible, un identifiant corrompu échoue
  //    fermé au lieu de désigner un chemin arbitraire.
  const storedHouseholdId = input.invite.householdId;
  if (typeof storedHouseholdId !== "string") {
    return unavailable();
  }
  if (!isValidStoredHouseholdId(storedHouseholdId)) {
    return { outcome: "fail_closed", reason: "invalid_invite_record" };
  }
  const householdId = storedHouseholdId.normalize("NFC").trim();

  // 5. Le foyer désigné doit exister.
  if (!input.householdExists) {
    return unavailable();
  }

  // 6. Double acceptation par le même membre : rejeu sans nouvelle écriture.
  //    La porte d'adhésion précède le rejeu : une personne exclue du foyer
  //    entre-temps ne retire aucun service d'une clé déjà consommée.
  const alreadyActiveMember = input.membershipStatus === "active";
  if (input.invite.redeemedBy === input.caller.uid && alreadyActiveMember) {
    return { outcome: "replay", householdId, alreadyMember: true };
  }

  // 7. Validité : statut actif, jamais consommée, non expirée selon le temps
  //    serveur, non révoquée. Tout champ illisible refuse au lieu d'être
  //    coercé en une valeur généreuse.
  if (
    input.invite.status !== "active" ||
    input.invite.useCount !== 0 ||
    typeof input.invite.expiresAtMs !== "number" ||
    !Number.isFinite(input.invite.expiresAtMs) ||
    input.invite.expiresAtMs <= input.nowMs ||
    input.invite.revokedAt !== null
  ) {
    return unavailable();
  }

  // Les portes suivantes exigent la capacité du foyer désigné : le câblage
  // la charge maintenant, puis appelle decideInviteRedemptionCapacity.
  return { outcome: "evaluate_capacity", householdId };
}

export interface InviteRedemptionCapacityInput {
  /** Identifiant validé par la première phase, jamais une valeur cliente. */
  readonly householdId: string;
  readonly capacity: InviteCapacity;
  /** Valeur brute stockée de `memberCount` du foyer désigné. */
  readonly householdMemberCount: unknown;
  /** Membre déjà actif dans le foyer désigné, issu des adhésions stockées. */
  readonly alreadyActiveMember: boolean;
}

/**
 * Seconde phase de `redeemInvite` : capacité du foyer désigné puis décision
 * de rattachement. Un arrivant nouveau obéit à la limite du plan ; un membre
 * déjà actif rattache son rachat sans doubler le compteur. Le rôle attribué
 * est toujours « member », quel que soit le contexte.
 */
export function decideInviteRedemptionCapacity(
  input: InviteRedemptionCapacityInput,
): InviteRedemptionDecision {
  // Défense profonde : l'identifiant a été validé par la première phase et
  // le statut de membre actif est un booléen calculé côté serveur.
  if (
    !isValidStoredHouseholdId(input.householdId) ||
    typeof input.alreadyActiveMember !== "boolean"
  ) {
    return { outcome: "fail_closed", reason: "invalid_request_envelope" };
  }

  const capacity = effectiveCapacity(input.capacity, input.householdMemberCount);
  if (!capacity.ok) {
    return { outcome: "fail_closed", reason: capacity.reason };
  }
  if (
    !input.alreadyActiveMember &&
    (capacity.standardMemberLimitExceeded ||
      capacity.memberCount >= capacity.memberLimit)
  ) {
    return reject("failed-precondition", MESSAGE_REDEEM_CAPACITY);
  }

  return {
    outcome: "accept",
    householdId: input.householdId.normalize("NFC").trim(),
    assignedRole: INVITE_ASSIGNED_ROLE,
  };
}

