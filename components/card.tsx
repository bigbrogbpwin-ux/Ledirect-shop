import Link from "next/link";
import { Photo } from "@/components/photo";
import { le } from "@/lib/format";
import { pick, t, type Lang } from "@/lib/i18n";
import { priceOf, type ProductRow } from "@/lib/commerce";

export function ProductCard({ product, lang }: { product: ProductRow; lang: Lang }) {
  const price = priceOf(product).priceSle;
  const images = JSON.parse(product.images || "[]") as string[];
  const title = pick(lang, product as unknown as Record<string, unknown>, "title");
  const local = product.local_market_sle || 0;
  const save = local > price ? Math.round((1 - price / local) * 100) : 0;
  return (
    <Link href={`/p/${product.id}`} className="block border border-line bg-white">
      <div className="aspect-square bg-mist">
        <Photo src={images[0] || ""} alt={title} sku={product.sku} cat={product.visual_key || "phone"} />
      </div>
      <div className="p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-sea">{product.zone === "instock" ? t(lang, "stock_badge") : t(lang, "sea_badge")}</p>
        <p className="mt-1 line-clamp-2 min-h-12">{title}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{le(price)}</p>
        {local ? (
          <p className="text-xs text-gold">
            {t(lang, "local_price")} {le(local)}
            {save ? ` · ${save}%` : ""}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mb-4 border border-coral bg-white px-3 py-2 text-sm text-coral">{error}</p>;
}
