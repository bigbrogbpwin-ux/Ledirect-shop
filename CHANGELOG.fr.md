# Journal des modifications

[English](CHANGELOG.md) · [中文](CHANGELOG.zh-CN.md) · **Français**

L'anglais fait foi. Ce fichier note les itérations. Il ne remplace pas les chapitres produit de [README.fr.md](README.fr.md), ni la première note d'avancement dans [docs/index.html](docs/index.html).

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les versions suivent le versionnage sémantique.

## [0.2.0] - 2026-10-24

### Ajouté

- Caisse hébergée Monime quand `MONIME_SECRET` et `MONIME_SPACE_ID` sont tous deux définis. L'acheteur revient sur `APP_ORIGIN`. Le rappel serveur reste le seul résultat de paiement.
- Une action finance qui relève les crédits Monime des 36 dernières heures. Un fichier de règlement peut utiliser `external_ref,amount_sle` en leones, ou `reference,value` en centimes.
- Les remboursements Orange Money et AfriMoney repartent par Monime quand cette caisse est réelle. Carte et virement ouvrent un ticket finance.
- WhatsApp part quand `BSP_TOKEN` et `BSP_URL` sont tous deux définis. Le SMS envoie le code de retrait et les exceptions de paiement quand `SMS_TOKEN` et `SMS_URL` sont tous deux définis.
- `POST /api/cron/daily` avec `Authorization: Bearer <CRON_SECRET>` fait la sauvegarde, envoie les remboursements et messages en file, et relève les crédits Monime si les clés existent.
- Une ligne achetée exige le dossier d'achat. L'arrivée à l'entrepôt d'origine exige la photo de pesée. Le poids en grammes peut être noté à cette étape.
- Note v0.2.0, en chinois, anglais et français : [docs/v0.2.0.html](docs/v0.2.0.html). La v0.1.0 reste [docs/index.html](docs/index.html).

### Corrigé

- `reportNote` et `desk` exigent une session équipe.
- Les sessions client expirent après 30 jours. Les sessions équipe expirent après 12 heures.
- Le second code équipe autorise 5 essais en 10 minutes.
- La production refuse le secret de rappel publié dans le dépôt.
- L'avance de démo et la remise à zéro de la base s'arrêtent dès que Monime est configuré.
- Les rôles équipe se limitent à admin, opérations, achats, entrepôt, support et finance. Un admin ne change pas son propre siège. Le dernier admin actif reste.
- Les réglages ne peuvent plus écrire le secret de rappel ni les compteurs de séquence.
- Un fichier envoyé sans ligne de registre n'est plus servi.
- Les photos de commande, les images d'accueil et la vidéo live n'acceptent qu'un chemin du site, ou une URL https sans identifiant ni mot de passe.
- Le contrôle de santé dit si une sauvegarde existe. Il ne nomme pas le dossier.
- Les codes de connexion sont comparés à longueur égale.
- Les mots de passe de démo restent sur les pages de connexion seulement tant que le mode démo est ouvert.
- Les en-têtes bloquent une adresse base remplacée, les plugins, et les formulaires qui postent vers un autre site. La production envoie aussi HSTS.

### Inchangé

- Tant que les nouvelles clés sont vides, la caisse démo, la boîte interne et les remboursements vers le portefeuille restent ceux de 0.1.0.
- Le catalogue 1688, la recherche par photo, la salle live et les boutons d'application native restent sur des données d'exemple.

[0.2.0]: https://github.com/bigbrogbpwin-ux/Ledirect-shop/releases/tag/v0.2.0
