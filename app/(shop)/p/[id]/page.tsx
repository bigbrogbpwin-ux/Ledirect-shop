import { addCartAction } from "@/app/actions";
import { Bill } from "@/components/bill";
import { ErrorNote } from "@/components/card";
import { Photo } from "@/components/photo";
import { Track } from "@/components/dock";
import { getLang } from "@/lib/auth";
import { many, one } from "@/lib/db";
import { priceOf, type ProductRow } from "@/lib/commerce";
import { le, usdFromCents } from "@/lib/format";
import { pick, t } from "@/lib/i18n";
import { presentSplit, sleToUsdCents } from "@/lib/pricing";
import { activeFx } from "@/lib/settings";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const lang = await getLang();
  const product = one<ProductRow>("SELECT * FROM products WHERE id = ? AND status = 'live'", Number(id));
  if (!product) notFound();
  const variants = many<{ id: number; label: string; price_delta_sle: number; stock: number | null }>("SELECT id, label, price_delta_sle, stock FROM variants WHERE product_id = ?", product.id);
  const variant = variants.find((item) => String(item.id) === sp.v) || variants[0] || null;
  const quote = priceOf(product);
  const shown = presentSplit(product.zone === "instock" ? "instock" : "preorder", quote, variant?.price_delta_sle || 0);
  const images = JSON.parse(product.images || "[]") as string[];
  const highlights = JSON.parse(pick(lang, product as unknown as Record<string, unknown>, "highlights") || "[]") as string[];
  const reviews = many<{ user_name: string; rating: number; body: string; reply: string | null }>("SELECT user_name, rating, body, reply FROM reviews WHERE product_id = ? ORDER BY id DESC", product.id);
  const title = pick(lang, product as unknown as Record<string, unknown>, "title");
  const fx = activeFx();
  const usd = usdFromCents(sleToUsdCents(shown.shelf, fx));
  const stock = variant?.stock ?? product.stock;
  const blocked = product.zone === "instock" && (stock ?? 0) <= 0;
  const local = product.local_market_sle || 0;
  return (
    <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
      <Track event="view_item" params={{ id: product.id, price: shown.shelf }} />
      <div>
        <div className="grid grid-cols-3 gap-2">
          {images.slice(0, 3).map((src) => (
            <div key={src} className="aspect-square bg-mist">
              <Photo src={src} alt={title} sku={product.sku} cat={product.visual_key || "phone"} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <ErrorNote error={sp.error} />
        <p className="text-xs uppercase tracking-[0.14em] text-sea">{product.zone === "instock" ? t(lang, "stock_badge") : t(lang, "sea_badge")}</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight">{title}</h1>
        <p className="mt-3 text-4xl font-semibold tracking-tight">{le(shown.shelf)}</p>
        <p className="text-sm text-ink/70">{t(lang, "usd_ref")} {usd}</p>
        {local ? <p className="mt-1 text-sm text-gold">{t(lang, "local_price")} {le(local)}</p> : null}
        <p className="mt-3 text-sm">{product.zone === "instock" ? t(lang, "instock_includes") : t(lang, "includes")}</p>
        <p className="mt-3 text-sm leading-6">{pick(lang, product as unknown as Record<string, unknown>, "description")}</p>
        <ul className="mt-3 list-disc pl-5 text-sm">
          {highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {product.zone === "instock" && stock != null && stock <= 5 ? <p className="mt-2 text-sm">{stock} {t(lang, "left")}</p> : null}
        <p className="mt-1 text-xs text-ink/60">{product.sold_count} {t(lang, "sold")}</p>
        {product.source === "1688" ? <p className="mt-2 text-sm">{t(lang, "shop1688")}: {product.shop_name} · {t(lang, "sales_src")} {product.sales_count_src}</p> : null}
        {variants.length ? (
          <div className="mt-4 flex gap-2">
            {variants.map((item) => (
              <Link key={item.id} href={`/p/${product.id}?v=${item.id}`} className={`min-h-11 border px-3 leading-[42px] ${variant?.id === item.id ? "border-sea bg-sea text-white" : "border-line bg-white"}`}>
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
        <form action={addCartAction} className="mt-4 flex gap-2">
          <input type="hidden" name="product" value={product.id} />
          <input type="hidden" name="variant" value={variant?.id || ""} />
          <input type="hidden" name="back" value={`/p/${product.id}`} />
          <input name="qty" type="number" min={1} defaultValue={1} className="min-h-11 w-20 border border-line bg-white px-2" />
          <button disabled={blocked} className="min-h-11 flex-1 bg-coral px-4 text-white disabled:opacity-40" type="submit">{blocked ? t(lang, "out") : t(lang, "add")}</button>
        </form>
        <div className="mt-4">
          <Bill lang={lang} goods={shown.goods} intl={shown.intl} delivery={0} total={shown.shelf} showIntl={product.zone !== "instock"} />
        </div>
        <div className="mt-4 border border-line bg-white p-3 text-sm">
          <p className="font-semibold">{t(lang, "compare")}</p>
          <p>{t(lang, "local_price")} {le(local)} · Kissy market · 2026-10-18</p>
          <p className="mt-1 text-ink/70">{t(lang, "compare_ext")}</p>
        </div>
        <Link href={`/visual?sample=${product.visual_key || "phone"}`} className="mt-3 inline-block min-h-11 text-sm underline">{t(lang, "visual_title")}</Link>
        <div className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold">{t(lang, "reviews")}</h2>
          {reviews.map((review) => (
            <article key={review.body} className="border border-line bg-white p-3 text-sm">
              <p className="font-medium">{review.user_name} · {review.rating}/5</p>
              <p className="mt-1">{review.body}</p>
              {review.reply ? <p className="mt-1 text-ink/70">{review.reply}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
