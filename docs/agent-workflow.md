# Équipe GitHub OpenCode / Ox

La boucle autonome travaille uniquement dans GitHub Actions avec
`opencode/x-preview-f-free`, sans clé fournisseur. Elle part de la branche
acceptée persistante `lab/chorescore` et ne fusionne ni ne déploie.

## Une organisation à deux couches

Les responsabilités stables sont sous `governance/roles/`. Elles sont
immuables pour toutes les automations et protégées par un manifeste SHA-256.

Les tâches variables sont sous `directives/` et dans
`docs/RELEASE_STATUS.json`. Seul le directeur peut les réécrire. Un codeur ne
peut donc pas agrandir son poste et le directeur ne peut pas modifier sa propre
fiche.

| Poste | Quand il tourne | Écriture |
| --- | --- | --- |
| Ingénieur produit mobile | tâche mobile `enabled: true` | `app/`, `src/`, `tests/` |
| Ingénieur backend/intégration | tâche backend `enabled: true` | Functions, règles et tests sécurité |
| Auditeur indépendant | une fois par codeur actif, puis après correction | rapports d'audit uniquement |
| Directeur de livraison | après les audits | produit accepté, tâches, état et rapport |

Les huit anciens agents génériques ont été supprimés. Le workflow n'instancie
plus un backend inutile pour une tranche purement mobile.

## Cycle

1. Le shell synchronise la gouvernance humaine sur `lab/chorescore`, vérifie
   toutes ses empreintes et valide les tâches.
2. Seuls les codeurs activés partent de l'état accepté, chacun dans son snapshot.
3. Un auditeur distinct contrôle chaque candidat et produit un JSON strict.
4. Tout constat `mustFix: true` déclenche le même codeur en correction.
5. Le candidat corrigé est audité une seconde fois.
6. Le directeur intègre seulement une paire candidat/audit `accept` sans
   `mustFix`, exécute les vérifications et met à jour l'état de livraison.
7. Le shell valide la progression, pousse `lab/chorescore`, conserve une seule
   PR brouillon et relance si la décision vaut `continue`.

Un second audit encore négatif ne disparaît pas : toutes ses corrections
deviennent la première tâche du même poste au cycle suivant.

## Progression vers un produit fini

La cible immuable est `governance/RELEASE_DEFINITION.json`. Le directeur
sélectionne au plus deux critères incomplets et doit fournir les types de preuves
demandés avant de marquer un critère `complete`.

`stalledCycles` est déterministe : un diff produit accepté, une transition
d'état ou une nouvelle preuve objective remet le compteur à zéro. Sans progrès,
il augmente. Deux cycles stagnants arrêtent la boucle avec un blocage explicite,
au lieu de consommer des runners en polissage circulaire.

Le jalon courant est une démo RC locale et installable. Firebase/Stripe réels,
données personnelles, déploiement, validation juridique et test d'intrusion
restent des prérequis humains séparés pour une future bêta de production.

## Continuité et récupération

Les appels OX réessaient les pannes fournisseur à cinq minutes d'intervalle.
Après épuisement d'un job, le watchdog crée une nouvelle exécution récupérant les
snapshots déjà publiés. La limite par job évite de monopoliser indéfiniment un
runner ; la récupération entre runs maintient la continuité de la boucle.

Les branches candidates et rapports restent conservés. Les anciens runs
terminés sont élagués automatiquement, sans supprimer le code ou les audits.

## Garde-fous

- actions tierces épinglées à un SHA ;
- installation par lockfile avec scripts désactivés ;
- démo sans réseau, secret, compte ou paiement ;
- aucun auto-merge ni déploiement ;
- audit contradictoire et checks application/Functions avant relance ;
- construction finale d'un APK debug installable depuis un commit source figé,
  avec SHA-256 et artefact GitHub conservé 14 jours ;
- une unique PR brouillon `lab/chorescore → main` pour la revue humaine.

Le dépôt est public. Ne jamais y placer de donnée réelle ou de secret. La
production reste fermée même si la démo est publiquement consultable.
