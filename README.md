# LeDirect

**English** · [中文](README.zh-CN.md) · [Français](README.fr.md)

Author: Alex Hs

**Cross-border** commerce with **direct pay**, **clearing**, **direct sourcing**, and **transport**.

LeDirect is an open-source cross-border shop and the operations desk behind it. The buyer pays a landed price in local currency. That payment is direct pay: the price and the rate lock when the money arrives. Clearing matches every receipt, refund, and balance to an order. Direct sourcing buys the goods at origin. Transport takes them through an origin warehouse, sea or air, customs, and a local warehouse.

Sierra Leone is the reference corridor in this repository. Prices are in leones. One warehouse is in China, one is in Freetown. Mobile money is the cashier. To open another corridor, change the currency, the rate, the payment adapter, and the warehouse names. The order machine stays.

![LeDirect home, English](docs/home-en.png)

English is the source text. The Chinese and French files follow it.

## Cross-border

A cross-border order is one where the money stays in the buyer’s country and the goods start in another.

Two lanes share one account, one cart, and one payment:

- **Pre-order.** The platform buys after payment, receives the goods at the origin warehouse, and ships them in.
- **In stock.** The goods are already in the local warehouse. Checkout cannot sell past the quantity on hand.

The cart groups the two lanes and shows a different time promise on each. Checkout can turn one cart into two orders and still take one payment.

## Direct pay

Direct pay means the buyer pays this shop, in local currency, and the paid order is the contract.

