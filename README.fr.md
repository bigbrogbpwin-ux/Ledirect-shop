# LeDirect

[English](README.md) · [中文](README.zh-CN.md) · **Français**

Auteur : Alex Hs

Commerce **transfrontalier**, avec **paiement direct**, **règlement**, **achat à la source** et **transport**.

LeDirect est une boutique transfrontalière open source, et le bureau qui la fait tourner. L’acheteur paie un prix rendu dans sa monnaie. Ce paiement est un paiement direct : le prix et le taux se figent quand l’argent arrive. Le règlement rapproche chaque encaissement, chaque remboursement et chaque solde d’une commande. L’achat à la source se fait dans le pays d’origine. Le transport passe par un entrepôt d’origine, la mer ou l’air, la douane, puis un entrepôt local.

La Sierra Leone est le corridor de référence dans ce dépôt. Les prix sont en leones. Un entrepôt est en Chine, l’autre à Freetown. La caisse est le mobile money. Pour ouvrir un autre corridor, on change la monnaie, le taux, l’adaptateur de paiement et le nom des deux entrepôts. La machine à commandes reste.

![Accueil LeDirect, en anglais](docs/home-en.png)

L’anglais fait foi. Ce fichier en est la traduction.

## Transfrontalier

Une commande transfrontalière garde l’argent dans le pays de l’acheteur et fait partir la marchandise d’un autre pays.

Deux rayons partagent un compte, un panier et un paiement :

- **Précommande.** La plateforme achète après le paiement, reçoit la marchandise à l’entrepôt d’origine, puis l’expédie.
- **Stock local.** La marchandise est déjà dans l’entrepôt local. La caisse ne vend pas au-delà de la quantité en main.

Le panier sépare les deux rayons et affiche un délai différent sur chacun. Un même paiement peut produire deux commandes.

## Paiement direct

Le paiement direct, c’est l’acheteur qui paie cette boutique, dans sa monnaie. La commande payée est le contrat.

