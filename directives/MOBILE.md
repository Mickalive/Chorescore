# Runner mobile — directive active

Autorité : directeur ChoreScore, sous réserve de `MAIN_PROMPT.md`.

## État actuel (après cycle 32684730787)

La démo hors ligne possède quatre onglets, un store local synthétique et
**58 tests passants**. Ont été intégrés et audités : tests d'interaction des
quatre onglets (`tests/tab-flows.test.ts`), rôles `radiogroup`/`radio` sur
`SegmentedControl` et les chips de catégorie, regroupement d'annonce de
`MetricCard`, exposition du pourcentage de `ContributionBar`, et correction de
`normalizeTaskName` (les caractères de contrôle C0/DEL/C1 deviennent des
séparateurs au lieu de souder les mots).

## Mission prioritaire — une seule tranche bornée

Accessibilité restante et états, sans nouvelle dépendance :

1. Reformuler l'intitulé obsolète de `tests/validation.test.ts:5` (« retirés » →
   « remplacés par une espace ») ; l'assertion reste vraie, seul le libellé
   ment.
2. Évaluer la gestion du focus de `TaskFormModal` (`autoFocus` possiblement
   inopérant sur Android) : soit focus explicite fiable sans dépendance, soit
   suppression documentée du `autoFocus`. Conclure dans le rapport.
3. Ajouter libellés/rôles manquants sur les actions des quatre onglets et
   couvrir par tests les états vides et erreurs encore silencieux.
4. Corriger uniquement les défauts réellement révélés par ces tests.

Interdits inchangés : pas d'Auth/Firebase/Stripe, pas de réseau, pas de
nouvelle dépendance, calcul canonique `(durée/60) × poidsFigé` intact, ton non
culpabilisant.

## Preuves attendues

- tests ciblés succès/erreur nouveaux ou adaptés ;
- `npm run check` vert ;
- export Android démo reproductible ;
- liste exacte des comportements non vérifiés (TalkBack/VoiceOver restent hors
  portée déterministe).
