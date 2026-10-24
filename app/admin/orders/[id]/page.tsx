import { advanceAction, balanceAction, refundAction, resendAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { requireStaffRole, staffCan, getLang } from "@/lib/auth";
import { many, one } from "@/lib/db";
import { le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { nextForward, statusLabel } from "@/lib/states";
import { notFound } from "next/navigation";

export default async function OrderAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const staff = await requireStaffRole(["ops", "procurement", "warehouse", "cs", "finance"]);
  const { id } = await params;
  const sp = await searchParams;
  const lang = await getLang();
  const order = one<Record<string, unknown>>("SELECT * FROM orders WHERE id = ?", Number(id));
  if (!order) notFound();
  const items = many<{ id: number; title: string; qty: number }>("SELECT id, title, qty FROM order_items WHERE order_id = ?", order.id);
  const events = many<{ status: string; note: string | null; evidence_url: string | null }>("SELECT status, note, evidence_url FROM order_events WHERE order_id = ? ORDER BY id", order.id);
  const next = nextForward(String(order.zone), String(order.status));
  return (
    <div>
      <h1 className="text-3xl font-semibold">{String(order.number)}</h1>
      <ErrorNote error={sp.error} />
      <p>{statusLabel(String(order.status), lang)} · {le(Number(order.total_sle))} · {String(order.pay_mode)}</p>
      {order.pickup_code ? <p>{t(lang, "code")}: {String(order.pickup_code)}</p> : null}
      <ul className="mt-3 text-sm">{items.map((item) => <li key={item.id}>{item.title} × {item.qty}</li>)}</ul>
      <ol className="mt-3 space-y-1 text-sm">
        {events.map((event) => (
          <li key={event.status + (event.note || "")}>{statusLabel(event.status, lang)} {event.note} {event.evidence_url ? <a className="underline" href={event.evidence_url}>file</a> : null}</li>
        ))}
      </ol>
      {next && next !== "PAID" && staffCan(staff.role, "move") ? (
        <form action={advanceAction} className="mt-4 grid gap-2 md:grid-cols-2">
          <input type="hidden" name="order" value={String(order.id)} />
          <input type="hidden" name="to" value={next} />
          <input name="note" placeholder={t(lang, "note")} className="min-h-11 border border-line bg-white px-2" />
          <input name="bl" placeholder={t(lang, "bl")} className="min-h-11 border border-line bg-white px-2" />
          <input name="cm3" placeholder={t(lang, "measured")} className="min-h-11 border border-line bg-white px-2" />
          <input name="code" placeholder={t(lang, "code")} defaultValue={String(order.pickup_code || "")} className="min-h-11 border border-line bg-white px-2" />
          <input name="file" type="file" accept="image/*" />
          <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "advance")} → {statusLabel(next, lang)}</button>
        </form>
      ) : null}
      {order.status === "DEPOSIT_HELD" && staffCan(staff.role, "money") ? (
        <form action={balanceAction} className="mt-3">
          <input type="hidden" name="order" value={String(order.id)} />
          <button className="min-h-11 bg-coral px-3 text-white" type="submit">{t(lang, "confirm_paid")}</button>
        </form>
      ) : null}
      {staffCan(staff.role, "money") ? <form action={refundAction} className="mt-4 grid gap-2 border border-line bg-white p-3 md:grid-cols-2">
        <input type="hidden" name="order" value={String(order.id)} />
        <select name="rule" className="min-h-11 border border-line px-2">
          <option value="cancel_before_buy">cancel_before_buy</option>
          <option value="cancel_before_load">cancel_before_load</option>
          <option value="platform_fault">platform_fault</option>
          <option value="lost_or_delay">lost_or_delay</option>
          <option value="quality">quality</option>
        </select>
        <select name="choice" className="min-h-11 border border-line px-2">
          <option value="refund">{t(lang, "refund_do")}</option>
          <option value="resend">{t(lang, "resend")}</option>
        </select>
        <input name="item" placeholder="item id" className="min-h-11 border border-line px-2" />
        <input name="reason" placeholder={t(lang, "note")} className="min-h-11 border border-line px-2" />
        <button className="min-h-11 border border-line" type="submit">{t(lang, "refund_do")}</button>
      </form> : null}
      {staffCan(staff.role, "notify") ? <form action={resendAction} className="mt-3">
        <input type="hidden" name="order" value={String(order.id)} />
        <button className="min-h-11 underline" type="submit">{t(lang, "messages")}</button>
      </form> : null}
    </div>
  );
}
