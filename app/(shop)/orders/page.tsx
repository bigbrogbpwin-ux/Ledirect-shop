import Link from "next/link";
import { currentUser, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { freetown, le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/states";
import { redirect } from "next/navigation";

export default async function OrdersPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/orders");
  const lang = await getLang();
  const orders = many<{ id: number; number: string; status: string; total_sle: number; zone: string; created_at: string; source: string }>(
    "SELECT id, number, status, total_sle, zone, created_at, source FROM orders WHERE user_id = ? ORDER BY id DESC",
    user.id,
  );
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "order_title")}</h1>
      {!orders.length ? <p className="mt-4">{t(lang, "empty_orders")}</p> : null}
      <ul className="mt-4 space-y-2">
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={`/orders/${order.id}`} className="block border border-line bg-white p-3">
              <span className="font-semibold">{order.number}</span>
              <span className="ml-2 text-xs uppercase text-sea">{order.zone} · {order.source}</span>
              <p className="text-sm">{statusLabel(order.status, lang)}</p>
              <p className="text-sm">{le(order.total_sle)} · {freetown(order.created_at)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
