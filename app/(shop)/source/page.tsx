import { ProductCard } from "@/components/card";
import { getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { type ProductRow } from "@/lib/commerce";
import { t } from "@/lib/i18n";

export default async function SourcePage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const page = Math.max(1, Number(sp.page || "1"));
  const q = (sp.q || "").trim();
  const where = q ? "AND (title_en LIKE ? OR title_zh LIKE ? OR shop_name LIKE ?)" : "";
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
  const rows = many<ProductRow>(
    `SELECT * FROM products WHERE status = 'live' AND source = '1688' ${where} ORDER BY sales_count_src DESC LIMIT 24 OFFSET ?`,
    ...params,
    (page - 1) * 24,
  );
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "source_title")}</h1>
      <p className="mt-2 max-w-xl text-sm">{t(lang, "source_body")}</p>
      <form action="/source" className="mt-3 flex gap-2">
        <input name="q" defaultValue={q} className="min-h-11 flex-1 border border-line bg-white px-2" />
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "search_ph")}</button>
      </form>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((product) => <ProductCard key={product.id} product={product} lang={lang} />)}
      </div>
      <div className="mt-4 flex gap-3 text-sm">
        {page > 1 ? <a className="underline" href={`/source?page=${page - 1}&q=${encodeURIComponent(q)}`}>{t(lang, "back")}</a> : null}
        <a className="underline" href={`/source?page=${page + 1}&q=${encodeURIComponent(q)}`}>{t(lang, "next")}</a>
      </div>
    </div>
  );
}
