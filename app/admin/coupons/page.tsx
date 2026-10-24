import { couponAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { freetown, le } from "@/lib/format";
import { t } from "@/lib/i18n";

export default async function CouponsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaffRole(["ops"]);
  const sp = await searchParams;
  const lang = await getLang();
  const rows = many<{
    id: number; code: string; kind: string; value: number; min_sle: number; cap_sle: number; zone: string;
    used_count: number; max_uses: number; active: number; ends_at: string;
  }>("SELECT id, code, kind, value, min_sle, cap_sle, zone, used_count, max_uses, active, ends_at FROM coupons ORDER BY id DESC");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "coupons")}</h1>
      <ErrorNote error={sp.error} />
      <form action={couponAction} className="mt-4 grid gap-2 md:grid-cols-3">
        <input name="code" required placeholder={t(lang, "coupon_ph")} className="min-h-11 border border-line bg-white px-2" />
        <input name="title" placeholder="Name" className="min-h-11 border border-line bg-white px-2" />
        <select name="kind" className="min-h-11 border border-line bg-white px-2">
          <option value="amount">Le</option>
          <option value="percent">%</option>
        </select>
        <input name="value" type="number" min={1} required placeholder="500" className="min-h-11 border border-line bg-white px-2" />
        <input name="min" type="number" min={0} defaultValue={0} placeholder="Min Le" className="min-h-11 border border-line bg-white px-2" />
        <input name="cap" type="number" min={0} defaultValue={0} className="min-h-11 border border-line bg-white px-2" />
        <select name="zone" className="min-h-11 border border-line bg-white px-2">
          <option value="any">any</option>
          <option value="instock">instock</option>
          <option value="preorder">preorder</option>
          <option value="diaspora">diaspora</option>
        </select>
        <input name="max" type="number" min={0} defaultValue={100} className="min-h-11 border border-line bg-white px-2" />
        <input name="per" type="number" min={1} defaultValue={1} className="min-h-11 border border-line bg-white px-2" />
        <input name="days" type="number" min={1} defaultValue={90} className="min-h-11 border border-line bg-white px-2" />
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "save")}</button>
      </form>
      <ul className="mt-6 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="border border-line bg-white p-3">
            <p className="font-semibold">{row.code} · {row.zone} · {row.active ? "on" : "off"}</p>
            <p>{row.kind === "percent" ? `${row.value / 100}%` : le(row.value)} · min {le(row.min_sle)} · cap {row.cap_sle ? le(row.cap_sle) : "—"}</p>
            <p>{row.used_count}/{row.max_uses || "∞"} · {freetown(row.ends_at)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
