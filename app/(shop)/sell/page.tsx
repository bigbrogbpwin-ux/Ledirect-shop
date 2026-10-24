import { sellerAction } from "@/app/actions";
import { getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { t } from "@/lib/i18n";
import Link from "next/link";

export default async function SellPage({ searchParams }: { searchParams: Promise<{ done?: string; phone?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const phone = (sp.phone || "").trim();
  const found = phone
    ? many<{ id: number; shop_name: string; status: string; seller_code: string | null; reject_reason: string | null; commission_bps: number | null }>(
      "SELECT id, shop_name, status, seller_code, reject_reason, commission_bps FROM seller_apps WHERE phone = ? ORDER BY id DESC",
      phone,
    )
    : [];
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold">{t(lang, "sell_title")}</h1>
      <p className="mt-2 text-sm">{t(lang, "sell_body")}</p>
      {sp.done ? <p className="mt-3 border border-sea bg-white p-3 text-sm">#{sp.done}</p> : null}
      <form action={sellerAction} className="mt-4 space-y-2">
        <input name="shop" required placeholder={t(lang, "shop_name")} className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="owner" required placeholder={t(lang, "owner")} className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="phone" required placeholder={t(lang, "phone")} className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="email" placeholder={t(lang, "email")} className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="category" required placeholder={t(lang, "category")} className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="city" defaultValue="Freetown" placeholder={t(lang, "city")} className="min-h-11 w-full border border-line bg-white px-2" />
        <textarea name="note" placeholder={t(lang, "note")} className="min-h-20 w-full border border-line bg-white p-2" />
        <input name="doc" type="file" accept="image/*,.pdf" />
        <button className="min-h-12 w-full bg-coral text-white" type="submit">{t(lang, "submit")}</button>
      </form>
      <form className="mt-8 space-y-2 border-t border-line pt-4" action="/sell" method="get">
        <h2 className="text-xl font-semibold">{t(lang, "seller_lookup")}</h2>
        <input name="phone" defaultValue={phone} placeholder={t(lang, "seller_phone")} className="min-h-11 w-full border border-line bg-white px-2" />
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "seller_lookup")}</button>
      </form>
      <ul className="mt-3 space-y-2 text-sm">
        {found.map((row) => (
          <li key={row.id} className="border border-line bg-white p-3">
            <p>{row.shop_name} · {row.status}{row.commission_bps ? ` · ${row.commission_bps / 100}%` : ""}</p>
            {row.reject_reason ? <p>{row.reject_reason}</p> : null}
            {row.seller_code ? <Link className="underline" href={`/s/${row.seller_code}`}>{row.seller_code}</Link> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
