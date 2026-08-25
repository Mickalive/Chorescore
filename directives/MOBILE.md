# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-03  
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`  
Sélecteur machine : `directives/TASKS.json`

## Résultat attendu

Le contrôle des données de la démo devient réel. Modifier ou archiver une
tâche, corriger ou supprimer une entrée terminée et annuler un chronomètre
actif produisent un effet vrai, confirmé à l'écran, cohérent avec le score
canonique `(durée en secondes / 60) × poidsFigé` et avec la persistance
versionnée livrée au DRC-02. Chaque opération est couverte par des invariants
testés.

## Travail borné

1. Modification d'une tâche : changer nom, catégorie et poids courant ne
   réécrit ni les scores historiques ni les `weightSnapshot` figés des entrées
   passées.
2. Archivage réel d'une tâche : elle n'est plus proposée aux nouveaux
   chronomètres mais reste visible dans l'historique déjà enregistré, sans
   libellé cassé.
3. Correction d'une entrée terminée : durée modifiable, score recalculé
   uniquement depuis le `weightSnapshot` figé, résultat affiché avant
   confirmation.
4. Suppression d'une entrée confirmée : aucune orpheline dans le classement,
   l'historique ou le document persisté ; états vides traités.
5. Annulation d'un chronomètre actif : retour propre à l'état précédent,
   aucune entrée fantôme, comportement cohérent avec `applyRestartRules`
   (reprise/expiration) à la relance suivante.
6. Renforcement du validateur de persistance (invariants DRC-03) : refuser un
   document dont une entrée référence une tâche ou un utilisateur inexistant
   ou dont un identifiant est dupliqué, avec tests dédiés — répond aux constats
   reportés MOB-CYCLE32857952394-F1/F2.
7. Tests ciblés succès, refus, états vides et confirmations pour chaque
   opération, y compris la persistance après chaque mutation de contrôle.

## Hors périmètre

Pas de Firebase, Auth, Stripe, export, multi-foyer UI, nouvelle dépendance,
modification de workflow ou refonte visuelle. Ne pas traiter DRC-04 ni DRC-05 :
les constats hérités MOB-C4-F1/F2/F3 et MOB-CYCLE32857952394-F4 / MOB-C5-N1
restent programmés sous DRC-05 et ne sont pas du ressort de cette tranche.

## Preuves attendues

`npm run check` vert avec les tests nouveaux, export Android démo réussi,
absence de toute requête réseau, confirmations accessibles (rôle annoncé),
liste exacte des limites résiduelles.
