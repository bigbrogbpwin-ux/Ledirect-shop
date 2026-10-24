import { ProductCard, ErrorNote } from "@/components/card";
import { getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { priceOf, type ProductRow } from "@/lib/commerce";
import { t } from "@/lib/i18n";

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const zone = sp.zone === "instock" || sp.zone === "preorder" ? sp.zone : "";
  const cat = sp.cat || "";
  const sort = sp.sort || "new";
  const min = Number(sp.min || "0");
  const max = Number(sp.max || "0");
  const where = ["status = 'live'", "source = 'catalog'"];
  const params: unknown[] = [];
  if (zone) {
    where.push("zone = ?");
    params.push(zone);
  }
  if (cat) {
    where.push("category_id = (SELECT id FROM categories WHERE slug = ?)");
    params.push(cat);
  }
  const order = sort === "sold" ? "sold_count DESC" : sort === "price" ? "purchase_cny_fen ASC" : "id DESC";
  let rows = many<ProductRow>(`SELECT * FROM products WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 48`, ...params);
  if (min || max) {
    rows = rows.filter((row) => {
      const price = priceOf(row).priceSle;
      if (min && price < min) return false;
      if (max && price > max) return false;
      return true;
    });
  }
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "nav_shop")}</h1>
      <ErrorNote error={sp.error} />
      <form className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6" action="/shop">
        <select name="zone" defaultValue={zone} className="min-h-11 border border-line bg-white px-2">
          <option value="">{t(lang, "filter_all")}</option>
          <option value="instock">{t(lang, "zone_stock_title")}</option>
          <option value="preorder">{t(lang, "zone_sea_title")}</option>
        </select>
        <input name="cat" defaultValue={cat} placeholder={t(lang, "category")} className="min-h-11 border border-line bg-white px-2" />
        <select name="sort" defaultValue={sort} className="min-h-11 border border-line bg-white px-2">
          <option value="new">{t(lang, "sort_new")}</option>
          <option value="sold">{t(lang, "sort_sold")}</option>
          <option value="price">{t(lang, "sort_price")}</option>
        </select>
        <input name="min" defaultValue={sp.min || ""} placeholder={t(lang, "min_price")} className="min-h-11 border border-line bg-white px-2" />
        <input name="max" defaultValue={sp.max || ""} placeholder={t(lang, "max_price")} className="min-h-11 border border-line bg-white px-2" />
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "search_ph")}</button>
      </form>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((product) => (
          <ProductCard key={product.id} product={product} lang={lang} />
        ))}
      </div>
    </div>
  );
}
