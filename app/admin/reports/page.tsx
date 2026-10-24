import { requireStaffRole, getLang } from "@/lib/auth";
import { buildReport } from "@/lib/commerce";
import { le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const staff = await requireStaffRole(["finance", "ops"]);
  const lang = await getLang();
  const from = new Date(Date.now() - 400 * 86400000).toISOString();
  const to = new Date(Date.now() + 86400000).toISOString();
  const report = buildReport(from, to);
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "reports")}</h1>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <div className="bg-white p-3"><dt>GMV</dt><dd className="text-2xl font-semibold">{le(report.gmv)}</dd></div>
        <div className="bg-white p-3"><dt>Orders</dt><dd className="text-2xl font-semibold">{report.orders}</dd></div>
        <div className="bg-white p-3"><dt>Margin</dt><dd className="text-2xl font-semibold">{le(report.margin)}</dd></div>
        <div className="bg-white p-3"><dt>FX buffer</dt><dd className="text-2xl font-semibold">{le(report.buffer)}</dd></div>
        <div className="bg-white p-3"><dt>Refunds</dt><dd className="text-2xl font-semibold">{le(report.refunds)}</dd></div>
        <div className="bg-white p-3"><dt>On time</dt><dd className="text-2xl font-semibold">{Math.round(report.onTimeRate * 100)}%</dd></div>
      </dl>
      <a className="mt-4 inline-block underline" href={`/api/admin/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}>{t(lang, "export")}</a>
    </div>
  );
}
