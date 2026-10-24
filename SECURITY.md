# Security

Author: Alex Hs. English is the source text. Chinese and French follow it.

LeDirect in this repository is a demo. The shop can be walked end to end. It is not set up to take real money. Demo sign-in details are printed in the README on purpose. The seed webhook secret in `lib/defaults.ts` is a demo value. A public demo that still uses it can accept a forged payment callback. Replace that secret before any real cashier is connected, and keep `MONIME_WEBHOOK_SECRET` only in the server environment.

Hosting passwords, API tokens, and panel credentials do not belong in this repository. `.env`, `.env.local`, and `.env.hosting.local` are ignored. `.env.example` lists channel names and has no values.

## Report a problem

Write to bigbrogbpwin@gmail.com. Describe what you did and what you saw. Give us a chance to fix it before you publish the details. A public GitHub issue is fine for a defect that does not let someone take over an account, forge a payment, or read another person's order.

## What this demo already leaves open

These are properties of the demo seed, not a live payment deployment:

- Staff and customer demo passwords are in the source and on the demo page.
- The webhook secret in the seed is public as soon as the source is public.
- Some staff summaries can be read without a staff session.
- Staff sessions stored in the database do not expire on their own.

Do not point this seed at a live Monime account, a live WhatsApp sender, or a real warehouse until those four are closed and the secrets live only on the server.

---

中文译文。含义以上面的英文为准。

本仓库里的 LeDirect 是演示。整条店可以走通，但没有接真实收款。演示登录信息写在 README 里，是故意公开的。`lib/defaults.ts` 里的回调密钥是演示值。公开的演示站如果还用这个值，别人可以伪造付款成功。接真实收银台之前先换掉它，并且只把 `MONIME_WEBHOOK_SECRET` 放在服务器环境里。

主机密码、API token、面板凭证不要进这个仓库。`.env`、`.env.local`、`.env.hosting.local` 已被忽略。`.env.example` 只有通道名字，没有值。

发现问题写到 bigbrogbpwin@gmail.com。写清你做了什么、看到了什么。在公开细节之前先给我们修的时间。不会导致账号被接管、付款被伪造、或读到别人订单的缺陷，可以开公开的 GitHub issue。

演示种子目前还敞着这些口，不是一套已经在收真钱的部署：

- 员工和顾客的演示密码在源码和演示页上。
- 种子里的回调密钥会随源码一起公开。
- 一部分员工汇总可以在没有员工会话时读到。
- 存在数据库里的员工会话不会自己过期。

在这四项收口、密钥只留在服务器上之前，不要把这套种子接到真实的 Monime、真实的 WhatsApp 或真实仓库。

---

Traduction française. L'anglais fait foi.

LeDirect dans ce dépôt est une démo. On peut parcourir toute la boutique. Elle n'encaisse pas de vrai argent. Les accès de démo sont dans le README, volontairement. Le secret de rappel dans `lib/defaults.ts` est une valeur de démo. Une démo publique qui le garde peut accepter un paiement forgé. Remplacez-le avant de brancher une vraie caisse, et gardez `MONIME_WEBHOOK_SECRET` uniquement dans l'environnement du serveur.

Les mots de passe d'hébergement, les jetons d'API et les accès au panneau n'ont pas leur place dans ce dépôt. `.env`, `.env.local` et `.env.hosting.local` sont ignorés. `.env.example` ne contient que des noms de canaux, sans valeur.

Écrivez à bigbrogbpwin@gmail.com. Dites ce que vous avez fait et ce que vous avez vu. Laissez le temps de corriger avant de publier le détail. Un issue GitHub public convient pour un défaut qui ne permet pas de prendre un compte, de forger un paiement, ou de lire la commande de quelqu'un d'autre.

Ce que le jeu de démo laisse encore ouvert :

- Les mots de passe de démo, équipe et client, sont dans les sources et sur la page de démo.
- Le secret de rappel du jeu devient public avec les sources.
- Certains résumés d'équipe se lisent sans session équipe.
- Les sessions équipe en base n'expirent pas seules.

Ne branchez pas ce jeu sur un vrai compte Monime, un vrai expéditeur WhatsApp, ou un vrai entrepôt tant que ces quatre points ne sont pas fermés et que les secrets ne vivent que sur le serveur.
