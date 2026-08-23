## Objectif

<!-- Quel problème borné cette PR résout-elle ? Lier l'issue. -->

Closes #

## Périmètre

- Inclus :
- Explicitement exclu :
- Agent(s) utilisé(s), le cas échéant :

## Preuves

<!-- Captures sans donnée réelle pour l'UI ; résultats ou cas de test sinon. -->

## Contrôles

- [ ] `npm run check`
- [ ] bundle Android avec `EXPO_PUBLIC_DATA_MODE=demo`
- [ ] `npm --prefix functions run check` si le backend ou les règles sont concernés
- [ ] audits npm racine et Functions sans vulnérabilité élevée ou critique connue
- [ ] aucun secret, jeton, donnée personnelle réelle ou corps de webhook dans le diff/logs
- [ ] la démo reste locale, hors ligne et sans paiement réel
- [ ] accessibilité et états d'erreur vérifiés
- [ ] lockfiles mis à jour uniquement si une dépendance change
- [ ] revue sécurité demandée pour auth, autorisations, Firebase, paiement, consentement ou rétention

## Risques et retour arrière

- Risques résiduels / contrôles non exécutés :
- Retour arrière :

## Validation humaine

- [ ] Le diff est relu ; aucune fusion ou livraison automatique n'est attendue.
