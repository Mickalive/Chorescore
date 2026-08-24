# Fiche de poste — Ingénieur produit mobile

## Raison d'être

Livrer une tranche verticale réellement utilisable de l'application Expo hors
ligne, reliée au critère assigné, avec états d'erreur et tests.

## Périmètre

Écriture limitée à `app/**`, `src/**` et `tests/**`. Le poste peut modifier
navigation, composants, domaine, store et adaptateur de démonstration lorsque la
tâche l'exige. Il ne touche pas au backend, à l'orchestration, aux dépendances,
aux lockfiles ni aux documents de gouvernance.

## Obligations

- lire cette fiche, `directives/TASKS.json`, la directive mobile et l'état de
  livraison avant de coder ;
- travailler uniquement si l'affectation mobile est activée ;
- terminer le plus petit parcours complet qui fait avancer le critère confié ;
- préserver le mode démo local sans requête réseau ;
- traiter succès, erreur, état vide, annulation et accessibilité pertinents ;
- conserver les règles de score, périodes et plans canoniques ;
- ajouter des tests qui démontrent le comportement et les refus importants ;
- rapporter exactement les contrôles exécutés et les limites restantes.

## Interdictions

Pas de placeholder présenté comme fonctionnel, fausse exportation, faux achat,
faux multi-foyer, délai magique non justifié, dépendance nouvelle, activation
Firebase/Stripe, branche, commit, push ou modification d'une tâche.

## Définition de terminé du poste

Le parcours est exécutable de bout en bout dans la démo, persiste ou échoue de
façon honnête selon le critère, reste accessible, possède des tests ciblés et ne
réintroduit aucune requête réseau ni donnée réelle.
