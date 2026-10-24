import Link from "next/link";
import { ProductCard } from "@/components/card";
import { ShipTrack } from "@/components/bill";
import { getLang } from "@/lib/auth";
import { containerProgress, type ProductRow } from "@/lib/commerce";
import { many, one } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { pick, t } from "@/lib/i18n";

export default async function HomePage() {
  const lang = await getLang();
  const settings = getSettings();
  const box = containerProgress();
  const hot = many<ProductRow>("SELECT * FROM products WHERE status = 'live' AND is_hot = 1 AND source = 'catalog' ORDER BY sold_count DESC LIMIT 8");
  const cats = many<{ slug: string; name_en: string; name_zh: string; name_fr: string }>("SELECT slug, name_en, name_zh, name_fr FROM categories ORDER BY sort");
  const unbox = many<{ id: number; title_en: string; title_zh: string; title_fr: string; image: string }>("SELECT id, title_en, title_zh, title_fr, image FROM posts WHERE kind = 'unbox' AND published = 1 ORDER BY sort LIMIT 3");
  const orders = one<{ c: number }>("SELECT COUNT(*) AS c FROM orders WHERE price_locked = 1")?.c || 0;
  const containers = one<{ c: number }>("SELECT COUNT(*) AS c FROM containers WHERE status != 'open'")?.c || 0;
  const weekPieces = one<{ c: number }>("SELECT COUNT(*) AS c FROM orders WHERE status IN ('ARRIVED','CLEARING','IN_SL_WH','READY')")?.c || 0;
  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-[1.3fr_0.7fr] md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sea">{t(lang, "hero_kicker")}</p>
          <h1 className="mt-2 max-w-xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{t(lang, "hero_title")}</h1>
          <p className="mt-3 max-w-xl text-base text-ink/80">{t(lang, "hero_body")}</p>
        </div>
        <div className="border border-line bg-white p-4">
          <ShipTrack pct={box.pct} label={`${t(lang, "ship_label")} · ${box.week}`} />
          <p className="text-xs text-ink/60">{box.code} · {(box.cm3 / 1_000_000).toFixed(2)} / {(box.target / 1_000_000).toFixed(0)} CBM</p>
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <Link href="/shop?zone=instock" className="min-h-28 border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-sea">{t(lang, "stock_badge")}</p>
          <h2 className="mt-1 text-2xl font-semibold">{t(lang, "zone_stock_title")}</h2>
          <p className="mt-1 text-sm">{t(lang, "zone_stock_body")}</p>
        </Link>
        <Link href="/shop?zone=preorder" className="min-h-28 border border-sea bg-sea p-4 text-white">
          <p className="text-xs uppercase tracking-[0.14em] text-white/70">{t(lang, "sea_badge")}</p>
          <h2 className="mt-1 text-2xl font-semibold">{t(lang, "zone_sea_title")}</h2>
          <p className="mt-1 text-sm text-white/80">{t(lang, "zone_sea_body")}</p>
        </Link>
      </section>
      {settings.show_trust_stats ? (
        <section className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white p-3">
            <p className="text-2xl font-semibold">{orders}</p>
            <p className="text-xs">{t(lang, "trust_orders")}</p>
          </div>
          <div className="bg-white p-3">
            <p className="text-2xl font-semibold">{containers}</p>
            <p className="text-xs">{t(lang, "trust_boxes")}</p>
          </div>
          <div className="bg-white p-3">
            <p className="text-2xl font-semibold">{weekPieces}</p>
            <p className="text-xs">{t(lang, "trust_week")}</p>
          </div>
        </section>
      ) : null}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">{t(lang, "hot")}</h2>
          <Link href="/shop" className="text-sm underline">{t(lang, "see_all")}</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {hot.map((product) => (
            <ProductCard key={product.id} product={product} lang={lang} />
          ))}
        </div>
      </section>
      <section className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {cats.map((cat) => (
          <Link key={cat.slug} href={`/shop?cat=${cat.slug}`} className="min-h-16 border border-line bg-white p-3 text-sm font-medium">
            {pick(lang, cat, "name")}
          </Link>
        ))}
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        {unbox.map((post) => (
          <Link key={post.id} href="/help" className="border border-line bg-white">
            <div className="aspect-[4/3] bg-mist" style={{ backgroundImage: `url(${post.image})`, backgroundSize: "cover" }} />
            <p className="p-3 text-sm">{pick(lang, post, "title")}</p>
          </Link>
        ))}
      </section>
      <section className="grid gap-3 md:grid-cols-4">
        <Link href="/live" className="border border-line bg-white p-4 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.14em] text-coral">{t(lang, "live_now")}</p>
          <p className="mt-1 text-lg font-semibold">{t(lang, "live_title")}</p>
        </Link>
        <Link href="/family" className="border border-line bg-white p-4">{t(lang, "family_link")}</Link>
        <Link href="/source" className="border border-line bg-white p-4">{t(lang, "source_link")}</Link>
        <Link href="/visual" className="border border-line bg-white p-4">{t(lang, "visual_title")}</Link>
        <Link href="/link" className="border border-line bg-white p-4">{t(lang, "quote_cta")}</Link>
        <Link href="/sell" className="border border-line bg-white p-4">{t(lang, "sell_link")}</Link>
        <Link href="/get-app" className="border border-line bg-white p-4">{t(lang, "app_link")}</Link>
      </section>
    </div>
  );
}
