# Runner backend/sécurité — directive active

Autorité : directeur ChoreScore, sous réserve de `MAIN_PROMPT.md`.

## État actuel

Les Functions restent un socle non déployé. Le cycle ponctuel
`32672898477-1` a produit un candidat de règles Firebase, mais l'audit l'a classé
élevé et bloquant tant que l'émulateur ne les a pas réellement exécutées. Ce
candidat reste en quarantaine sur sa branche et ne fait pas partie de la base
cumulative. Aucun projet Firebase, secret ou paiement réel n'est fourni.

## Mission prioritaire

1. Ne pas recréer ni importer les règles Firebase non prouvées dans un cycle qui
   ne dispose pas de l'émulateur.
2. Tester en logique pure Auth, App Check, appartenance, rôle, validation de taille,
   idempotence et concurrence lorsque le code correspondant existe.
3. Pour Stripe, rester en logique pure ou mode test : signature, rejeu,
   ancienneté et événements désordonnés ; un événement ancien ne remplace jamais
   un état récent.
4. Documenter rétention, suppression et export si une tranche de code sûre ne
   peut pas être prouvée sans nouvel outillage.

Choisir une seule priorité achevable avec les dépendances déjà verrouillées. Si
les émulateurs ou données nécessaires manquent, produire une tranche plus petite
mais réellement testée plutôt que simuler une preuve.

## Preuves attendues

- tests négatifs ciblés ;
- `npm --prefix functions run check` ;
- séparation claire entre contrôles exécutés et contrôles encore bloqués.
