# Instructions de contribution assistée

Ces instructions s'appliquent à tout le dépôt ChoreScore, quel que soit l'outil
d'assistance utilisé.

## Sources d'autorité

Lire avant toute modification :

1. `docs/product-decisions.md` pour les décisions produit canoniques ;
2. `docs/architecture.md` pour les frontières de confiance ;
3. `SECURITY.md` pour les conditions préalables à une production réelle ;
4. `docs/agent-workflow.md` pour la délégation, les branches et les contrôles.

En cas de contradiction, la sécurité et la confidentialité priment, puis les
décisions produit canoniques. Ne réintroduisez pas une ancienne hypothèse issue
d'un prototype ou d'une conversation préparatoire.

## Invariants non négociables

- La branche principale reste utilisable sans compte, secret, paiement, Firebase
  ni analytics. `EXPO_PUBLIC_DATA_MODE=demo` est la valeur sûre par défaut.
- La démo emploie uniquement des données synthétiques locales et ne fait aucune
  requête réseau.
- Une variable `EXPO_PUBLIC_*` est publique. N'y placer aucun secret, jeton,
  clé Stripe privée, compte de service ou donnée personnelle.
- Le client mobile est non fiable. En production, score validé, rôle,
  appartenance au foyer, abonnement et heure de référence sont décidés côté
  serveur, avec autorisation et validation.
- Ne jamais journaliser un secret, un corps de webhook complet, un jeton
  d'invitation brut ou une donnée personnelle non nécessaire.
- L'analytics est facultatif, désactivé par défaut, révocable et séparé des
  conditions de service obligatoires.
- Ne jamais prétendre qu'un changement est « sans faille ». Rapporter les
  contrôles effectués, leurs résultats et les risques résiduels.
- Aucun agent ne déploie, ne fusionne, ne pousse sur `main`, ne publie de paquet
  et ne déclenche un paiement.

## Discipline de modification

- Une tâche bornée, une branche, une pull request. Éviter les branches partagées
  entre agents et les modifications qui se chevauchent.
- Ne pas ajouter ou mettre à jour une dépendance sans justification, lockfile,
  audit et revue humaine.
- Préserver les changements existants sans rapport avec la tâche.
- Ne pas contourner un test, une règle Firebase ou un contrôle de type pour
  obtenir un statut vert.
- Les changements d'authentification, d'autorisation, de paiement, de règles
  Firebase, de consentement ou de rétention exigent la revue du propriétaire.
- Toute action GitHub tierce doit être épinglée à un SHA complet vérifié dans le
  dépôt officiel. Aucun tag mutable tel que `@main`, `@latest` ou `@v4`.

## Commandes de validation

À partir de la racine, avec Node.js `22.13.0` et les lockfiles suivis :

```bash
npm ci --ignore-scripts
npm run check
EXPO_PUBLIC_DATA_MODE=demo npx --no-install expo export --platform android
npm audit --omit=dev --audit-level=high

npm --prefix functions ci --ignore-scripts
npm --prefix functions run check
npm --prefix functions audit --omit=dev --audit-level=high
```

Ne pas exécuter un script d'installation distant, installer globalement un outil
ou réparer automatiquement une alerte d'audit sans examiner le diff.

## Définition de terminé

Une pull request est prête seulement si son périmètre est explicite, ses tests
sont ajoutés ou adaptés, les deux jobs CI passent, aucun secret n'est présent,
la démo hors ligne fonctionne et les risques résiduels sont consignés. La fusion
reste une décision humaine protégée par revue.
