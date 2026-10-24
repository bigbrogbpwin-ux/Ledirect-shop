import { quoteAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { currentUser, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LinkPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login?next=/link");
  const lang = await getLang();
  const quotes = many<{ id: number; status: string; url: string; price_sle: number | null }>("SELECT id, status, url, price_sle FROM quotes WHERE user_id = ? ORDER BY id DESC", user.id);
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold">{t(lang, "link_title")}</h1>
      <p className="mt-2 text-sm">{t(lang, "link_help")}</p>
      <ErrorNote error={sp.error} />
      <form action={quoteAction} className="mt-4 space-y-2">
        <input name="url" required placeholder="https://detail.1688.com/offer/1.html" className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="qty" type="number" min={1} defaultValue={1} className="min-h-11 w-full border border-line bg-white px-2" />
        <textarea name="note" placeholder={t(lang, "note")} className="min-h-20 w-full border border-line bg-white p-2" />
        <button className="min-h-12 w-full bg-coral text-white" type="submit">{t(lang, "submit")}</button>
      </form>
      <ul className="mt-6 space-y-2 text-sm">
        {quotes.map((quote) => (
          <li key={quote.id}><Link className="underline" href={`/link/${quote.id}`}>{quote.status} · {quote.url}</Link></li>
        ))}
      </ul>
    </div>
  );
}
