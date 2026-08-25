# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-04  
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`  
Sélecteur machine : `directives/TASKS.json`

## Résultat attendu

Les fonctions premium deviennent réellement utilisables en démo locale, sans
simuler un achat ni un succès. Filtres et synthèses semaine/mois, foyers locaux
multiples et export local produisent un vrai résultat calculé depuis les
données du foyer actif, dans le prolongement de la persistance versionnée
(DRC-02) et du contrôle des données (DRC-03).

## Travail borné

1. Filtres et synthèses semaine/mois sur l'historique : calculs réels depuis
   les entrées du foyer actif, méthode de calcul visible, bornes de période
   déterministes (frontières semaine/mois/année traitées par tests).
2. Foyers locaux multiples : création et bascule réelles ; tâches, classement,
   historique et entrées isolés par foyer dans le document persisté versionné ;
   le validateur de persistance couvre tout nouveau champ ou collection.
3. Export local : contenu réellement consultable (partage système ou fichier
   local), sans réseau, sans compte, sans prétention de synchronisation ; la
   suppression/locale reste maître des données.
4. Pondération personnalisée démo : opérationnelle localement, figée par
   `weightSnapshot` à la validation, sans réécriture des scores historiques ;
   en gratuit, poids effectif `1` inchangé.
5. Paywall honnête : contextuel, calme, jamais sur une fonction annoncée
   gratuite, jamais de simulation d'achat ou de succès.
6. États vides, erreurs, confirmations et annonces accessibles pour chaque
   nouvelle surface, grandes tailles de texte et petits écrans inclus.

## Hors périmètre

Pas de Firebase, Auth, Stripe, analytics, réseau, nouvelle dépendance,
modification de workflow ou refonte visuelle. Ne pas traiter DRC-05 : les
constats MOB-C4-F1/F2 (obligatoires avant livraison) et MOB-C4-F3,
MOB-CYCLE32857952394-F4, MOB-C5-N1, MOB-CYCLE32864465631-F1 restent programmés
sous DRC-05.

## Preuves attendues

`npm run check` vert avec les tests nouveaux (succès, refus, états vides,
bornes de période, isolation entre deux foyers), export Android démo réussi,
absence de toute requête réseau, liste exacte des limites résiduelles.
