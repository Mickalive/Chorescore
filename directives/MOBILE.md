# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-05
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Résultat attendu

Dernier constat bloquant de DRC-05 sur l'état accepté du cycle 32961708279 :
le jeton `textSecondary` (#457B9D) passe sous le seuil AA 4,5:1 sur deux fonds
réels de l'arbre intégré — `surfaceAlt` #F8F9FA (4,36:1 : libellés non
sélectionnés du `SegmentedControl`, donc le filtre membre de l'historique et
les périodes historique/classement/profil) et la carte courante du classement
#F7FCFB (4,43:1) ; #FFFDF5 (carte Pro du paywall) est à 4,51:1, sans marge.
Aucun nouveau parcours produit n'est créé.

## Travail borné

1. **Inventaire** — lister chaque usage de style de `textSecondary` dans
   `app/` et `src/` avec son fond réel (jetons du thème et valeurs codées en
   dur), comme l'auditeur l'a fait pour `textMuted` au cycle 32961708279.
2. **Correction centrale** — ajuster le jeton dans `src/components/theme.ts`
   (même démarche que la passe `textMuted` : rester dans la famille de bleu
   sobre canonique) ou employer explicitement un jeton conforme là où c'est
   réellement nécessaire ; viser une marge confortable au-dessus de 4,5:1,
   pas un passage juste au seuil.
3. **Garde déterministe** — étendre `tests/theme-contrast.test.ts` avec
   l'inventaire secondaire complet (tous les fonds réels, y compris codés en
   dur) ; fournir la mesure WCAG de chaque paire et une preuve de mutation
   (retour à #457B9D → exactement les nouveaux cas échouent).

## Hors périmètre

Ne pas toucher aux paires déjà conformes (`textMuted` #56707C sur ses cinq
fonds ; `textSecondary` sur background/surface), au comportement wrap du filtre
membre (MOB-C4-F1) ni à la réinitialisation F3-R2. Pas de refonte visuelle, pas
de nouvelle fonctionnalité, pas de Firebase/Stripe/analytics/réseau, pas de
dépendance, pas de fichier hors `app/`, `src/`, `tests/`. Ne pas traiter DRC-06.
Les facultatifs restent reportés (MOB-C4-F3, MOB-CYCLE32961708279-F2-R2,
-OPT-R2, MOB-C5-N1, garde d'hydratation, harnais UI).

## Preuves attendues

`npm run check` vert, export Android démo réussi hors ligne, tableau de mesure
WCAG par paire conservée, preuve de mutation tracée, liste exacte des fichiers
modifiés (≤ ~4) et limites résiduelles explicites.
