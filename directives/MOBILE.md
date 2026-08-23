# Runner mobile — directive active

Autorité : directeur ChoreScore, sous réserve de `MAIN_PROMPT.md`.

## État actuel

La démo Expo possède quatre onglets et un store local synthétique. Le domaine
et les interactions principales doivent rester exécutables sans réseau.

## Mission prioritaire

1. Ajouter des tests d'interaction utiles pour les quatre onglets, les modales,
   les erreurs et les limites de plan déjà implémentées.
2. Corriger uniquement les défauts mobiles réellement révélés par ces tests.
3. Renforcer l'accessibilité : libellés, rôles, focus, grandes tailles de texte
   et petits écrans, sans nouvelle dépendance.
4. Préserver strictement le calcul canonique, le ton non culpabilisant et le
   mode `demo` hors ligne.

Choisir une seule tranche verticale qui puisse être terminée dans le cycle. Ne
pas anticiper Auth, Firebase ou Stripe tant que les portes backend ne sont pas
prêtes.

## Preuves attendues

- tests ciblés succès/erreur ;
- `npm run check` ;
- liste exacte des comportements non vérifiés.
