# Changelog

English is the source text. [中文](CHANGELOG.zh-CN.md) · [Français](CHANGELOG.fr.md)

This file records iterations. It does not replace the product chapters in [README.md](README.md) or the first completion note in [docs/index.html](docs/index.html).

The format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-24

### Added

- Hosted Monime checkout when `MONIME_SECRET` and `MONIME_SPACE_ID` are both set. The buyer returns to `APP_ORIGIN`. The server callback is still the only payment result.
- A finance action that pulls Monime credits from the last 36 hours. A settlement file may use `external_ref,amount_sle` in leones, or `reference,value` in cents.
- Orange Money and AfriMoney refunds go back through Monime when that cashier is live. Card and bank refunds open a finance ticket.
- WhatsApp sends when `BSP_TOKEN` and `BSP_URL` are both set. SMS sends pickup codes and payment exceptions when `SMS_TOKEN` and `SMS_URL` are both set.
- `POST /api/cron/daily` with `Authorization: Bearer <CRON_SECRET>` runs the backup, sends queued refunds and messages, and pulls Monime credits when those keys exist.
- A bought line now requires the purchase record. Arrival at the origin warehouse requires the weighing photo. Grams can be stored on that step.
- Iteration note, in Chinese, English, and French: [docs/iteration-2026-10-24.html](docs/iteration-2026-10-24.html).

### Fixed

- `reportNote` and `desk` require a staff session.
- Customer sessions expire after 30 days. Staff sessions expire after 12 hours.
- The staff second code allows 5 tries in 10 minutes.
- Production refuses the webhook secret published in the repository.
- Demo order advance and demo database reset stop once Monime is configured.
- Staff roles are limited to admin, operations, procurement, warehouse, support, and finance. An admin cannot change their own seat. The last active admin stays.
- Settings can no longer write the webhook secret or the sequence counters.
- An upload with no registry row is not served.
- Order photos, the home images, and the live video accept a site path or an https URL with no user or password.
- The health check reports whether a backup exists. It does not name the folder.
- Sign-in codes are compared at equal length.
- Demo passwords stay on the sign-in pages only while demo mode is on.
- Response headers block a replaced base address, plugins, and forms that post to another site. Production also sends HSTS.

### Unchanged

- With the new keys empty, the demo cashier, the inbox, and wallet refunds behave as in 0.1.0.
- The 1688 catalog, photo search, the live room, and the native app buttons still use sample data.

[0.2.0]: https://github.com/bigbrogbpwin-ux/Ledirect-shop/releases/tag/v0.2.0
