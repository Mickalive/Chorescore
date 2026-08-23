---
description: Revue contradictoire du diff courant par produit, sécurité et QA
agent: chorescore-orchestrator
model: opencode/x-preview-f-free
---

Passe en revue uniquement le diff courant et le périmètre `$ARGUMENTS`.

1. Demande au `product-guardian` de vérifier le canon produit.
2. Demande au `privacy-security-reviewer` de chercher les vulnérabilités et
   régressions de confidentialité.
3. Demande au `qa-accessibility` d'identifier les tests et contrôles manquants,
   sans modifier les tests pendant cette revue.
4. Déduplique les constats et classe-les par gravité.

Ne modifies aucun fichier. Fournis les preuves précises, les commandes réellement
exécutées et une décision parmi `bloqué`, `prêt après corrections` ou `prêt pour
revue humaine`. Ne fusionne et ne déploie jamais.
