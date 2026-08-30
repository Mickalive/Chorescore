# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-01
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Source de vérité

Lire d'abord `MAIN_PROMPT.md`, `governance/RELEASE_DEFINITION.json` et `docs/product-decisions.md` depuis `main`.

## Finding prioritaire

**PRODUCT-RESET-CORE** (critical, DRC-01) : Remplacer le modèle et le
parcours todo/listes de TaskDefinition par un registre Tricount-like :
créer/choisir un foyer puis enregistrer directement une entrée libre
nom + personne + durée réelle, manuelle ou chrono.

Ce finding est la première tâche bornée de ce cycle. Le candidat doit
le résoudre avant toute autre implémentation.

## Niveau global : foyers

Écran racine = foyers accessibles + création selon **quota numérique de plan** (`householdLimit` ou équivalent) + accès Options. Ne jamais hardcoder `gratuit=1 / premium=plusieurs`.

Tous les utilisateurs ont Options ; les options d'administration du foyer/quota/permissions sont réservées au payeur/propriétaire selon le plan, sans créer d'onglet foyer supplémentaire.

## Dans un foyer : exactement 3 onglets

1. **Ajouter une tâche**
2. **Score**
3. **To-do**

## DRC-01 — Ajouter une tâche + historique complet

Une `CompletedEntry` doit porter :
- libellé ;
- `performedByMemberId` ;
- `beneficiaryMemberIds[]` non vide ;
- durée réelle ;
- date/heure ;
- foyer ;
- `persistentTaskId` facultatif ;
- pondération facultative.

### Fait par

Par défaut utilisateur connecté, mais l'utilisateur doit pouvoir sélectionner **n'importe quel membre du foyer** comme personne ayant réellement effectué la tâche. Cela ne change jamais l'identité connectée/createdBy.

### Fait pour

Permettre `Tout le monde` ou n'importe quel sous-ensemble de 1..N membres. La sélection doit être simple et rapide.

### Durée

Exactement deux modes : durée manuelle ou chrono. Le chrono crée une CompletedEntry avec les mêmes champs métier.

### Historique

Sous le formulaire : **historique chronologique complet du foyer**. Chaque entrée affiche au minimum libellé, durée, fait par, fait pour, date et reste modifiable/supprimable selon le modèle collaboratif.

## PersistentTask

Une PersistentTask est facultative. **Une PersistentTask = exactement un filtre Score.**

Elle sert de raccourci/catégorie stable et éventuellement de pondération par défaut. Les libellés ponctuels ne deviennent pas des filtres et relèvent de `Autres` dans Score.

## Préparer Score sans l'implémenter de travers

Le modèle doit permettre le settlement Tricount-like : pour une entrée de durée D faite par P pour N bénéficiaires, P reçoit +D et chaque bénéficiaire -D/N. Cette logique devra fonctionner en réel et pondéré.

Score aura les périodes semaine/mois/année/depuis le début, filtres Toutes/PersistentTask/Autres, balances/compensations, graphes avec noms directement visibles et **sans dépendance à une couleur identitaire fixe par membre**, puis historique filtré par période + filtre.

L'historique complet reste sous Ajouter une tâche ; l'historique de Score est contextuel/filtré.

## Préparer To-do

TodoItem peut être datée ou non, assignée, avoir bénéficiaires, deadline/reminder et PersistentTask facultative. Lors du check terminé, le flux final demandera fait-par + durée + fait-pour puis créera une CompletedEntry.

## Partage

Prévoir le partage natif contextuel sans bloquer DRC-01 : modèle/UI doivent permettre à terme de partager une entrée, une portion d'historique, un Score/graphique filtré ou une To-do. Ne pas enfermer les données dans des composants impossibles à rendre en share card.

## UX

KISS, feel-good, fonds teintés, peu de blanc, noms/valeurs lisibles, aucune interprétation morale automatique.

## Preuves DRC-01 attendues

- écran foyers avec quota de plan non hardcodé ;
- hiérarchie foyer -> Ajouter une tâche | Score | To-do ;
- CompletedEntry manuelle et chrono ;
- Fait par = n'importe quel membre du foyer ;
- Fait pour = tout le monde ou sous-ensemble non vide ;
- deux réalisations identiques restent distinctes ;
- PersistentTask facultative et 1:1 avec futur filtre Score ;
- libellé ponctuel valide et classable sous Autres ;
- historique complet sous Ajouter ;
- modèle compatible avec settlement fait-par/fait-pour ;
- durée réelle intacte avec pondération ;
- migration/persistance/isolation sans perte silencieuse.
