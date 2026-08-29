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

La mission est d'obtenir une application Android réellement utilisable, locale pour la RC, testée et installable. Une suite de tests verte ne vaut jamais validation produit si le comportement ou l'interface ne correspondent pas à cette constitution.

## Produit canonique — non négociable

**ChoreScore est un Tricount des tâches ménagères.**

L'utilisateur crée ou choisit un **foyer**. Dans ce foyer, il enregistre librement ce qui a été fait. Chaque enregistrement est une **entrée indépendante** comprenant au minimum :
- un **nom de tâche libre** saisi par l'utilisateur (`Vaisselle`, `Courses`, `Salle de bain`, `Administratif`, ou n'importe quel autre texte) ;
- la **personne** qui l'a effectuée ;
- le **foyer** auquel l'entrée appartient ;
- le **temps réellement consacré**, saisi manuellement ou mesuré avec un chrono ;
- la date/heure de réalisation.

Le produit agrège ces entrées pour répondre à la question centrale : **comment le temps consacré aux tâches du foyer se répartit-il entre les membres, et cette répartition s'équilibre-t-elle dans le temps ?**

### Règle fondamentale de mesure

**1 minute réelle reste toujours 1 minute réelle.**

Le temps réel est la métrique principale et ne doit jamais être remplacé par des points, un score abstrait ou un temps fictif.

Une **pondération facultative** peut exister uniquement comme option avancée au moment d'ajouter ou modifier une entrée :
- elle est cachée derrière `Options avancées` ;
- elle vaut `1` par défaut ;
- l'utilisateur peut ignorer complètement cette fonction ;
- elle ne modifie jamais la durée réelle stockée ou affichée ;
- si elle est utilisée, elle sert uniquement à une vue secondaire de contribution pondérée ;
- le bilan principal reste le temps réel par membre et la part du temps total ;
- l'interface ne parle jamais de « points ».

### Ce que ChoreScore n'est PAS

ChoreScore n'est **pas** :
- une todo list ;
- un gestionnaire de corvées à accomplir ;
- un catalogue de tâches prédéfinies ;
- une liste de tâches « actives » à démarrer puis archiver ;
- un système de catégories imposées ;
- un produit où l'utilisateur doit d'abord administrer des définitions de tâches avant de pouvoir enregistrer ce qu'il vient de faire ;
- une application de gamification à points.

Aucun agent ne doit réintroduire ces concepts dans le parcours principal.

## Parcours cœur

Le parcours doit être aussi direct que Tricount :

1. **Créer / choisir un foyer** — nom du foyer et membres ; plusieurs foyers lorsque le plan le permet.
2. **Voir le journal du foyer** — liste chronologique des entrées déjà enregistrées.
3. **Ajouter une entrée** — un bouton principal ouvre un formulaire simple : nom libre, personne, durée. La durée peut être saisie directement ou obtenue par chrono. La pondération n'apparaît que dans `Options avancées`.
4. **Modifier ou supprimer une entrée** — correction réelle sans modifier les autres entrées.
5. **Voir le bilan** — comparaison du temps réel des membres et de leur part du total selon quatre horizons fondamentaux : **cette semaine, ce mois, cette année, depuis le début**.
6. **Gérer le foyer** — membres, nom, changement/création de foyer, préférences, export et confidentialité.

Le chrono n'est pas un type de tâche et ne nécessite pas de tâche préexistante : l'utilisateur saisit un nom libre puis démarre le chrono. À l'arrêt, une entrée normale est créée avec la durée réellement mesurée.

## Bilan et équilibre — fonctionnalité cœur

Le bilan est la raison d'être de ChoreScore, pas une fonction accessoire.

Pour le foyer actif, l'utilisateur doit pouvoir passer immédiatement entre :
- **Semaine** — semaine civile courante, lundi à dimanche ;
- **Mois** — mois civil courant ;
- **Année** — année civile courante ;
- **Depuis le début** — toutes les entrées du foyer depuis sa création.

Pour chaque période, afficher au minimum :
- le temps réel total du foyer ;
- le temps réel de chaque membre ;
- la part de chaque membre en pourcentage du temps total ;
- une représentation visuelle simple permettant de voir immédiatement un déséquilibre.

Ces quatre périodes appartiennent au **produit de base** et ne doivent pas être bloquées derrière le premium. Le premium peut ajouter des filtres personnalisés, tendances, comparaisons entre périodes, exports, foyers multiples et la vue pondérée avancée.

## Principes UX

L'interface doit être **simple, moderne, légère et immédiatement compréhensible**. Le produit doit ressembler davantage à une app financière/sociale mobile propre qu'à un tableau d'administration.

Priorités :
- l'action `Ajouter une entrée` doit être immédiatement évidente ;
- le journal et le bilan doivent être lisibles en quelques secondes ;
- afficher les durées en minutes/heures, jamais comme des points ;
- limiter fortement le texte explicatif permanent ;
- ne pas afficher de jargon technique, de critères DRC, de discours de conformité ou de longues mises en garde dans le parcours normal ;
- éviter les cartes imbriquées et les batteries de boutons secondaires ;
- les actions rares (modifier, supprimer) passent par menu contextuel ou écran de détail ;
- aucune catégorie obligatoire ;
- aucun nom de tâche prédéfini obligatoire ;
- la pondération ne doit jamais encombrer le formulaire principal ;
- les tâches récentes peuvent éventuellement être proposées comme raccourcis, mais restent de simples suggestions issues de l'historique et jamais un catalogue à administrer.

Accessibilité, grandes tailles de texte, petits écrans, contrastes, erreurs et états vides font partie du produit.

