import Link from "next/link";
import { ProductCard, ErrorNote } from "@/components/card";
import { getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { type ProductRow } from "@/lib/commerce";
import { t } from "@/lib/i18n";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const q = (sp.q || "").trim();
  const rows = q
    ? many<ProductRow>(
        "SELECT * FROM products WHERE status = 'live' AND source != 'quote' AND (title_en LIKE ? OR title_zh LIKE ? OR title_fr LIKE ? OR tags LIKE ? OR sku LIKE ?) ORDER BY sold_count DESC LIMIT 40",
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
      )
    : [];
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "search_ph")}</h1>
      <ErrorNote error={sp.error} />
      <form action="/search" className="mt-3 flex gap-2">
        <input name="q" defaultValue={q} className="min-h-11 flex-1 border border-line bg-white px-3" />
        <Link href="/visual" className="min-h-11 border border-line bg-white px-3 leading-[44px]">{t(lang, "visual_title")}</Link>
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "search_ph")}</button>
      </form>
      {q && !rows.length ? (
        <div className="mt-6 border border-line bg-white p-4">
          <p>{t(lang, "search_empty")}</p>
          <Link href="/link" className="mt-3 inline-block min-h-11 bg-coral px-4 leading-[44px] text-white">{t(lang, "quote_cta")}</Link>
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((product) => (
          <ProductCard key={product.id} product={product} lang={lang} />
        ))}
      </div>
    </div>
  );
}
