# ChoreScore V2 — architecture greenfield

## Décision fondamentale

ChoreScore V2 est un **rebuild greenfield**.

L'ancienne application et `lab/chorescore` sont des archives/réservoirs de briques. Aucun écran, modèle de domaine, composant, test ou service de l'ancienne app n'est repris automatiquement.

Une brique ancienne ne peut être réutilisée que si elle est :
1. isolée ;
2. compatible avec `MAIN_PROMPT.md` ;
3. plus simple à adapter qu'à réécrire ;
4. couverte par des tests adaptés au nouveau domaine ;
5. acceptée par l'auditeur V2.

L'état cumulatif de la V2 est `lab/chorescore-v2`.

## Architecture cible

Séparer strictement :

- `app/**` : routes/écrans Expo Router ;
- `src/domain/**` : règles métier pures ;
- `src/application/**` : cas d'usage ;
- `src/infrastructure/**` : persistance et adapters externes ;
- `src/ui/**` : composants visuels réutilisables ;
- `tests/**` : tests du domaine, cas d'usage et parcours critiques.

Le domaine ne dépend jamais directement de Firebase, Google, Facebook, Instagram, notifications, calendrier ou Expo.

## Objets métier centraux

- `UserAccount`
- `Household`
- `HouseholdMember`
- `HouseholdEntitlement` avec quota explicite de foyers
- `CompletedEntry`
  - `performedByMemberId`
  - `beneficiaryMemberIds[]`
  - durée réelle
  - `persistentTaskId?`
  - coefficient pondéré figé
- `PersistentTask`
- `TodoItem`

## Contrats externes à prévoir dès le socle

### AuthGateway

Interface indépendante du fournisseur.

Capacités production prévues :
- compte ChoreScore email/mot de passe ou lien sécurisé selon décision ultérieure ;
- Google ;
- Facebook ;
- déconnexion ;
- restauration de session ;
- suppression/export de compte.

Socle Expo recommandé :
- `expo-auth-session` / OAuth navigateur système lorsque pertinent ;
- `expo-web-browser` ;
- `expo-linking` pour callback/deep link ;
- `expo-secure-store` pour secrets/session locale ;
- adapter backend/auth distinct (Firebase Auth possible, sans coupler le domaine à Firebase).

Aucun client secret n'est commité.

### ShareGateway

**Pas d'intégration spécifique Instagram/Facebook/TikTok/etc.**

Le produit utilise le **share sheet natif du système** :
- `Share` de React Native pour texte/liens lorsque suffisant ;
- `expo-sharing` pour partager un fichier/image généré localement ;
- éventuellement `react-native-view-shot` pour transformer une share card visible en image.

Le système d'exploitation affiche automatiquement les apps compatibles installées.

Aucune dépendance SDK par réseau social.

### NotificationGateway

Prévoir :
- permissions ;
- notifications locales ;
- rappels To-do ;
- préférences par type d'événement ;
- adapter push distant futur.

Socle Expo : `expo-notifications`.

La RC peut implémenter uniquement les notifications locales ; elle ne simule jamais un push distant.

### CalendarGateway

Prévoir :
- permission calendrier ;
- création/modification/suppression d'événements liés aux To-do datées ;
- conservation de l'identifiant externe pour mise à jour/suppression ;
- synchronisation réversible.

Socle Expo : `expo-calendar`.

### PersistenceGateway

La V2 doit être local-first.

Préférence : `expo-sqlite` pour les données métier relationnelles et requêtables (foyers, membres, entrées, bénéficiaires, tâches persistantes, To-do), avec migrations versionnées.

`expo-secure-store` ne sert qu'aux secrets/session, jamais à la base métier complète.

### SyncGateway

Interface prévue dès le domaine/application mais adapter réseau désactivé dans la RC tant qu'un backend réel n'est pas configuré.

Le futur backend doit pouvoir synchroniser :
- comptes ;
- foyers/membres/permissions ;
- CompletedEntry ;
- PersistentTask ;
- TodoItem ;
- entitlements/abonnements.

La stratégie de résolution de conflits doit être explicite avant activation multi-device.

### BillingGateway

Prévoir une interface d'entitlement fournissant au minimum :
- identifiant du plan ;
- `householdLimit` ;
- fonctionnalités autorisées ;
- rôle payeur/propriétaire lorsque pertinent.

Les paliers/prix sont de la configuration produit, jamais des conditions dispersées dans les composants.

Aucun faux paiement dans la RC.

## Navigation

Niveau global : connexion -> liste des foyers -> options.

Dans un foyer : exactement :
- `Ajouter une tâche`
- `Score`
- `To-do`

## Score

Le moteur Score est une fonction pure testable séparément de l'UI.

Pour chaque CompletedEntry de durée `D` et bénéficiaires `B` :
- crédit `+D` au membre ayant réalisé ;
- charge `-D / |B|` à chaque bénéficiaire.

Même calcul pour la durée pondérée.

Le moteur produit :
- temps réalisé par membre ;
- soldes nets ;
- compensations pair-à-pair ;
- agrégats par période ;
- agrégats par PersistentTask ;
- `Autres` pour les entrées sans PersistentTask.

Une PersistentTask crée exactement un filtre Score.

## Partage

Chaque surface partageable construit un `SharePayload` minimal contenant uniquement ce que l'utilisateur a choisi :
- entrée ;
- historique sélectionné ;
- Score période/filtre ;
- compensation ;
- share card ;
- To-do/planning.

Le `SystemShareGateway` remet ce payload au share sheet natif.

## To-do -> CompletedEntry

La validation d'une TodoItem est un cas d'usage atomique :
1. demander `performedBy` + temps réel + bénéficiaires si nécessaires ;
2. créer la CompletedEntry ;
3. marquer la TodoItem terminée ;
4. persister les deux opérations de manière cohérente ;
5. Score et historique reflètent immédiatement la nouvelle entrée.

## Dépendances : règle de gouvernance

Les versions doivent être compatibles avec le SDK Expo verrouillé et installées via les mécanismes Expo appropriés (`npx expo install` quand applicable).

Le Builder V2 peut modifier `package.json`, lockfile et config native/Expo uniquement lorsque le critère actif le requiert. Toute nouvelle dépendance doit :
- avoir une raison produit explicite ;
- éviter de dupliquer une capacité fournie par React Native/Expo ;
- être auditée ;
- ne pas nécessiter de secret dans le dépôt ;
- être testable sans service externe pour la RC quand possible.

## Définition de greenfield

Le premier cycle V2 repart d'un squelette minimal et supprime les anciens `app/**`, `src/**`, `tests/**` et backend produit de l'état cumulatif V2.

Le control-plane, la constitution et les scripts d'usine restent sur `main`. L'ancien produit reste consultable dans Git/historique et `lab/chorescore` mais n'est pas copié comme base de la V2.
