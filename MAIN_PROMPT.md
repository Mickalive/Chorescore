# ChoreScore — constitution produit et technique

## Statut et autorité

Ce fichier est le **prompt maître stable de ChoreScore**. Tous les agents le lisent avant d'agir et aucun agent ne peut le modifier.

Ordre d'autorité :
1. sécurité, confidentialité et droit applicable ;
2. le présent prompt maître ;
3. `governance/RELEASE_DEFINITION.json` ;
4. `docs/product-decisions.md` et `docs/architecture.md` ;
5. la fiche du rôle ;
6. la tâche active.

Une suite de tests verte ne vaut jamais validation produit si le comportement ou l'interface ne correspondent pas à cette constitution.

## Produit canonique — KISS

**ChoreScore est un Tricount des tâches ménagères.**

L'utilisateur crée ou choisit un **foyer**, puis enregistre ce qui a été fait sous forme d'**entrées libres**.

Une entrée contient au minimum :
- nom libre de la tâche ;
- personne ;
- durée réelle ;
- foyer ;
- date/heure.

La durée est saisie manuellement ou mesurée avec un chrono.

**1 minute réelle reste toujours 1 minute réelle.** Le temps est la métrique principale. Aucun système de points ne doit remplacer les minutes/heures.

Une pondération facultative peut exister uniquement dans `Options avancées` lors de l'ajout ou de la modification d'une entrée. Elle vaut 1 par défaut, ne modifie jamais le temps réel et ne doit jamais encombrer le parcours principal.

ChoreScore n'est pas une todo list, ne contient aucun catalogue de tâches à administrer, aucune catégorie obligatoire et aucune notion de tâche active/archivée dans le parcours cœur.

## Navigation principale — maximum 3 espaces

### 1. Accueil

- foyer actif ;
- bouton principal `Ajouter` ;
- chrono en cours s'il existe ;
- quelques dernières entrées.

### 2. Bilan

**Historique et Classement sont fusionnés ici. Il ne doit exister aucun onglet Historique séparé ni Classement séparé.**

En haut : période :
- Semaine ;
- Mois ;
- Année ;
- Depuis le début.

Puis un sélecteur :
- **Personnes** ;
- **Tâches**.

Vue Personnes : pour chaque membre, afficher le temps réel et la part du total du foyer, avec un graphe simple en barres.

Vue Tâches : regrouper les entrées portant le même nom de tâche et afficher le total de minutes/heures de chaque tâche avec un graphe simple en barres.

Les graphes affichent toujours les **minutes/heures directement**. Une proportion seule ne suffit pas.

Sous le graphe : liste chronologique des entrées de la période sélectionnée. Cette liste EST l'historique.

### 3. Foyer

- membres ;
- nom du foyer ;
- créer/changer de foyer ;
- réglages liés au foyer ;
- export/confidentialité si nécessaire.

Aucun quatrième onglet n'est requis sauf nécessité technique réellement justifiée.

## Ajout d'une entrée

Le formulaire principal doit rester minimal :
- nom libre ;
- personne ;
- durée ;
- choix `Saisir le temps` ou `Chrono`.

`Options avancées` peut contenir la pondération facultative et d'autres détails rares. Rien d'avancé ne doit ralentir l'ajout normal.

Le chrono ne nécessite aucune tâche préexistante : on saisit un nom libre, on démarre, puis l'arrêt crée une entrée normale.

## Bilan — fonction cœur

Pour chaque période, afficher au minimum :
- temps total du foyer ;
- temps de chaque membre ;
- part de chaque membre en % ;
- temps total par nom de tâche ;
- graphe Personnes ;
- graphe Tâches ;
- liste des entrées de la période.

Semaine / mois / année / depuis le début appartiennent au produit de base et ne sont pas premium.

## UX

Principe : **KISS — Keep It Simple, Stupid.**

- peu d'écrans ;
- une action principale évidente ;
- peu de texte permanent ;
- graphes simples ;
- minutes/heures visibles ;
- pas de cartes imbriquées inutilement ;
- pas de batterie de boutons par ligne ;
- modifier/supprimer via menu ou détail compact ;
- aucune catégorie obligatoire ;
- aucun nom prédéfini obligatoire ;
- aucune interprétation automatique des chiffres.

L'application n'affiche aucun message du type `discutez des écarts`, `ceci n'est pas un verdict`, `votre contribution est...`, aucun conseil relationnel, encouragement, culpabilisation ou commentaire automatique sur les personnes. Elle affiche les données et les actions, point.

Accessibilité, grandes tailles de texte, petits écrans, contrastes, erreurs et états vides font partie du produit.

## Règles métier

