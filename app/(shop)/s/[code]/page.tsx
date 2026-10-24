import { getLang } from "@/lib/auth";
import { one } from "@/lib/db";
import { t } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function SellerShop({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const lang = await getLang();
  const shop = one<{ shop_name: string; city: string | null; category: string; owner_name: string; commission_bps: number | null }>(
    "SELECT shop_name, city, category, owner_name, commission_bps FROM seller_apps WHERE seller_code = ? AND status = 'approved'",
    code.toUpperCase(),
  );
  if (!shop) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs uppercase tracking-[0.16em] text-sea">{code.toUpperCase()}</p>
      <h1 className="mt-2 text-3xl font-semibold">{shop.shop_name}</h1>
      <p className="mt-2 text-sm">{shop.owner_name} · {shop.city} · {shop.category}</p>
      {shop.commission_bps ? <p className="text-sm">{t(lang, "commission")} {shop.commission_bps / 100}%</p> : null}
      <p className="mt-4 text-sm">{t(lang, "shop_open")}</p>
    </div>
  );
}
