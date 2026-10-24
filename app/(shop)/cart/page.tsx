import Link from "next/link";
import { qtyAction } from "@/app/actions";
import { Bill } from "@/components/bill";
import { Track } from "@/components/dock";
import { ErrorNote } from "@/components/card";
import { getLang, readCartToken } from "@/lib/auth";
import { cartLines, priceCart } from "@/lib/commerce";
import { le } from "@/lib/format";
import { pick, t } from "@/lib/i18n";

export default async function CartPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const lines = cartLines(await readCartToken());
  const priced = priceCart(lines, "pickup", false);
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "cart_title")}</h1>
      {lines.length ? <Track event="view_cart" params={{ value: priced.grand, items: lines.length }} /> : null}
      <ErrorNote error={sp.error} />
      {!lines.length ? <p className="mt-6">{t(lang, "cart_empty")}</p> : null}
      <div className="mt-4 space-y-6">
        {priced.zones.map((zone) => (
          <section key={zone.zone} className="border border-line bg-white p-3">
            <h2 className="text-sm uppercase tracking-[0.14em] text-sea">{zone.zone === "instock" ? t(lang, "stock_badge") : t(lang, "sea_badge")}</h2>
            {zone.lines.map((line) => (
              <div key={line.itemId} className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <div>
                  <Link href={`/p/${line.product.id}`} className="font-medium">{pick(lang, line.product as unknown as Record<string, unknown>, "title")}</Link>
                  {line.variant ? <p className="text-xs">{line.variant.label}</p> : null}
                  <p className="text-sm">{le(line.unit)}</p>
                </div>
                <form action={qtyAction} className="flex items-center gap-2">
                  <input type="hidden" name="item" value={line.itemId} />
                  <button name="qty" value={line.qty - 1} className="min-h-11 min-w-11 border border-line">-</button>
                  <span>{line.qty}</span>
                  <button name="qty" value={line.qty + 1} className="min-h-11 min-w-11 border border-line">+</button>
                </form>
              </div>
            ))}
          </section>
        ))}
      </div>
      {lines.length ? (
        <div className="mt-4">
          <p className="mb-2 text-sm">{t(lang, "both_zones")}</p>
          <Bill lang={lang} goods={priced.zones.reduce((s, z) => s + z.goods, 0)} intl={priced.zones.reduce((s, z) => s + z.intl, 0)} delivery={0} total={priced.grand} showIntl={priced.zones.some((z) => z.zone === "preorder")} />
          <Link href="/checkout" className="mt-4 flex min-h-12 items-center justify-center bg-coral px-4 text-white">{t(lang, "checkout")}</Link>
        </div>
      ) : (
        <Link href="/shop" className="mt-4 inline-block underline">{t(lang, "nav_shop")}</Link>
      )}
    </div>
  );
}
