# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-02  
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`  
Sélecteur machine : `directives/TASKS.json`

## Résultat attendu

Remplacer l'état volatile de la démo par une persistance AsyncStorage réellement
utilisée, versionnée et testable. Les données synthétiques initiales ne servent
qu'au premier lancement. Les relances suivantes retrouvent les foyers, tâches,
entrées, préférences et plan local.

## Travail borné

1. Introduire une frontière de stockage asynchrone injectée et un format
   sérialisé avec `schemaVersion`.
2. Hydrater l'état avant d'afficher les données métier ; prévoir un état de
   chargement accessible et calme.
3. Persister les mutations sans écrire de donnée réelle ni effectuer de réseau.
4. Migrer au moins la version initiale et refuser/récupérer proprement une valeur
   corrompue, avec comportement documenté.
5. Sauvegarder l'instant de départ d'un chronomètre actif et recalculer sa durée
   à la reprise à partir d'une horloge injectée ; ne jamais faire confiance à un
   compteur incrémental sérialisé.
6. Ajouter des tests ciblés premier lancement, relance, migration, corruption,
   concurrence raisonnable des écritures et reprise/annulation du chronomètre.

## Hors périmètre

Pas de Firebase, Auth, Stripe, export, multi-foyer UI, nouvelle dépendance,
modification de workflow ou refonte visuelle générale. Ne traiter aucun autre
critère tant que DRC-02 n'est pas démontré.

## Preuves attendues

`npm run check`, export Android démo, absence de requête réseau, tests nouveaux
sans skip et liste exacte des limites résiduelles.