- The sticker price is the landed price: purchase, origin handling, international freight, duty, tax, and destination handling. Checkout shows three lines: goods, international freight and tax, local delivery.
- Sea freight uses volume. Air freight uses chargeable weight. The air upgrade is the difference, calculated on the order.
- In-stock prices are a single figure plus local delivery. Pre-order prices are quoted delivered, then split on the bill so the freight is visible.
- Payment success writes the price and the exchange rate onto the order. A later rate move does not reopen a paid order. Unpaid carts take the new rate.
- A buffer sits on the platform’s books and in the exchange report. It is not added on top of the sticker price. The seed uses 3%. The rate itself is entered by finance, with a second person to activate it. A rate feed can replace that entry later.
- The shop does not store card numbers or wallet passwords. The cashier lives in a payment adapter. The server callback is the payment result. The page the buyer returns to is only a display.
- In the reference corridor the adapter is [Monime](https://monime.io): Orange Money, AfriMoney, card, bank transfer, and USSD. Until `MONIME_SECRET` is set, a demo cashier runs the same callback, idempotency, and reconciliation.
- Past the wallet ceiling, direct pay splits. A deposit locks the order and the price. The balance is a bank transfer. Finance confirms it, and only then does direct sourcing start. In the seed the ceiling is Le 13,500, the deposit is 30%, and an unfinished balance cancels after 72 hours with the deposit returned. Those values are settings.

## Clearing

Clearing is the book between the payment adapter and the order.

- Callbacks are signed and idempotent.
- Each day, order payments are matched to the provider’s settlement file. A difference becomes a finance ticket.
- A second successful payment on the same order is sent back.
- If the callback never arrived, finance can post the order from the provider reference.
- The refund follows the transport stage. In the reference rules: full refund before buying; 90% after buying and before the container; full refund when the platform cannot supply, fails inspection, or the price rose and the buyer did not accept; full refund or a free resend if the shipment is lost or more than 30 days past the promised window; the item refunded or resent on a quality claim within 7 days, with unboxing photos; the deposit returned in full if the balance is not paid in time.
- Exchange gain and loss is its own line in the finance report.
- A large refund needs a second reviewer. Price edits, refunds, and rate changes are written to the audit log with the person, the time, the old value, and the new value.

## Direct sourcing

Direct sourcing is how a listing gets onto the pre-order lane, and how a paid order gets bought.

A pre-order SKU is published only after five checks:

1. Measured weight and carton size.
2. English title, description, and at least three images.
3. A local market price, with the source and the date, so the landed price can be compared with the shop down the street.
4. An HS code, a duty band, and the name of the person who signed the classification.
5. A pass through the blocked-item list. The seed also holds back the 35% duty band.

Without measurements, an item can still be quoted. It cannot sit on the pre-order shelf. The buyer pastes a source link, a quantity, and a note. Staff return a price within 4 working hours. The quote lasts 24 hours. Payment then joins the same pre-order flow.

After direct pay, procurement buys the line and attaches the purchase record. The origin warehouse later attaches weight and photos. High-value lines can carry an unboxing video.

## Transport

Transport is the two warehouses and the leg between them.

The **origin warehouse** receives direct-sourced goods, weighs them, photographs them, and fills a container. In the reference corridor this warehouse is in China. For a buyer in the destination country, it sits overseas.

The **local warehouse** holds in-stock goods and receives containers after customs. It issues a pickup code or sends a local delivery. In the reference corridor this warehouse is in Freetown. For a team operating from the source country, that local warehouse is the overseas warehouse in the market.

Sea freight bills by cubic metre. The seed target is 6 CBM for the week. A thin week rolls forward. Air freight bills by chargeable weight, `max(actual, length × width × height / 6000)`. The buyer can switch a paid pre-order to air and pay the difference.

Pre-order states, in order:

`PENDING_PAYMENT` → `PAID` (price locked) → `PROCURING` → `PROCURED` → `IN_CN_WH` → `CONSOLIDATED` → `SHIPPED` (bill of lading) → `ARRIVED` → `CLEARING` (customs) → `IN_SL_WH` → `READY` → `COMPLETED`

A deposit uses `DEPOSIT_HELD` until the balance is confirmed. In-stock orders are shorter: paid, picking, ready, delivered. `CANCELLED` sits beside the main flow where the rules allow it.

The desk opens a warning when buying exceeds 72 hours, cargo sits in the origin warehouse more than 5 days, a sailing exceeds 49 days, or a local pickup waits more than 7 days.

Notices go out at payment, purchase, origin warehouse, sailing, arrival, and pickup. The reference channel is WhatsApp, with SMS for pickup codes and payment exceptions. Both are stored in the inbox until their keys exist.

## Reference corridor

| | Sierra Leone seed |
| --- | --- |
| Currency | Leone (SLE), integer prices |
| Direct pay | Monime: Orange Money, AfriMoney, card, bank, USSD |
| Clearing | Webhook, daily settlement match, stage-based refunds, 3% FX buffer on the books |
| Direct sourcing | China buying desk, paste-a-link quotes, five listing gates |
| Transport | China origin warehouse, weekly container, Freetown local warehouse, pickup or city delivery |
| Languages | English, Chinese, French |
| People | Shopper by phone. Staff desks for admin, operations, procurement, warehouse, support, and finance |

Diaspora checkout (`Shop for family`) prices in USD and pays by international card, then the same transport states deliver to a local recipient. Merchant applications, a wallet, image search, a source-catalog browser, and a live room are routed and stored. They use sample data until the matching key in `lib/channels.ts` is set.

## In this repository

Next.js 15, React 19, TypeScript, Tailwind, SQLite at `data/ledirect.sqlite`.

| Path | What it owns |
| --- | --- |
| `lib/pricing.ts` | Integer money, landed cost, sea and air freight |
| `lib/states.ts` | Cross-border status flow and refund stages |
| `lib/commerce.ts` | Cart, direct pay, clearing, direct sourcing, containers, refunds |
| `lib/channels.ts` | Payment, WhatsApp, SMS, catalog, image search, and the other external ports |
| `scripts/uat.ts` | The acceptance walk |
| `scripts/backup.ts` | Backups in `data/backups`, kept 30 days |

Demo mode is on in the seed. The site stays out of search indexes until demo mode is turned off in settings. A GA4 id (`G-…`) or a Meta pixel id loads those tags only after that. Stop the app before copying a backup over `data/ledirect.sqlite` and `data/uploads`.

The brand name is a working title.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and walk the full path from `/demo`.

Customer: `+232 76 111 001` (Aminata Bangura). The sign-in code is shown on the page.

Staff: `ada@ledirect.demo` and password `Demo#2026`, then the second code on the staff page. The same password works for `ibrahim@`, `wei@`, `mamusu@`, `fanta@`, `joseph@`, and `amadu@` at `ledirect.demo`.

```bash
npm run uat
npm run backup
```

Completion note, in Chinese, English, and French: open [docs/index.html](docs/index.html) in a browser. The live demo is [https://19781231.xyz](https://19781231.xyz). The project is MIT licensed. You are welcome to adapt it. Write to bigbrogbpwin@gmail.com if you need something.

完成度说明（中文、英文、法文）在 [docs/index.html](docs/index.html)，用浏览器打开。线上演示是 [https://19781231.xyz](https://19781231.xyz)。MIT 许可证，欢迎自己定制使用。有需要可以联系 bigbrogbpwin@gmail.com。

Note d'avancement en chinois, anglais et français : ouvrir [docs/index.html](docs/index.html) dans un navigateur. Démo : [https://19781231.xyz](https://19781231.xyz). Licence MIT. Vous pouvez l'adapter. Écrivez à bigbrogbpwin@gmail.com si besoin.

## Releases

The chapters above are the first public text. Later iterations are recorded beside them and do not replace them.

- [Changelog](CHANGELOG.md) · [中文](CHANGELOG.zh-CN.md) · [Français](CHANGELOG.fr.md)
- [0.2.0 iteration note](docs/iteration-2026-10-24.html), in Chinese, English, and French
- First completion note: [docs/index.html](docs/index.html)

## License

[MIT](LICENSE). Copyright © 2026 Alex Hs <bigbrogbpwin@gmail.com>. The English license text governs. Chinese and French in that file are there for reading.
