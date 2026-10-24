import Link from "next/link";
import { ProductCard } from "@/components/card";
import { getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { priceOf, type ProductRow } from "@/lib/commerce";
import { usdFromCents } from "@/lib/format";
import { t } from "@/lib/i18n";
import { sleToUsdCents } from "@/lib/pricing";
import { activeFx } from "@/lib/settings";

export default async function FamilyPage() {
  const lang = await getLang();
  const fx = activeFx();
  const rows = many<ProductRow>("SELECT * FROM products WHERE status = 'live' AND source = 'catalog' AND is_hot = 1 LIMIT 4");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "family_title")}</h1>
      <p className="mt-2 max-w-xl text-sm">{t(lang, "family_body")}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((product) => (
          <div key={product.id}>
            <ProductCard product={product} lang={lang} />
            <p className="mt-1 text-sm">{usdFromCents(sleToUsdCents(priceOf(product).priceSle, fx))}</p>
          </div>
        ))}
      </div>
      <Link href="/checkout?source=diaspora" className="mt-6 inline-block min-h-12 bg-coral px-4 leading-[48px] text-white">{t(lang, "checkout")}</Link>
    </div>
  );
}
