# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-05  
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`  
Sélecteur machine : `directives/TASKS.json`

## Résultat attendu

L'état accepté du cycle 32919230502 (DRC-04 complet : filtres/synthèses,
multi-foyers locaux, export local, paywall honnête) gagne les preuves
déterministes de parcours et l'accessibilité exigées par DRC-05. Les trois
travaux ci-dessous forment une mission unique bornée ; aucun nouveau parcours
produit n'est créé.

## Travail borné

1. **MOB-C4-F1 (obligatoire)** — filtre membre de l'historique utilisable sur
   petit écran et grandes tailles de texte : repli, défilement ou sélection
   dédiée ; aucune sélection orpheline après bascule de foyer (comportement
   F3-R2 déjà intégré à préserver).
2. **MOB-C4-F2 (obligatoire)** — tests de frontière d'année et de borne haute
   `now` pour les filtres semaine/mois : les bornes annoncées restent
   exactement les bornes filtrées au passage d'année et en fin de période.
3. **Contraste textMuted global** — ajuster le jeton central du thème pour
   atteindre ≥ 4,5:1 sur chaque fond réellement employé (le cas ReportModal
   F6-R2 est déjà conforme via textSecondary) ; tracer la mesure WCAG de chaque
   paire conservée, ajouter un test déterministe des paires du thème, vérifier
   qu'aucune surface colorée existante ne régresse.

Améliorations facultatives acceptées dans la même mission si elles restent
bornées : MOB-C5-N1 (zéro écriture redondante après hydratation sans mutation),
MOB-CYCLE32857952394-F4 (garde temporelle sur la porte d'hydratation),
mémoisation du libellé de période. Ne pas introduire de harnais UI :
MOB-CYCLE32864465631-F1 reste reporté.

## Hors périmètre

Pas de Firebase, Auth, Stripe, analytics, réseau, nouvelle dépendance,
modification de workflow, refonte visuelle ni nouvelle fonctionnalité produit.
Ne pas traiter DRC-07 (documentation/PR côté shell et humain) ni DRC-06.
Les constats info du candidat de récupération non intégré 32915047376
(mémoisation `describePeriodBounds`, forme de `CreateHouseholdResult`) sont des
pistes à revérifier sur le code intégré, pas des défauts établis.

## Preuves attendues

`npm run check` vert (tests existants + nouveaux tests MOB-C4-F2 et paires de
contraste), export Android démo réussi hors ligne, mesure WCAG tracée pour
chaque paire retenue, liste exacte des contrôles manuels restants (à fournir
dans le rapport du codeur ; le directeur les consolide dans
`docs/NEXT_CYCLE.md`), limites résiduelles explicites.
