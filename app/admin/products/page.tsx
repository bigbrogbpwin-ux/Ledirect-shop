import Link from "next/link";
import { importAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { priceOf, type ProductRow } from "@/lib/commerce";
import { le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaffRole(["ops", "procurement"]);
  const lang = await getLang();
  const sp = await searchParams;
  const rows = many<ProductRow>("SELECT * FROM products WHERE source != '1688' ORDER BY id DESC LIMIT 80");
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t(lang, "products")}</h1>
        <Link href="/admin/products/new" className="min-h-11 bg-sea px-3 leading-[44px] text-white">{t(lang, "publish")}</Link>
      </div>
      <ErrorNote error={sp.error} />
      {sp.imported ? <p className="mt-2 text-sm">Imported {sp.imported}</p> : null}
      <div className="mt-3 flex gap-3 text-sm">
        <a className="underline" href="/api/admin/template">{t(lang, "template")}</a>
        <form action={importAction} className="flex gap-2">
          <input name="file" type="file" accept=".csv,text/csv" />
          <button className="min-h-11 border border-line bg-white px-3" type="submit">{t(lang, "import")}</button>
        </form>
      </div>
      <table className="mt-4 w-full text-left text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="py-2"><Link className="underline" href={`/admin/products/${row.id}`}>{row.sku}</Link></td>
              <td>{row.title_en}</td>
              <td>{row.zone}</td>
              <td>{row.status}</td>
              <td>{le(priceOf(row).priceSle)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
