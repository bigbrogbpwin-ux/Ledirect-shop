import { productAction, pullPhotoAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many, one } from "@/lib/db";
import { gateCheck, priceOf, type ProductRow } from "@/lib/commerce";
import { le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function ProductEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const staff = await requireStaffRole(["ops"]);
  const { id } = await params;
  const sp = await searchParams;
  const lang = await getLang();
  const product = id === "new" ? null : one<ProductRow>("SELECT * FROM products WHERE id = ?", Number(id));
  const cats = many<{ id: number; name_en: string }>("SELECT id, name_en FROM categories ORDER BY sort");
  const priced = product ? priceOf(product) : null;
  const gates = product ? gateCheck(product) : { ok: false, missing: ["New draft"] };
  const images = product ? (JSON.parse(product.images || "[]") as string[]) : [];
  return (
    <div>
      <h1 className="text-3xl font-semibold">{product?.sku || t(lang, "products")}</h1>
      <ErrorNote error={sp.error} />
      <p className="mt-2 text-sm">{t(lang, "gates")}: {gates.ok ? "ready" : gates.missing.join("; ")}</p>
      {priced ? <p className="text-sm">{t(lang, "calc")} {le(priced.priceSle)} · floor {le(priced.minMarketingSle)} · cost {le(priced.costSle)}</p> : null}
      <form action={productAction} className="mt-4 grid gap-2 md:grid-cols-2">
        <input type="hidden" name="id" value={product?.id || ""} />
        <input name="sku" defaultValue={product?.sku || ""} placeholder="SKU" required className="min-h-11 border border-line bg-white px-2" />
        <select name="zone" defaultValue={product?.zone || "preorder"} className="min-h-11 border border-line bg-white px-2">
          <option value="instock">instock</option>
          <option value="preorder">preorder</option>
        </select>
        <select name="category_id" defaultValue={String(product?.category_id || "")} className="min-h-11 border border-line bg-white px-2">
          {cats.map((cat) => <option key={cat.id} value={cat.id}>{cat.name_en}</option>)}
        </select>
        <input name="visual_key" defaultValue={product?.visual_key || "phone"} className="min-h-11 border border-line bg-white px-2" />
        <input name="title_en" defaultValue={product?.title_en || ""} placeholder="English title" className="min-h-11 border border-line bg-white px-2 md:col-span-2" />
        <input name="title_zh" defaultValue={product?.title_zh || ""} placeholder="中文标题" className="min-h-11 border border-line bg-white px-2" />
        <input name="title_fr" defaultValue={product?.title_fr || ""} placeholder="Titre français" className="min-h-11 border border-line bg-white px-2" />
        <textarea name="description_en" defaultValue={product?.description_en || ""} className="min-h-24 border border-line bg-white p-2 md:col-span-2" />
        <input name="weight_g" defaultValue={product?.weight_g || ""} placeholder="grams" className="min-h-11 border border-line bg-white px-2" />
        <input name="length_cm" defaultValue={product?.length_cm || ""} placeholder="L cm" className="min-h-11 border border-line bg-white px-2" />
        <input name="width_cm" defaultValue={product?.width_cm || ""} placeholder="W cm" className="min-h-11 border border-line bg-white px-2" />
        <input name="height_cm" defaultValue={product?.height_cm || ""} placeholder="H cm" className="min-h-11 border border-line bg-white px-2" />
        <input name="purchase_cny" defaultValue={product ? product.purchase_cny_fen / 100 : ""} placeholder="CNY" className="min-h-11 border border-line bg-white px-2" />
        <input name="duty_pct" defaultValue={product ? product.duty_bps / 100 : 10} placeholder="duty %" className="min-h-11 border border-line bg-white px-2" />
        <input name="margin_pct" defaultValue={product ? product.margin_bps / 100 : 35} placeholder="margin %" className="min-h-11 border border-line bg-white px-2" />
        <input name="hs_code" defaultValue={product?.hs_code || ""} placeholder="HS" className="min-h-11 border border-line bg-white px-2" />
        <input name="hs_signed_by" defaultValue={product?.hs_signed_by || staff.name} placeholder="signed by" className="min-h-11 border border-line bg-white px-2" />
        <input name="local_market_sle" defaultValue={product?.local_market_sle || ""} placeholder="local Le" className="min-h-11 border border-line bg-white px-2" />
        <input name="local_market_source" defaultValue={product?.local_market_source || ""} placeholder="source" className="min-h-11 border border-line bg-white px-2" />
        <input name="local_market_date" defaultValue={product?.local_market_date || ""} placeholder="YYYY-MM-DD" className="min-h-11 border border-line bg-white px-2" />
        <input name="stock" defaultValue={product?.stock ?? ""} placeholder="stock" className="min-h-11 border border-line bg-white px-2" />
        <input name="marketing_price_sle" defaultValue={product?.marketing_price_sle || ""} placeholder={t(lang, "marketing")} className="min-h-11 border border-line bg-white px-2" />
        <input name="supplier_name" defaultValue={product?.supplier_name || ""} placeholder="supplier" className="min-h-11 border border-line bg-white px-2" />
        <input name="tags" defaultValue={product?.tags || ""} placeholder="tags" className="min-h-11 border border-line bg-white px-2" />
        <input type="hidden" name="images" value={images.join(" ")} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="hot" value="1" defaultChecked={product?.is_hot === 1} />{t(lang, "hot_flag")}</label>
        <input name="photos" type="file" accept="image/*" multiple className="md:col-span-2" />
        <div className="flex gap-2 md:col-span-2">
          <button className="min-h-11 border border-line bg-white px-3" name="publish" value="0" type="submit">{t(lang, "draft")}</button>
          <button className="min-h-11 bg-coral px-3 text-white" name="publish" value="1" type="submit">{t(lang, "publish")}</button>
        </div>
      </form>
      {product ? (
        <form action={pullPhotoAction} className="mt-3">
          <input type="hidden" name="id" value={product.id} />
          <button className="min-h-11 underline" type="submit">{t(lang, "pull_photo")}</button>
        </form>
      ) : null}
      <div className="mt-3 flex gap-2">
        {images.map((src) => <img key={src} src={src} alt="" className="h-20 w-20 object-cover" />)}
      </div>
    </div>
  );
}
