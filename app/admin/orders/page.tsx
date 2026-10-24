import Link from "next/link";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/states";
export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaffRole(["ops", "procurement", "warehouse", "cs", "finance"]);
  const lang = await getLang();
  const sp = await searchParams;
  const rows = sp.status
    ? many<Record<string, unknown>>("SELECT id, number, status, zone, total_sle, source FROM orders WHERE status = ? ORDER BY id DESC LIMIT 80", sp.status)
    : many<Record<string, unknown>>("SELECT id, number, status, zone, total_sle, source FROM orders ORDER BY id DESC LIMIT 80");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "nav_orders")}</h1>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {["PAID", "PROCURING", "IN_CN_WH", "READY", "DEPOSIT_HELD"].map((status) => (
          <Link key={status} href={`/admin/orders?status=${status}`} className="border border-line bg-white px-2 py-1">{statusLabel(status, lang)}</Link>
        ))}
      </div>
      <table className="mt-4 w-full text-left text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)} className="border-t border-line">
              <td className="py-2"><Link className="underline" href={`/admin/orders/${row.id}`}>{String(row.number)}</Link></td>
              <td>{statusLabel(String(row.status), lang)}</td>
              <td>{String(row.zone)}</td>
              <td>{String(row.source)}</td>
              <td>{le(Number(row.total_sle))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
