import { cutoffAction, lclAction, redeemAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { requireStaffRole, getLang } from "@/lib/auth";
import { containerProgress } from "@/lib/commerce";
import { many } from "@/lib/db";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function WarehousePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaffRole(["warehouse", "procurement", "ops"]);
  const lang = await getLang();
  const sp = await searchParams;
  const box = containerProgress();
  const containers = many<Record<string, unknown>>("SELECT * FROM containers ORDER BY id DESC");
  const ready = many<{ number: string; pickup_code: string }>("SELECT number, pickup_code FROM orders WHERE status = 'READY'");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "warehouse")}</h1>
      <ErrorNote error={sp.error} />
      <p className="mt-2">{box.code} · {box.week} · {box.pct}% · {(box.cm3 / 1e6).toFixed(3)} CBM</p>
      <form action={cutoffAction} className="mt-3"><button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "cutoff")}</button></form>
      <form action={redeemAction} className="mt-4 flex gap-2">
        <input name="code" placeholder={t(lang, "code")} className="min-h-11 border border-line bg-white px-2" />
        <button className="min-h-11 bg-coral px-3 text-white" type="submit">{t(lang, "redeem")}</button>
      </form>
      <ul className="mt-3 text-sm">{ready.map((row) => <li key={row.number}>{row.number} · {row.pickup_code}</li>)}</ul>
      <ul className="mt-4 space-y-2 text-sm">
        {containers.map((row) => (
          <li key={String(row.id)} className="border border-line bg-white p-3">
            {String(row.code)} · {String(row.status)} · rollover {String(row.rollover_count)} {row.bl_no ? `· ${row.bl_no}` : ""}
            {Number(row.rollover_count) >= 2 && row.status === "open" ? (
              <form action={lclAction}>
                <input type="hidden" name="id" value={String(row.id)} />
                <button className="underline" type="submit">{t(lang, "lcl")}</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
