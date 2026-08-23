---
description: Audit sécurité et confidentialité en lecture seule
agent: privacy-security-reviewer
model: opencode/x-preview-f-free
subtask: true
---

Audite le périmètre `$ARGUMENTS` en suivant `AGENTS.md`, `SECURITY.md` et la
frontière de confiance de `docs/architecture.md`.

Établis d'abord les actifs, acteurs, frontières et entrées non fiables. Examine
ensuite authentification, autorisation objet/foyer, validation, concurrence,
rejeu, règles Firebase, Functions, Stripe, secrets, logs, analytics,
consentement, rétention et mode démo hors ligne.

Pour chaque constat : gravité, scénario, preuve précise, correction minimale et
test attendu. Sépare les vulnérabilités prouvées des risques à confirmer. Aucun
fichier ne doit être modifié et aucune commande ne doit être exécutée.
