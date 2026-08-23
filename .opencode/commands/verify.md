---
description: Exécute les contrôles locaux autorisés et produit un compte rendu factuel
agent: qa-accessibility
model: opencode/x-preview-f-free
subtask: true
---

Vérifie le périmètre `$ARGUMENTS`. Exécute seulement les commandes déjà
autorisées et pertinentes : typage, tests application, tests Functions et export
du bundle Android en mode démo. N'installe rien et n'utilise aucun secret.

Rapporte pour chaque commande son résultat, le premier message d'erreur utile et
les contrôles non exécutés. Ne modifies un test que si la demande le prévoit
explicitement ; ne modifies jamais le code produit.
