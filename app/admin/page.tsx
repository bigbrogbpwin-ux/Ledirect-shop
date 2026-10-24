import Link from "next/link";
import { currentStaff, getLang } from "@/lib/auth";
import { dashboard, warnings } from "@/lib/commerce";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function DeskPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  const lang = await getLang();
  const data = dashboard();
  const list = warnings();
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "desk")}</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/admin/quotes" className="border border-line bg-white p-4"><p className="text-3xl font-semibold">{data.quotes}</p><p className="text-sm">{t(lang, "quotes")}</p></Link>
        <Link href="/admin/orders" className="border border-line bg-white p-4"><p className="text-3xl font-semibold">{data.toBuy}</p><p className="text-sm">{t(lang, "procurement")}</p></Link>
        <Link href="/admin/tickets" className="border border-line bg-white p-4"><p className="text-3xl font-semibold">{data.warnings}</p><p className="text-sm">{t(lang, "tickets")}</p></Link>
        <Link href="/admin/finance" className="border border-line bg-white p-4"><p className="text-3xl font-semibold">{data.recon}</p><p className="text-sm">{t(lang, "finance")}</p></Link>
      </div>
      <p className="mt-4 text-sm">{data.box.code} · {data.box.pct}%</p>
      <ul className="mt-4 space-y-2 text-sm">
        {list.map((item) => (
          <li key={item.id}><Link className="underline" href={`/admin/orders/${item.id}`}>{item.number}</Link> · {item.kind}</li>
        ))}
      </ul>
    </div>
  );
}
