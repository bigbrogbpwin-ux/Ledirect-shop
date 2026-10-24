import { airAction, cancelAction, demoAdvanceAction, proofAction, reviewAction, ticketAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { currentUser, getLang } from "@/lib/auth";
import { many, one } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { freetown, le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { safeAsset } from "@/lib/safe";
import { getSettings } from "@/lib/settings";
import { flowFor, refundRuleForStatus, statusLabel } from "@/lib/states";
import { notFound, redirect } from "next/navigation";

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/orders/${id}`);
  const lang = await getLang();
  const order = one<Record<string, unknown>>("SELECT * FROM orders WHERE id = ? AND user_id = ?", Number(id), user.id);
  if (!order) notFound();
  const items = many<{ id: number; product_id: number; title: string; qty: number; unit_sle: number }>("SELECT id, product_id, title, qty, unit_sle FROM order_items WHERE order_id = ?", order.id);
  const events = many<{ status: string; note: string | null; evidence_url: string | null; created_at: string }>("SELECT status, note, evidence_url, created_at FROM order_events WHERE order_id = ? ORDER BY id", order.id);
  const flow = flowFor(String(order.zone));
  const status = String(order.status);
  const current = status === "DEPOSIT_HELD" ? 0 : flow.indexOf(status);
  const rule = refundRuleForStatus(status);
  const settings = getSettings();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold">{String(order.number)}</h1>
      <ErrorNote error={sp.error} />
      <p className="mt-1 text-lg">{statusLabel(status, lang)}</p>
      <p className="text-sm text-ink/70">{le(Number(order.total_sle))} · {String(order.zone)} · {String(order.source)}</p>
      {Number(order.discount_sle) > 0 ? <p className="text-sm">{t(lang, "discount")} {order.coupon_code ? String(order.coupon_code) : ""} −{le(Number(order.discount_sle))}</p> : null}
      <a className="mt-3 inline-block min-h-11 underline" href={`/orders/${order.id}/invoice`}>{t(lang, "invoice")}</a>
      {order.pickup_code && status === "READY" ? (
        <p className="mt-4 border border-sea bg-white p-4 text-center">
          <span className="text-xs uppercase tracking-[0.14em]">{t(lang, "code")}</span>
          <span className="mt-1 block text-4xl font-semibold tracking-[0.2em]">{String(order.pickup_code)}</span>
        </p>
      ) : null}
      <ol className="mt-6 space-y-2">
        {(status === "DEPOSIT_HELD" ? ["PENDING_PAYMENT", "DEPOSIT_HELD", ...flow.slice(1)] : flow).map((step, index) => {
          const done = status === "CANCELLED" ? false : status === "DEPOSIT_HELD" ? index <= 1 : index <= current;
          const event = [...events].reverse().find((item) => item.status === step);
          return (
            <li key={step} className={`border px-3 py-2 text-sm ${done ? "border-sea bg-white" : "border-line text-ink/40"}`}>
              <span>{statusLabel(step, lang)}</span>
              {event ? <span className="ml-2 text-xs">{freetown(event.created_at)}</span> : null}
              {event?.note ? <p>{event.note}</p> : null}
              {event && safeAsset(event.evidence_url) ? <img src={safeAsset(event.evidence_url) || ""} alt="" className="mt-2 h-24 w-24 object-cover" /> : null}
            </li>
          );
        })}
      </ol>
      <ul className="mt-4 text-sm">
        {items.map((item) => (
          <li key={item.id}>{item.title} × {item.qty} · {le(item.unit_sle)}</li>
        ))}
      </ul>
      {status === "DEPOSIT_HELD" ? (
        <section className="mt-4 border border-line bg-white p-3 text-sm">
          <p>{t(lang, "bank_help")}</p>
          <p className="mt-2">{BRAND.bankName}<br />{BRAND.bankHolder}<br />{BRAND.bankAccount}<br />{BRAND.bankBranch}</p>
          <p className="mt-2">{t(lang, "deposit")} {le(Number(order.deposit_sle))} · {t(lang, "balance")} {le(Number(order.balance_sle))}</p>
          {order.balance_proof ? <p className="mt-2">Proof saved.</p> : null}
          <form action={proofAction} className="mt-2">
            <input type="hidden" name="order" value={String(order.id)} />
            <input name="proof" type="file" accept="image/*,.pdf" className="block text-sm" />
            <button className="mt-2 min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "proof")}</button>
          </form>
        </section>
      ) : null}
      {order.zone === "preorder" && !["SHIPPED", "ARRIVED", "CLEARING", "IN_SL_WH", "READY", "COMPLETED", "CANCELLED"].includes(status) ? (
        <form action={airAction} className="mt-3">
          <input type="hidden" name="order" value={String(order.id)} />
          <button className="min-h-11 underline" type="submit">{t(lang, "switch_air")}</button>
        </form>
      ) : null}
      {rule ? (
        <form action={cancelAction} className="mt-3">
          <input type="hidden" name="order" value={String(order.id)} />
          <button className="min-h-11 underline" type="submit">{t(lang, "cancel")}</button>
        </form>
      ) : null}
      {status === "COMPLETED" ? (
        <form action={reviewAction} className="mt-4 space-y-2 border border-line bg-white p-3">
          <input type="hidden" name="order" value={String(order.id)} />
          <input type="hidden" name="product" value={items[0]?.product_id || ""} />
          <label className="block text-sm">{t(lang, "rating")}
            <input name="rating" type="number" min={1} max={5} defaultValue={5} className="ml-2 w-16 border border-line px-2" />
          </label>
          <textarea name="body" required className="min-h-20 w-full border border-line p-2" placeholder={t(lang, "review")} />
          <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "review")}</button>
        </form>
      ) : null}
      <form action={ticketAction} className="mt-4 space-y-2 border border-line bg-white p-3">
        <input type="hidden" name="order" value={String(order.id)} />
        <select name="type" className="min-h-11 w-full border border-line px-2">
          <option value="quality">{t(lang, "quality")}</option>
          <option value="not_received">{t(lang, "not_received")}</option>
          <option value="refund">{t(lang, "refund_q")}</option>
        </select>
        <textarea name="body" required className="min-h-20 w-full border border-line p-2" />
        <input name="photo" type="file" accept="image/*" />
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "ticket")}</button>
      </form>
      {settings.demo_mode && !["COMPLETED", "CANCELLED", "PENDING_PAYMENT"].includes(status) ? (
        <form action={demoAdvanceAction} className="mt-4">
          <input type="hidden" name="order" value={String(order.id)} />
          <button className="min-h-11 border border-coral px-3 text-coral" type="submit">{t(lang, "demo_title")}: {t(lang, "advance")}</button>
        </form>
      ) : null}
    </div>
  );
}
