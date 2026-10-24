import { sellerReviewAction } from "@/app/actions";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function SellersPage() {
  await requireStaffRole(["ops"]);
  const lang = await getLang();
  const rows = many<Record<string, unknown>>("SELECT * FROM seller_apps ORDER BY id DESC");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "sellers")}</h1>
      <ul className="mt-4 space-y-3 text-sm">
        {rows.map((row) => (
          <li key={String(row.id)} className="border border-line bg-white p-3">
            <p>{String(row.shop_name)} · {String(row.owner_name)} · {String(row.phone)} · {String(row.status)}</p>
            <p>{String(row.category)} · {String(row.city)} {row.seller_code ? `· ${row.seller_code}` : ""}</p>
            {row.doc_url ? <a className="underline" href={String(row.doc_url)}>file</a> : null}
            {row.reject_reason ? <p>{String(row.reject_reason)}</p> : null}
            {row.status === "approved" && row.seller_code ? <a className="underline" href={`/s/${row.seller_code}`}>{String(row.seller_code)}</a> : null}
            {row.status === "submitted" ? (
              <form action={sellerReviewAction} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={String(row.id)} />
                <input name="commission" defaultValue="8" className="w-20 border border-line px-2" />
                <input name="reason" placeholder={t(lang, "reject_reason")} className="min-h-11 flex-1 border border-line px-2" />
                <button name="approve" value="1" className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "approve")}</button>
                <button name="approve" value="0" className="min-h-11 border border-line px-3" type="submit">{t(lang, "reject")}</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
