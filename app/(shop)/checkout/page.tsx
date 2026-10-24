import { checkoutAction } from "@/app/actions";
import { Bill } from "@/components/bill";
import { Track } from "@/components/dock";
import { ErrorNote } from "@/components/card";
import { currentUser, getLang, readCartToken } from "@/lib/auth";
import { applyCoupon, cartLines, priceCart, quoteCoupon, RuleError } from "@/lib/commerce";
import { many } from "@/lib/db";
import { le, usdFromCents } from "@/lib/format";
import { t } from "@/lib/i18n";
import { sleToUsdCents } from "@/lib/pricing";
import { activeFx } from "@/lib/settings";
import { redirect } from "next/navigation";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(sp.source === "diaspora" ? "/checkout?source=diaspora" : "/checkout")}`);
  const lang = await getLang();
  const lines = cartLines(await readCartToken());
  if (!lines.length) redirect("/cart");
  const air = sp.air === "1";
  const ship = (sp.ship === "freetown" || sp.ship === "upcountry" ? sp.ship : "pickup") as "pickup" | "freetown" | "upcountry";
  const kind = ship === "upcountry" ? "partner" : "local";
  const points = many<{ id: number; name: string; address: string; city: string; fee_sle: number; hours: string }>(
    "SELECT id, name, address, city, fee_sle, hours FROM pickup_points WHERE active = 1 AND kind = ? ORDER BY id",
    kind,
  );
  const picked = points.find((point) => String(point.id) === sp.pickup) || points[0];
  let priced = priceCart(lines, ship, air, ship === "upcountry" ? picked?.fee_sle || 0 : 0);
  let couponNote = "";
  if (sp.coupon) {
    try {
      const source = sp.source === "diaspora" ? "diaspora" : "catalog";
      priced = applyCoupon(priced, quoteCoupon(user.id, sp.coupon, priced, source));
    } catch (error) {
      couponNote = error instanceof RuleError ? error.message : "";
    }
  }
  const wallet = (await import("@/lib/db")).one<{ balance_sle: number; frozen_sle: number }>("SELECT balance_sle, frozen_sle FROM wallets WHERE user_id = ?", user.id);
  const instockMerch = priced.zones.find((z) => z.zone === "instock");
  const gap = instockMerch ? Math.max(0, priced.settings.free_delivery_sle - (instockMerch.goods + instockMerch.intl)) : 0;
  const source = sp.source === "diaspora" ? "diaspora" : lines.some((l) => l.product.source === "1688") ? "1688" : "catalog";
  const fx = activeFx();
  const keep = new URLSearchParams();
  if (source === "diaspora") keep.set("source", "diaspora");
  if (sp.coupon) keep.set("coupon", sp.coupon);
  if (air) keep.set("air", "1");
  const shipHref = (next: string) => {
    const q = new URLSearchParams(keep);
    q.set("ship", next);
    return `/checkout?${q.toString()}`;
  };
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold">{t(lang, "checkout")}</h1>
      <Track event="begin_checkout" params={{ value: priced.grand }} />
      <ErrorNote error={sp.error} />
      {couponNote ? <p className="mt-3 border border-coral bg-white p-3 text-sm">{couponNote}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <a className={`min-h-11 border px-3 leading-[44px] ${ship === "pickup" ? "border-sea bg-white" : "border-line"}`} href={shipHref("pickup")}>{t(lang, "pickup")}</a>
        <a className={`min-h-11 border px-3 leading-[44px] ${ship === "freetown" ? "border-sea bg-white" : "border-line"}`} href={shipHref("freetown")}>{t(lang, "deliver")}</a>
        <a className={`min-h-11 border px-3 leading-[44px] ${ship === "upcountry" ? "border-sea bg-white" : "border-line"}`} href={shipHref("upcountry")}>{t(lang, "upcountry")}</a>
      </div>
      <form action={checkoutAction} className="mt-4 space-y-3">
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="ship" value={ship} />
        {ship === "upcountry" ? <p className="text-xs text-ink/70">{t(lang, "upcountry_note")}</p> : null}
        {gap > 0 && ship === "freetown" ? <p className="text-sm">{t(lang, "free_gap")} {le(gap)}</p> : null}
        {instockMerch && gap === 0 && ship === "freetown" ? <p className="text-sm">{t(lang, "free_met")}</p> : null}
        {ship !== "freetown" ? (
          <select name="pickup" defaultValue={picked?.id} className="min-h-11 w-full border border-line bg-white px-2">
            {points.map((point) => (
              <option key={point.id} value={point.id}>
                {point.city} — {point.name} — {point.fee_sle ? le(point.fee_sle) : t(lang, "free")}
              </option>
            ))}
          </select>
        ) : null}
        <input name="name" defaultValue={user.name} placeholder={t(lang, "name")} className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="phone" defaultValue={user.phone} placeholder={t(lang, "phone")} className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="area" defaultValue={ship === "upcountry" ? picked?.city || "Bo" : "freetown"} placeholder={t(lang, "area")} className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="line" placeholder={t(lang, "address_line")} className="min-h-11 w-full border border-line bg-white px-2" />
        {priced.zones.some((z) => z.zone === "preorder") ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="air" value="1" defaultChecked={air} />
            {t(lang, "air")} ({le(priced.zones.reduce((s, z) => s + z.lines.reduce((n, l) => n + (z.zone === "preorder" ? l.airDelta * l.qty : 0), 0), 0))})
          </label>
        ) : null}
        {source === "diaspora" ? (
          <fieldset className="space-y-2 border border-line p-3">
            <legend className="px-1 text-sm">{t(lang, "recipient")}</legend>
            <input name="rname" placeholder={t(lang, "name")} className="min-h-11 w-full border border-line px-2" />
            <input name="rphone" placeholder={t(lang, "phone")} className="min-h-11 w-full border border-line px-2" />
            <input name="rcity" defaultValue="Freetown" placeholder={t(lang, "city")} className="min-h-11 w-full border border-line px-2" />
            <input name="rline" placeholder={t(lang, "address_line")} className="min-h-11 w-full border border-line px-2" />
            <p className="text-sm">{t(lang, "usd_ref")} {usdFromCents(sleToUsdCents(priced.grand, fx))}</p>
          </fieldset>
        ) : null}
        <input name="coupon" defaultValue={priced.couponCode || sp.coupon || ""} placeholder={t(lang, "coupon_ph")} className="min-h-11 w-full border border-line bg-white px-2" />
        <p className="text-xs text-ink/60">WELCOME500 · SEA10 · FAMILY200</p>
        {(wallet?.balance_sle || 0) > 0 ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="wallet" value="1" />
            {t(lang, "wallet_pay")} ({le(wallet?.balance_sle || 0)})
          </label>
        ) : null}
        {(wallet?.frozen_sle || 0) > 0 ? <p className="text-xs">{t(lang, "held_wallet")} {le(wallet?.frozen_sle || 0)}</p> : null}
        {priced.split ? <p className="text-sm">{t(lang, "split_note")}</p> : null}
        <Bill
          lang={lang}
          goods={priced.zones.reduce((s, z) => s + z.goods, 0)}
          intl={priced.zones.reduce((s, z) => s + z.intl, 0)}
          delivery={priced.zones.reduce((s, z) => s + z.delivery, 0)}
          discount={priced.discount}
          deliveryLabel={ship === "upcountry" ? t(lang, "partner_fee") : undefined}
          total={priced.grand}
          showIntl={priced.zones.some((z) => z.zone === "preorder")}
        />
        {priced.split ? (
          <p className="text-sm">{t(lang, "deposit")} {le(priced.deposit)} · {t(lang, "balance")} {le(priced.balance)}</p>
        ) : null}
        <button className="min-h-11 border border-line px-3" formAction="/checkout" formMethod="get" type="submit">{t(lang, "coupon_apply")}</button>
        <button className="min-h-12 w-full bg-coral text-white" type="submit">{t(lang, "pay_now")}</button>
      </form>
    </div>
  );
}
