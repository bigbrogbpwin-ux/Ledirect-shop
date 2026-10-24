import { issueQuoteAction } from "@/app/actions";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function QuotesAdmin() {
  await requireStaffRole(["ops", "procurement"]);
  const lang = await getLang();
  const rows = many<Record<string, unknown>>("SELECT * FROM quotes ORDER BY id DESC LIMIT 40");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "quotes")}</h1>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={String(row.id)} className="border border-line bg-white p-3 text-sm">
            <p>#{String(row.id)} · {String(row.status)} · {String(row.url)}</p>
            {row.price_sle ? <p>{le(Number(row.price_sle))}</p> : null}
            {row.status === "pending" ? (
              <form action={issueQuoteAction} className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <input type="hidden" name="id" value={String(row.id)} />
                <input name="title" placeholder="title" defaultValue="Linked factory item" className="min-h-11 border border-line px-2" />
                <input name="cny" defaultValue="42" className="min-h-11 border border-line px-2" />
                <input name="g" defaultValue="500" className="min-h-11 border border-line px-2" />
                <input name="l" defaultValue="30" className="min-h-11 border border-line px-2" />
                <input name="w" defaultValue="20" className="min-h-11 border border-line px-2" />
                <input name="h" defaultValue="10" className="min-h-11 border border-line px-2" />
                <input name="duty" defaultValue="10" className="min-h-11 border border-line px-2" />
                <input name="margin" defaultValue="35" className="min-h-11 border border-line px-2" />
                <input name="hs" defaultValue="8544.42" className="min-h-11 border border-line px-2" />
                <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "calc")}</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