- Le prix affiché est le prix rendu : achat, manutention à l’origine, fret international, droits, taxe, manutention à destination. La page de paiement montre trois lignes : marchandise, fret international et taxe, livraison locale.
- Le fret maritime se compte au volume. Le fret aérien se compte au poids taxable. Le supplément aérien est l’écart, calculé sur la commande.
- Le stock local est un prix unique, plus la livraison locale. La précommande est annoncée rendue, puis le fret est détaillé sur la facture.
- Un paiement réussi écrit le prix et le taux sur la commande. Un taux plus tardif ne rouvre pas une commande payée. Les paniers impayés prennent le nouveau taux.
- Un coussin de change reste dans les livres de la plateforme et dans le rapport de change. Il ne s’ajoute pas au prix affiché. Le jeu de données de départ utilise 3 %. Le taux est saisi par la finance, puis activé par une deuxième personne. Un flux de taux peut remplacer cette saisie plus tard.
- La boutique ne conserve ni numéros de carte ni secrets de portefeuille. La caisse vit dans un adaptateur de paiement. Le résultat du paiement est le rappel serveur. La page de retour de l’acheteur ne fait qu’afficher.
- Sur le corridor de référence, l’adaptateur est [Monime](https://monime.io) : Orange Money, AfriMoney, carte, virement, USSD. Tant que `MONIME_SECRET` n’est pas défini, une caisse de démonstration exécute le même rappel, la même idempotence et le même rapprochement.
- Au-dessus du plafond du portefeuille, le paiement direct se coupe en deux. Un acompte fige la commande et le prix. Le solde est un virement. La finance le confirme, et l’achat à la source ne commence qu’ensuite. Dans le jeu de départ, le plafond est de 13 500 leones, l’acompte est de 30 %, et un solde impayé au bout de 72 heures annule la commande et rend l’acompte. Ce sont des réglages.

## Règlement

Le règlement est le livre entre l’adaptateur de paiement et la commande. En anglais du dépôt, ce mot est *clearing*.

- Les rappels sont signés et idempotents.
- Chaque jour, les paiements de commandes sont rapprochés du fichier de règlement du prestataire. Un écart devient un ticket finance.
- Un second paiement réussi sur la même commande est renvoyé.
- Si le rappel n’est jamais arrivé, la finance peut passer la commande à partir de la référence du prestataire.
- Le remboursement suit l’étape du transport. Règles de référence : remboursement intégral avant l’achat ; 90 % après l’achat et avant le conteneur ; remboursement intégral si la plateforme ne peut pas fournir, si le contrôle échoue, ou si le prix a monté et que l’acheteur n’a pas accepté ; remboursement intégral ou renvoi gratuit si l’envoi est perdu ou s’il dépasse de plus de 30 jours la fenêtre promise ; article remboursé ou renvoyé pour un défaut signalé sous 7 jours, avec photos du déballage ; acompte rendu en entier si le solde n’est pas payé à temps.
- Le gain et la perte de change ont leur propre ligne dans le rapport finance.
- Un remboursement important demande un second valideur. Les changements de prix, les remboursements et les changements de taux vont dans le journal d’audit, avec la personne, l’heure, l’ancienne valeur et la nouvelle.

## Achat à la source

L’achat à la source décide comment un article arrive sur le rayon précommande, et comment une commande payée est achetée.

Un SKU en précommande n’est publié qu’après cinq contrôles :

1. Poids mesuré et dimensions du carton.
2. Titre anglais, description anglaise, et au moins trois images.
3. Un prix du marché local, avec la source et la date, pour comparer le prix rendu à la boutique du quartier.
4. Un code SH, une bande de droits, et le nom de la personne qui a signé le classement.
5. Un passage par la liste des articles interdits. Le jeu de départ retient aussi la bande de droits à 35 %.

Sans mesures, un article peut encore être devisé. Il ne peut pas rester en rayon précommande. L’acheteur colle un lien source, une quantité et une note. L’équipe renvoie un prix sous 4 heures ouvrées. Le devis dure 24 heures. Le paiement rejoint ensuite le même flux de précommande.

Après le paiement direct, les achats prennent la ligne et joignent le bon d’achat à la commande. L’entrepôt d’origine ajoute plus tard le poids et les photos. Les lignes de valeur élevée peuvent porter une vidéo de déballage.

## Transport

Le transport, ce sont les deux entrepôts et le trajet entre les deux.

L’**entrepôt d’origine** reçoit la marchandise achetée à la source, la pèse, la photographie et remplit un conteneur. Sur le corridor de référence, cet entrepôt est en Chine. Pour un acheteur du pays de destination, il est à l’étranger.

L’**entrepôt local** porte le stock et reçoit les conteneurs après la douane. Il émet un code de retrait ou envoie une livraison en ville. Sur le corridor de référence, cet entrepôt est à Freetown. Pour une équipe qui opère depuis le pays source, cet entrepôt local est l’entrepôt outre-mer installé sur le marché.

Le fret maritime se facture au mètre cube. La cible du jeu de départ est de 6 m³ pour la semaine. Une semaine trop légère est reportée. Le fret aérien se facture au poids taxable, `max(réel, longueur × largeur × hauteur / 6000)`. L’acheteur peut passer une précommande déjà payée en aérien et payer l’écart.

États de précommande, dans l’ordre :

`PENDING_PAYMENT` → `PAID` (prix figé) → `PROCURING` → `PROCURED` → `IN_CN_WH` → `CONSOLIDATED` → `SHIPPED` (connaissement) → `ARRIVED` → `CLEARING` (dédouanement) → `IN_SL_WH` → `READY` → `COMPLETED`

Un acompte reste sur `DEPOSIT_HELD` jusqu’à confirmation du solde. Le stock local est plus court : payé, préparation, prêt, livré. `CANCELLED` existe à côté du flux principal, là où les règles l’autorisent.

Le bureau ouvre une alerte si l’achat dépasse 72 heures, si la marchandise reste plus de 5 jours à l’entrepôt d’origine, si une traversée dépasse 49 jours, ou si un retrait local attend plus de 7 jours.

Des avis partent au paiement, à l’achat, à l’entrée en entrepôt d’origine, à l’embarquement, à l’arrivée et au retrait. Le canal de référence est WhatsApp, avec le SMS pour les codes de retrait et les incidents de paiement. Les deux restent dans la boîte de réception tant que leurs clés ne sont pas définies.

## Corridor de référence

| | Jeu Sierra Leone |
| --- | --- |
| Monnaie | Leone (SLE), prix entiers |
| Paiement direct | Monime : Orange Money, AfriMoney, carte, banque, USSD |
| Règlement | Rappel, rapprochement quotidien du fichier de règlement, remboursements selon l’étape du transport, coussin de change de 3 % dans les livres |
| Achat à la source | Bureau d’achat en Chine, devis par lien collé, cinq contrôles avant publication |
| Transport | Entrepôt d’origine en Chine, conteneur hebdomadaire, entrepôt local à Freetown, retrait ou livraison en ville |
| Langues | anglais, chinois, français |
| Personnes | Acheteur par téléphone. Postes employés : admin, opérations, achats, entrepôt, support, finance |

Le paiement diaspora (`Shop for family`) affiche des prix en USD et encaisse par carte internationale, puis les mêmes états de transport livrent à un destinataire local. Les demandes vendeur, le portefeuille, la recherche par image, le catalogue source et la salle live ont une route et une écriture en base. Ils tournent sur des données d’exemple jusqu’à ce que la clé correspondante dans `lib/channels.ts` soit définie.

## Dans ce dépôt

Next.js 15, React 19, TypeScript, Tailwind, SQLite dans `data/ledirect.sqlite`.

| Chemin | Rôle |
| --- | --- |
| `lib/pricing.ts` | Argent entier, coût rendu, fret mer et air |
| `lib/states.ts` | Flux d’états transfrontalier et étapes de remboursement |
| `lib/commerce.ts` | Panier, paiement direct, règlement, achat à la source, conteneurs, remboursements |
| `lib/channels.ts` | Paiement, WhatsApp, SMS, catalogue, recherche par image, et les autres ports externes |
| `scripts/uat.ts` | Parcours d’acceptation |
| `scripts/backup.ts` | Sauvegardes dans `data/backups`, conservées 30 jours |

Le mode démo est actif dans le jeu de départ. Le site reste hors des index de recherche tant que ce mode n’est pas coupé dans les réglages. Un identifiant GA4 (`G-…`) ou un pixel Meta ne charge ces balises qu’après cela. Arrêter l’application avant de recopier une sauvegarde sur `data/ledirect.sqlite` et `data/uploads`.

Le nom de marque est un titre de travail.

## Lancer

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000 et suivre le parcours complet depuis `/demo`.

Cliente : `+232 76 111 001` (Aminata Bangura). Le code de connexion s’affiche sur la page.

Équipe : `ada@ledirect.demo` et mot de passe `Demo#2026`, puis le second code sur la page équipe. Le même mot de passe vaut pour `ibrahim@`, `wei@`, `mamusu@`, `fanta@`, `joseph@` et `amadu@` sur `ledirect.demo`.

```bash
npm run uat
npm run backup
```

## Versions

Les chapitres ci-dessus sont le premier texte public. Les itérations suivantes sont notées à côté et ne les remplacent pas.

- [Journal](CHANGELOG.fr.md) · [English](CHANGELOG.md) · [中文](CHANGELOG.zh-CN.md)
- [Note d'itération 0.2.0](docs/iteration-2026-10-24.html), en chinois, anglais et français
- Première note d'avancement : [docs/index.html](docs/index.html)

## Licence

[MIT](LICENSE). Copyright © 2026 Alex Hs <bigbrogbpwin@gmail.com>. Le texte anglais de la licence fait foi. Le chinois et le français dans ce fichier sont là pour la lecture.