## Navigation cible

La navigation peut être adaptée par le designer mobile, mais elle doit rester centrée sur quatre concepts maximum :
- **Journal** — entrées du foyer et action d'ajout ;
- **Bilan** — temps par membre, équilibre et périodes ;
- **Foyer** — membres, création/changement de foyer ;
- **Profil / Réglages** si nécessaire.

Une navigation `Tâches` fondée sur des définitions de tâches persistantes n'est pas conforme au produit.

## Règles métier

La durée réelle de chaque entrée est conservée en secondes.

Pour une période donnée :
- `tempsMembre = somme des durées réelles des entrées du membre` ;
- `tempsFoyer = somme des durées réelles de toutes les entrées du foyer` ;
- `partMembre = tempsMembre / tempsFoyer` lorsque `tempsFoyer > 0`.

Si une pondération avancée est utilisée, elle est figée sur l'entrée et peut alimenter une analyse secondaire. Elle ne remplace jamais ces trois métriques principales.

## Offre canonique

Essai complet : 30 jours.

Après l'essai, le plan gratuit conserve :
- création d'un foyer ;
- ajout d'entrées libres ;
- durée manuelle ou chronométrée ;
- bilan en temps réel sur **semaine / mois / année / depuis le début**.

Premium ajoute notamment pondération avancée facultative, analyses comparatives et filtres avancés, exports et foyers multiples. Standard : 2,99 EUR/mois pour 1 à 7 personnes. Pro : 5,99 EUR/mois à partir de 8 personnes. Standard et Pro ont les mêmes fonctionnalités ; seule la taille du foyer change le prix.

Aucun faux achat, faux export, faux multi-foyer ou faux succès.

## Démo locale obligatoire

`EXPO_PUBLIC_DATA_MODE=demo` est le mode sûr par défaut.

La RC locale :
- fonctionne sans compte, secret, paiement, Firebase réel ou analytics ;
- permet réellement de créer un foyer local et des membres locaux ;
- utilise uniquement des données locales ;
- ne dépend d'aucune requête réseau au runtime ;
- persiste les foyers et entrées entre redémarrages ;
- reste testable et exportable ;
- ne présente jamais une simulation comme une transaction ou synchronisation réelle.

Firebase/Stripe/analytics/déploiement réels restent hors périmètre de la RC.

## Équipe autonome

### Ingénieur produit mobile
Écrit uniquement dans `app/**`, `src/**`, `tests/**`. Il livre la tâche mobile activée, avec comportement réel, UX cohérente, erreurs pertinentes, accessibilité et tests.

### Ingénieur backend/intégration
Écrit uniquement dans `functions/src/**`, `functions/test/**`, `docs/security/**` et les fichiers Firebase/règles explicitement autorisés. Il garde tous les services réels désactivés.

### Auditeur indépendant
N'édite jamais le produit. Il compare le candidat au **produit canonique ci-dessus**. Un candidat techniquement vert mais ressemblant à une todo list, imposant des catégories, cachant les périodes cœur ou affichant des points comme métrique principale doit être rejeté.

### Directeur de livraison
N'édite jamais le code produit. Il ne peut déclarer une tranche complète si elle satisfait seulement des tests techniques mais viole le parcours produit canonique.

## Une seule usine, plusieurs lanes

Le control-plane principal est `.github/workflows/chorescore-factory.yml`. L'unique état produit cumulatif est `lab/chorescore`.

Chaque cycle synchronise la constitution humaine depuis `main`, sélectionne les modèles disponibles, lance les ingénieurs activés, audite indépendamment les candidats, intègre uniquement les candidats acceptés, vérifie l'ensemble puis reprend depuis l'état accepté jusqu'à conformité réelle du produit.

La stagnation, un audit négatif, une panne de modèle, un build rouge ou l'absence de candidat signifient continuer/corriger, jamais « produit terminé ».

## Condition terminale

L'usine ne peut s'arrêter que lorsque :
- le parcours Tricount-like décrit ici fonctionne réellement ;
- création/changement de foyer fonctionne ;
- ajout d'une entrée au nom libre + personne + durée fonctionne ;
- saisie manuelle et chrono créent réellement des entrées ;
- modification/suppression d'entrées fonctionne ;
- journal et bilan reflètent réellement les temps ;
- semaine, mois, année et depuis le début fonctionnent réellement ;
- la pondération, si présente, reste optionnelle et secondaire ;
- persistance et isolation des foyers sont prouvées ;
- l'interface a fait l'objet d'un audit UX produit, et pas uniquement d'un test de contraste ;
- tous les critères de release sont complets sans finding bloquant ;
- l'APK est réellement construit, installé et parcouru sur Android sans Metro ni réseau.

## Interdictions

Un agent ne doit jamais :
- transformer ChoreScore en todo list ;
- imposer des catégories de tâches dans le parcours cœur ;
- imposer la création d'une définition de tâche avant l'enregistrement d'un travail effectué ;
- afficher des points comme métrique principale ;
- mettre la pondération dans le parcours simple par défaut ;
- cacher semaine/mois/année/depuis le début derrière un paywall ;
- cacher une divergence produit derrière des tests verts ;
- affaiblir un test ou une garde pour obtenir du vert ;
- inventer une preuve ou présenter un placeholder comme terminé ;
- activer Firebase/Stripe/analytics réels dans la RC.

**Construire le produit réellement demandé : un Tricount simple des tâches ménagères, centré sur le temps et l'équilibre du foyer. Auditer. Intégrer. Continuer jusqu'à l'APK final conforme.**
