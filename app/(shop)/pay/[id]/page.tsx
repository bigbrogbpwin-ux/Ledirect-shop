import { payAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { currentUser, getLang } from "@/lib/auth";
import { monimeReady } from "@/lib/channels";
import { one, many } from "@/lib/db";
import { le, usdFromCents } from "@/lib/format";
import { t } from "@/lib/i18n";
import { sleToUsdCents } from "@/lib/pricing";
import { activeFx, getSettings } from "@/lib/settings";
import { redirect } from "next/navigation";

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/pay/${id}`);
  const group = one<{ id: number; user_id: number; number: string; charged_sle: number; total_sle: number; status: string; purpose: string; raw_json: string | null }>(
    "SELECT * FROM payment_groups WHERE id = ?",
    Number(id),
  );
  if (!group || group.user_id !== user.id) redirect("/orders");
  if (group.status === "success") redirect(`/pay/result/${group.id}`);
  const lang = await getLang();
  const live = monimeReady();
  const plan = JSON.parse(group.raw_json || "{}") as { methods?: string[]; source?: string };
  const methods = plan.methods?.length ? plan.methods : ["orange", "afri", "card", "bank", "ussd"];
  const orders = many<{ number: string }>("SELECT number FROM orders WHERE group_id = ?", group.id);
  const fx = activeFx();
  const labels: Record<string, string> = { orange: t(lang, "orange"), afri: t(lang, "afri"), card: t(lang, "card"), bank: t(lang, "bank"), ussd: t(lang, "ussd"), intl_card: t(lang, "intl_card") };
  return (
    <div className="mx-auto max-w-md">
      <p className="text-xs uppercase tracking-[0.16em] text-coral">{t(lang, live ? "pay_live" : "pay_demo")}</p>
      <h1 className="mt-1 text-3xl font-semibold">{t(lang, "pay_title")}</h1>
      <ErrorNote error={sp.error} />
      <p className="mt-2 text-sm">{orders.map((order) => order.number).join(" · ") || group.number}</p>
      <p className="mt-3 text-4xl font-semibold">{le(group.charged_sle)}</p>
      {plan.source === "diaspora" || methods.includes("intl_card") ? <p className="text-sm">{t(lang, "usd_ref")} {usdFromCents(sleToUsdCents(group.charged_sle, fx))}</p> : null}
      <form action={payAction} className="mt-4 space-y-2">
        <input type="hidden" name="group" value={group.id} />
        {methods.map((method, index) => (
          <label key={method} className="flex min-h-12 items-center gap-2 border border-line bg-white px-3">
            <input type="radio" name="method" value={method} defaultChecked={index === 0} />
            {labels[method] || method}
          </label>
        ))}
        <button className="min-h-12 w-full bg-coral text-white" type="submit">{t(lang, "pay_now")}</button>
        {getSettings().demo_mode && !live ? <button className="min-h-11 w-full border border-line" name="fail" value="1" type="submit">{t(lang, "pay_fail")}</button> : null}
      </form>
    </div>
  );
}
