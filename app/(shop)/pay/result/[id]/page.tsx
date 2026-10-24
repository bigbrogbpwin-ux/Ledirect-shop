import Link from "next/link";
import { Track } from "@/components/dock";
import { currentUser, getLang } from "@/lib/auth";
import { many, one } from "@/lib/db";
import { le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/states";
import { redirect } from "next/navigation";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/login");
  const lang = await getLang();
  const group = one<{ id: number; user_id: number; status: string; charged_sle: number; purpose: string }>("SELECT * FROM payment_groups WHERE id = ?", Number(id));
  if (!group || group.user_id !== user.id) redirect("/orders");
  const orders = many<{ id: number; number: string; status: string; total_sle: number }>("SELECT id, number, status, total_sle FROM orders WHERE group_id = ?", group.id);
  return (
    <div className="mx-auto max-w-md">
      {group.status === "success" ? <Track event="purchase" params={{ value: group.charged_sle, group: group.id }} /> : null}
      <p className="text-xs uppercase tracking-[0.16em] text-coral">{t(lang, "pay_demo")}</p>
      <h1 className="mt-1 text-3xl font-semibold">{group.status === "success" ? t(lang, "price_locked") : t(lang, "pay_title")}</h1>
      <p className="mt-2 text-sm">{group.status}</p>
      {group.purpose === "wallet_topup" ? <p className="mt-3">{t(lang, "wallet")} {le(group.charged_sle)}</p> : null}
      <ul className="mt-4 space-y-2">
        {orders.map((order) => (
          <li key={order.id} className="border border-line bg-white p-3">
            <Link href={`/orders/${order.id}`} className="font-semibold underline">{order.number}</Link>
            <p className="text-sm">{statusLabel(order.status, lang)} · {le(order.total_sle)}</p>
          </li>
        ))}
      </ul>
      <Link href={group.purpose === "wallet_topup" ? "/wallet" : "/orders"} className="mt-4 inline-block min-h-11 underline">{t(lang, "next")}</Link>
    </div>
  );
}
