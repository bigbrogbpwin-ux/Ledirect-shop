import { demoQuoteAction, quoteDecisionAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { currentUser, getLang } from "@/lib/auth";
import { one, many } from "@/lib/db";
import { freetown, le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { notFound, redirect } from "next/navigation";

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/link/${id}`);
  const lang = await getLang();
  const quote = one<Record<string, unknown>>("SELECT * FROM quotes WHERE id = ? AND user_id = ?", Number(id), user.id);
  if (!quote) notFound();
  const points = many<{ id: number; name: string }>("SELECT id, name FROM pickup_points WHERE active = 1 AND kind = 'local'");
  const demo = getSettings().demo_mode;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold">{String(quote.status)}</h1>
      <ErrorNote error={sp.error} />
      <p className="mt-2 break-all text-sm">{String(quote.url)}</p>
      <p className="text-sm">{t(lang, "qty")} {String(quote.qty)}</p>
      {quote.status === "quoted" ? (
        <div className="mt-4">
          <p className="text-4xl font-semibold">{le(Number(quote.price_sle) * Number(quote.qty))}</p>
          <p className="text-sm">{t(lang, "goods")} {le(Number(quote.goods_sle))} · {t(lang, "freight")} {le(Number(quote.intl_sle))}</p>
          <p className="text-sm">{freetown(String(quote.valid_until))}</p>
          <p className="mt-2 text-sm">{t(lang, "estimate")}</p>
          <form action={quoteDecisionAction} className="mt-3 space-y-2">
            <input type="hidden" name="id" value={String(quote.id)} />
            <select name="pickup" className="min-h-11 w-full border border-line bg-white px-2">
              {points.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
            </select>
            <button className="min-h-12 w-full bg-coral text-white" name="decision" value="accept" type="submit">{t(lang, "accept")}</button>
            <button className="min-h-11 w-full border border-line" name="decision" value="reject" type="submit">{t(lang, "reject")}</button>
          </form>
        </div>
      ) : null}
      {quote.status === "pending" && demo ? (
        <form action={demoQuoteAction} className="mt-4">
          <input type="hidden" name="id" value={String(quote.id)} />
          <button className="min-h-11 border border-coral px-3 text-coral" type="submit">{t(lang, "demo_quote")}</button>
        </form>
      ) : <p className="mt-4 text-sm">{quote.status === "pending" ? t(lang, "quote_wait") : ""}</p>}
    </div>
  );
}
