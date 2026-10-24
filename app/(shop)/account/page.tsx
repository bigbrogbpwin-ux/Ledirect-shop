import { addressAction } from "@/app/actions";
import { currentUser, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { freetown, le } from "@/lib/format";
import { pick, t } from "@/lib/i18n";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ticket?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  const lang = await getLang();
  const addresses = many<{ id: number; line: string; area: string }>("SELECT id, line, area FROM addresses WHERE user_id = ?", user.id);
  const messages = many<{ id: number; channel: string; body: string; created_at: string }>("SELECT id, channel, body, created_at FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT 20", user.id);
  const tickets = many<{ id: number; number: string; status: string; subject: string }>("SELECT id, number, status, subject FROM tickets WHERE user_id = ? ORDER BY id DESC", user.id);
  const wallet = (await import("@/lib/db")).one<{ balance_sle: number; frozen_sle: number }>("SELECT balance_sle, frozen_sle FROM wallets WHERE user_id = ?", user.id);
  const coupons = many<{ code: string; title_en: string; title_zh: string; title_fr: string; kind: string; value: number; min_sle: number; zone: string }>(
    "SELECT code, title_en, title_zh, title_fr, kind, value, min_sle, zone FROM coupons WHERE active = 1 AND starts_at <= ? AND ends_at >= ? ORDER BY id",
    new Date().toISOString(),
    new Date().toISOString(),
  );
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{user.name || t(lang, "account")}</h1>
      <p className="text-sm">{user.phone}</p>
      {sp.ticket ? <p className="border border-sea bg-white p-3 text-sm">Case #{sp.ticket}</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/orders" className="border border-line bg-white p-4">{t(lang, "nav_orders")}</Link>
        <Link href="/wallet" className="border border-line bg-white p-4">{t(lang, "wallet")} · {le(wallet?.balance_sle || 0)}</Link>
        <Link href="/get-app" className="border border-line bg-white p-4">{t(lang, "app_link")}</Link>
      </div>
      <section>
        <h2 className="text-xl font-semibold">{t(lang, "codes_you_can_use")}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {coupons.map((coupon) => (
            <li key={coupon.code} className="border border-line bg-white p-3">
              <p className="font-semibold">{coupon.code}</p>
              <p>{pick(lang, coupon, "title")} · {coupon.zone} · {coupon.kind === "percent" ? `${coupon.value / 100}%` : le(coupon.value)} · min {le(coupon.min_sle)}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">{t(lang, "addresses")}</h2>
        {addresses.map((item) => <p key={item.id} className="mt-2 text-sm">{item.area} · {item.line}</p>)}
        <form action={addressAction} className="mt-3 grid gap-2 md:grid-cols-2">
          <input name="name" defaultValue={user.name} className="min-h-11 border border-line bg-white px-2" />
          <input name="phone" defaultValue={user.phone} className="min-h-11 border border-line bg-white px-2" />
          <input name="area" defaultValue="freetown" className="min-h-11 border border-line bg-white px-2" />
          <input name="line" placeholder={t(lang, "address_line")} className="min-h-11 border border-line bg-white px-2" />
          <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "save")}</button>
        </form>
      </section>
      <section>
        <h2 className="text-xl font-semibold">{t(lang, "tickets")}</h2>
        {tickets.map((ticket) => <p key={ticket.id} className="mt-2 text-sm">{ticket.number} · {ticket.status} · {ticket.subject}</p>)}
      </section>
      <section>
        <h2 className="text-xl font-semibold">{t(lang, "messages")}</h2>
        {messages.map((message) => (
          <article key={message.id} className="mt-2 border border-line bg-white p-3 text-sm">
            <p className="text-xs uppercase text-gold">{message.channel} · {freetown(message.created_at)}</p>
            <p>{message.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