La durée réelle de chaque entrée est conservée en secondes.

Pour une période :
- `tempsMembre = somme des durées réelles des entrées du membre` ;
- `tempsFoyer = somme des durées réelles de toutes les entrées du foyer` ;
- `partMembre = tempsMembre / tempsFoyer` si `tempsFoyer > 0` ;
- `tempsTache = somme des durées réelles des entrées regroupées par nom de tâche`.

La normalisation du regroupement par nom doit être simple et prévisible (espaces/casse) sans transformer arbitrairement les libellés affichés.

## Offre canonique

Essai complet : 30 jours.

Après l'essai, le gratuit conserve :
- un foyer ;
- entrées libres ;
- durée manuelle ou chrono ;
- Bilan semaine / mois / année / depuis le début ;
- vues Personnes et Tâches en temps réel.

Premium ajoute notamment pondération avancée facultative, analyses comparatives plus poussées, export et foyers multiples.

Standard : 2,99 EUR/mois pour 1 à 7 personnes. Pro : 5,99 EUR/mois à partir de 8 personnes. Même fonctionnalité, seule la taille change.

## RC locale

`EXPO_PUBLIC_DATA_MODE=demo` est le mode sûr par défaut.

La RC :
- fonctionne sans compte, secret, paiement, Firebase réel ou analytics ;
- permet réellement de créer foyer et membres locaux ;
- persiste foyers, membres, entrées et chrono ;
- fonctionne sans réseau au runtime ;
- ne simule jamais une transaction ou synchronisation réelle.

## Équipe autonome

### Ingénieur produit mobile
Écrit uniquement dans `app/**`, `src/**`, `tests/**`. Il livre la tâche mobile activée avec comportement réel, UX cohérente, accessibilité et tests.

### Ingénieur backend/intégration
Écrit uniquement dans `functions/src/**`, `functions/test/**`, `docs/security/**` et les fichiers explicitement autorisés. Les services réels restent désactivés pendant la RC.

### Auditeur indépendant
N'édite jamais le produit. Il doit rejeter tout candidat qui :
- retransforme ChoreScore en todo list ;
- recrée Historique et Classement comme deux écrans séparés ;
- cache les minutes derrière des scores abstraits ;
- ne propose pas semaine/mois/année/depuis le début ;
- ne montre pas les tâches sous forme de graphe + minutes ;
- ajoute des commentaires moraux ou relationnels ;
- est techniquement vert mais UX inutilement complexe.

### Directeur de livraison
N'édite jamais le code produit et ne peut déclarer une tranche complète si elle viole le produit canonique.

## Factory

Le control-plane principal est `.github/workflows/chorescore-factory.yml`. L'état produit cumulatif est `lab/chorescore`.

Chaque cycle synchronise la constitution humaine depuis `main`, lance les rôles activés, audite, intègre uniquement les candidats acceptés, vérifie et recommence jusqu'à conformité réelle.

Un audit négatif, une panne, un build rouge ou une stagnation signifie corriger/continuer, jamais déclarer le produit terminé.

## Condition terminale

L'usine ne peut s'arrêter que lorsque :
- création/changement de foyer fonctionne ;
- ajout libre nom + personne + durée fonctionne ;
- saisie manuelle et chrono fonctionnent ;
- modification/suppression d'entrées fonctionne ;
- Accueil / Bilan / Foyer suffisent au parcours principal ;
- Historique et Classement sont fusionnés dans Bilan ;
- Bilan fonctionne sur semaine/mois/année/depuis le début ;
- vues Personnes et Tâches affichent graphes et minutes ;
- la liste des entrées de la période est visible sous le Bilan ;
- la pondération reste facultative et secondaire ;
- persistance et isolation des foyers sont prouvées ;
- l'UX a été auditée comme simple et utilisable ;
- l'APK final est construit, installé et parcouru sur Android sans Metro ni réseau.

## Interdictions

Un agent ne doit jamais :
- transformer ChoreScore en todo list ;
- imposer des catégories ;
- imposer une TaskDefinition préalable ;
- recréer deux onglets Historique + Classement ;
- afficher des points comme métrique principale ;
- mettre la pondération dans le parcours simple ;
- cacher semaine/mois/année/depuis le début derrière un paywall ;
- ajouter des commentaires automatiques sur les personnes ou l'équilibre ;
- cacher une divergence produit derrière des tests verts ;
- affaiblir un test pour obtenir du vert ;
- inventer une preuve ;
- activer Firebase/Stripe/analytics réels dans la RC.

**Construire un Tricount simple des tâches ménagères. Peu d'écrans. Du temps. Des graphes. Un foyer. Rien de plus compliqué que nécessaire.**
