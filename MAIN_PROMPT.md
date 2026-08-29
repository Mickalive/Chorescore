# ChoreScore — constitution produit et technique

## Autorité

Ce fichier est le **prompt maître stable de ChoreScore**. Tous les agents le lisent avant d'agir et aucun agent ne peut le modifier.

Ordre d'autorité : sécurité/droit > ce prompt > `governance/RELEASE_DEFINITION.json` > `docs/product-decisions.md` et architecture > rôle > tâche active.

Une suite de tests verte ne vaut jamais validation si le produit livré ne correspond pas à cette constitution.

# Produit canonique — KISS

**ChoreScore est un Tricount des tâches ménagères.**

Le foyer possède une suite chronologique d'**entrées**, comme Tricount possède une suite de dépenses.

Chaque fois qu'une personne fait quelque chose, elle ajoute **une nouvelle entrée indépendante** contenant :
- un libellé libre (`Vaisselle`, `Courses`, `Salle de bain`, ou n'importe quel texte) ;
- la personne qui l'a fait ;
- la durée réelle ;
- le foyer ;
- la date/heure ;
- éventuellement des options avancées facultatives.

Exemple : `Vaisselle — Mickael — 18 min — 30 août` est une entrée. Si Mickael refait la vaisselle demain, c'est une **nouvelle entrée**.

## Règle structurelle absolue

**Il n'existe aucune entité persistante “tâche”.**

Le domaine ne doit pas contenir de `TaskDefinition`, catalogue de tâches, tâche active, tâche archivée, tâche à administrer, catégorie obligatoire ou relation `entry.taskId` vers une définition persistante.

Le mot « tâche » dans l'interface signifie seulement le **libellé texte d'une entrée**.

Les anciennes données basées sur `TaskDefinition` doivent être migrées vers des entrées autonomes en copiant le libellé nécessaire dans chaque entrée. Après migration, les entrées ne dépendent plus d'une définition de tâche.

Des suggestions de libellés récents peuvent éventuellement être calculées depuis l'historique pour accélérer la saisie, mais elles ne deviennent jamais des objets persistants à gérer.

# Mesure

**1 minute réelle = 1 minute réelle.**

Le temps est la métrique principale et permanente. Aucun système de points ne remplace les minutes/heures.

Une pondération facultative peut exister uniquement dans `Options avancées` d'une entrée. Elle vaut 1 par défaut, ne change jamais la durée réelle et ne doit jamais encombrer le parcours principal.

# Navigation — maximum 3 espaces

## 1. Accueil

- foyer actif ;
- bouton principal `Ajouter` ;
- chrono en cours s'il existe ;
- quelques dernières entrées.

## 2. Bilan

**Historique et Classement sont un seul écran.** Il ne doit exister ni onglet Historique séparé ni onglet Classement séparé.

Périodes :
- Semaine ;
- Mois ;
- Année ;
- Depuis le début.

Puis :
- **Personnes** ;
- **Tâches**.

### Personnes

Pour chaque membre : temps réel, part du temps total du foyer en %, graphe simple en barres avec minutes/heures lisibles.

### Tâches

Cette vue **n'affiche pas des objets tâche**. Elle agrège à la volée les entrées de la période selon leur libellé texte normalisé.

Exemple : toutes les entrées libellées `Vaisselle` sont additionnées pour afficher `Vaisselle — 2 h 43` sur le mois.

Afficher :
- libellé ;
- minutes/heures totales ;
- graphe simple en barres.

Sous les graphes : liste chronologique des **entrées individuelles** de la période. Cette liste est l'historique.

## 3. Foyer

- membres ;
- nom du foyer ;
- créer/changer de foyer ;
- réglages du foyer ;
- export/confidentialité si nécessaire.

# Ajouter une entrée

Formulaire principal minimal :
- libellé libre ;
- personne ;
- durée ;
- `Saisir le temps` ou `Chrono`.

Le chrono part d'un libellé libre et produit une entrée autonome lorsqu'il est terminé.

`Options avancées` contient seulement les fonctions rares comme la pondération facultative.

# Bilan — fonction cœur

Pour chaque période :
- temps total du foyer ;
- temps par personne ;
- part par personne en % ;
- temps agrégé par libellé de tâche ;
- graphe Personnes ;
- graphe Tâches ;
- entrées individuelles de la période.

Semaine / mois / année / depuis le début appartiennent au produit de base.

# UX — KISS

- peu d'écrans ;
- une action principale évidente ;
- peu de texte ;
- graphes simples ;
- minutes/heures visibles ;
- pas de cartes imbriquées inutilement ;
- pas de batterie de boutons par entrée ;
- modifier/supprimer via menu ou détail compact ;
- aucune catégorie obligatoire ;
- aucune interprétation automatique des chiffres.

L'application ne commente jamais les personnes ou l'équilibre : aucun `discutez des écarts`, `ceci n'est pas un verdict`, conseil relationnel, encouragement, culpabilisation ou feedback automatique. Elle affiche les données et les actions.

# Règles métier

La durée de chaque entrée est conservée en secondes.

Pour une période :
- `tempsMembre = somme(durée des entrées du membre)` ;
- `tempsFoyer = somme(durée de toutes les entrées du foyer)` ;
- `partMembre = tempsMembre / tempsFoyer` si le total est supérieur à zéro ;
- `tempsLibelle = somme(durée des entrées regroupées à la volée par libellé normalisé)`.

La normalisation du libellé est simple et prévisible (espaces/casse) et ne modifie pas arbitrairement le texte affiché.

# Offre

Essai complet : 30 jours.

Après l'essai, le gratuit conserve :
- un foyer ;
- entrées libres ;
- durée manuelle ou chrono ;
- Bilan semaine / mois / année / depuis le début ;
- vues Personnes et Tâches en temps réel.

Premium ajoute notamment pondération avancée facultative, analyses comparatives plus poussées, export et foyers multiples.

Standard : 2,99 EUR/mois pour 1 à 7 personnes. Pro : 5,99 EUR/mois à partir de 8 personnes ; mêmes fonctionnalités, seule la taille change.

# RC locale

`EXPO_PUBLIC_DATA_MODE=demo` est le mode sûr par défaut.

La RC fonctionne sans compte, secret, paiement, Firebase réel, analytics ou réseau au runtime. Elle permet de créer foyers et membres locaux et persiste foyers, membres, entrées et chrono.

# Rôles

L'ingénieur mobile écrit dans `app/**`, `src/**`, `tests/**` et doit préserver les bonnes briques techniques existantes tout en remplaçant le mauvais modèle produit.

L'auditeur indépendant doit rejeter tout candidat qui :
- conserve `TaskDefinition` comme entité métier persistante ;
- conserve `entry.taskId` comme dépendance obligatoire vers une définition de tâche ;
- transforme ChoreScore en todo list ;
- recrée Historique et Classement séparément ;
- ne propose pas semaine/mois/année/depuis le début ;
- ne montre pas les agrégats de libellés sous forme de graphe + minutes/heures ;
- masque le temps derrière des points ;
- ajoute des commentaires moraux/relationnels ;
- est techniquement vert mais inutilement complexe.

Le Directeur ne peut déclarer une tranche complète si elle viole ce produit canonique.

# Factory et condition terminale

Le control-plane principal est `.github/workflows/chorescore-factory.yml` et l'état cumulatif est `lab/chorescore`.

La factory continue jusqu'à ce que :
- foyers et membres fonctionnent ;
- le modèle persistant repose sur des entrées autonomes, sans entité tâche ;
- ajout libre personne + libellé + durée fonctionne ;
- chrono fonctionne ;
- modification/suppression d'entrées fonctionne ;
- Accueil / Bilan / Foyer suffisent ;
- Historique et Classement soient fusionnés ;
- semaine/mois/année/depuis le début fonctionnent ;
- graphes Personnes et Tâches montrent minutes/heures ;
- l'historique montre chaque action comme une entrée individuelle ;
- persistance/migration/isolation soient prouvées ;
- l'UX soit auditée simple et utilisable ;
- l'APK final soit construit, installé et parcouru sans Metro ni réseau.

**Construire un Tricount des tâches ménagères : des entrées, du temps, des agrégats calculés. Pas d'objet tâche.**
