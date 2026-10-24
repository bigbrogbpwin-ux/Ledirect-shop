import Link from "next/link";
import { visualAction } from "@/app/actions";
import { ProductCard, ErrorNote } from "@/components/card";
import { getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { type ProductRow } from "@/lib/commerce";
import { t } from "@/lib/i18n";

const SAMPLES = ["phone", "solar", "beauty", "home", "moto", "apparel"];

export default async function VisualPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const sample = sp.sample;
  const ids = (sp.ids || "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0).slice(0, 12);
  let rows: ProductRow[] = [];
  if (ids.length) rows = many<ProductRow>(`SELECT * FROM products WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids);
  else if (sample) rows = many<ProductRow>("SELECT * FROM products WHERE visual_key = ? AND status = 'live' AND source != 'quote' ORDER BY is_hot DESC LIMIT 8", sample);
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "visual_title")}</h1>
      <p className="mt-2 max-w-xl text-sm">{t(lang, "visual_help")}</p>
      <ErrorNote error={sp.error} />
      <form action={visualAction} className="mt-4 space-y-2">
        <input name="image" type="file" accept="image/*" capture="environment" required className="block" />
        <button className="min-h-12 bg-coral px-4 text-white" type="submit">{t(lang, "upload")}</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {SAMPLES.map((cat) => (
          <Link key={cat} href={`/visual?sample=${cat}`} className="min-h-11 border border-line bg-white px-3 leading-[44px] text-sm">{t(lang, "sample")} · {cat}</Link>
        ))}
      </div>
      {sp.file ? <img src={sp.file} alt="" className="mt-4 h-32 w-32 object-cover" /> : null}
      {sp.cat ? <p className="mt-3 text-sm">{t(lang, "visual_hit")}: {sp.cat}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((product) => <ProductCard key={product.id} product={product} lang={lang} />)}
      </div>
    </div>
  );
}
