import { approveRefundAction, fxActivateAction, fxProposeAction, pullSettlementAction, reconAction, replayAction, supplementAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { activeFx } from "@/lib/settings";
import { redirect } from "next/navigation";

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaffRole(["finance"]);
  const lang = await getLang();
  const sp = await searchParams;
  const fx = activeFx();
  const rates = many<Record<string, unknown>>("SELECT * FROM fx_rates ORDER BY id DESC LIMIT 8");
  const refunds = many<Record<string, unknown>>("SELECT * FROM refunds ORDER BY id DESC LIMIT 20");
  const batches = many<Record<string, unknown>>("SELECT * FROM recon_batches ORDER BY id DESC LIMIT 8");
  const groups = many<{ id: number; number: string; external_ref: string | null; status: string }>("SELECT id, number, external_ref, status FROM payment_groups WHERE status = 'success' ORDER BY id DESC LIMIT 8");
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{t(lang, "finance")}</h1>
      <ErrorNote error={sp.error} />
      {sp.matched ? <p className="text-sm">Matched {sp.matched}, exceptions {sp.bad}</p> : null}
      <p className="text-sm">{t(lang, "second_approver")}</p>
      <section>
        <h2 className="text-xl font-semibold">{t(lang, "fx")} {fx.slePerUsdE4 / 10000} SLE/USD · {fx.usdCnyE4 / 10000} CNY</h2>
        <form action={fxProposeAction} className="mt-2 flex flex-wrap gap-2">
          <input name="sle" defaultValue="24" className="min-h-11 w-24 border border-line bg-white px-2" />
          <input name="cny" defaultValue="7.15" className="min-h-11 w-24 border border-line bg-white px-2" />
          <input name="buffer" defaultValue="300" className="min-h-11 w-24 border border-line bg-white px-2" />
          <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "propose")}</button>
        </form>
        <ul className="mt-2 text-sm">
          {rates.map((rate) => (
            <li key={String(rate.id)} className="mt-1">
              #{String(rate.id)} {String(rate.status)} by {String(rate.entered_by || "")}
              {rate.status === "pending" ? (
                <form action={fxActivateAction} className="inline">
                  <input type="hidden" name="id" value={String(rate.id)} />
                  <button className="ml-2 underline" type="submit">{t(lang, "activate")}</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">{t(lang, "refund_do")}</h2>
        {refunds.map((row) => (
          <p key={String(row.id)} className="mt-1 text-sm">
            #{String(row.id)} {String(row.status)} {String(row.rule)} {le(Number(row.amount_sle))} {String(row.approver1 || "")}
            {row.status === "needs_second" ? (
              <form action={approveRefundAction} className="inline">
                <input type="hidden" name="id" value={String(row.id)} />
                <button className="ml-2 underline" type="submit">{t(lang, "approve")}</button>
              </form>
            ) : null}
          </p>
        ))}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Monime</h2>
        <form action={pullSettlementAction} className="mt-2">
          <button className="min-h-11 border border-line bg-white px-3" type="submit">{t(lang, "pull_settlement")}</button>
        </form>
        <form action={reconAction} className="mt-2 flex gap-2">
          <input name="file" type="file" accept=".csv,text/csv" />
          <button className="min-h-11 border border-line bg-white px-3" type="submit">{t(lang, "import")}</button>
        </form>
        <p className="mt-1 text-xs">external_ref,amount_sle in leones. Or reference,value in cents.</p>
        {batches.map((batch) => <p key={String(batch.id)} className="text-sm">Batch {String(batch.id)} matched {String(batch.matched)} / bad {String(batch.exceptions)}</p>)}
        <form action={supplementAction} className="mt-3 grid gap-2 md:grid-cols-4">
          <input name="number" placeholder="LD-26-1003" className="min-h-11 border border-line bg-white px-2" />
          <input name="ref" placeholder="external ref" className="min-h-11 border border-line bg-white px-2" />
          <input name="amount" placeholder="Le" className="min-h-11 border border-line bg-white px-2" />
          <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "supplement")}</button>
        </form>
        {groups.map((group) => (
          <form key={group.id} action={replayAction} className="mt-2 text-sm">
            <input type="hidden" name="group" value={group.id} />
            <button className="underline" type="submit">{t(lang, "replay")} {group.number} {group.external_ref}</button>
          </form>
        ))}
      </section>
    </div>
  );
}
