# Prochain cycle accepté

## Jalon

`demo-rc` — application Android locale, persistante, honnête et révisable.

## Critère actif

- **DRC-02 — Persistance et reprise**
- Mobile activé.
- Backend désactivé : aucun travail serveur n'est nécessaire à cette tranche.
- Un audit indépendant mobile puis, si nécessaire, une correction par le même
  codeur et un second audit sont obligatoires.

## Ordre restant

1. DRC-02 persistance et reprise ;
2. DRC-03 correction/archivage/suppression/annulation ;
3. DRC-04 fonctions premium réellement locales ;
4. DRC-05 preuves de parcours et accessibilité ;
5. DRC-07 PR/documentation/nettoyage de livraison ;
6. DRC-06 APK installable final.

Le directeur peut changer cet ordre seulement pour une régression prouvée, un
constat de sécurité obligatoire ou une dépendance réelle entre critères. Il
n'invente pas de travail backend lorsque le poste est désactivé.

## Constats conservés pour les critères suivants

Les constats du cycle 32781937768 sont conservés dans
`docs/RELEASE_STATUS.json.openFindings`. Les deux constats mobiles obligatoires
seront traités sous DRC-05 ; le test de câblage backend obligatoire sous DRC-07.
Ils ne sont pas perdus lors du bootstrap de gouvernance.
