import { currentUser, getLang } from "@/lib/auth";
import { le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { loadInvoice } from "@/lib/invoice";
import { notFound, redirect } from "next/navigation";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/orders/${id}/invoice`);
  const lang = await getLang();
  const doc = loadInvoice(Number(id), user.id);
  if (!doc) notFound();
  return (
    <article className="mx-auto max-w-xl border border-line bg-white p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-sea">{doc.kind === "proforma" ? t(lang, "invoice_proforma") : t(lang, "invoice_commercial")}</p>
      <h1 className="mt-2 text-3xl font-semibold">{doc.number}</h1>
      <p className="mt-2 text-sm">{doc.buyer} · {doc.phone}</p>
      <p className="text-sm">{doc.ship}</p>
      <p className="text-sm">{doc.issued} · SLE {doc.fx} / USD</p>
      <ul className="mt-4 space-y-2 text-sm">
        {doc.lines.map((item) => (
          <li key={`${item.sku}-${item.title}`} className="flex justify-between gap-3">
            <span>{item.qty} × {item.title}</span>
            <span>{le(item.amount)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between"><dt>{t(lang, "goods")}</dt><dd>{le(doc.goods)}</dd></div>
        <div className="flex justify-between"><dt>{t(lang, "freight")}</dt><dd>{le(doc.intl)}</dd></div>
        <div className="flex justify-between"><dt>{t(lang, "delivery")}</dt><dd>{le(doc.delivery)}</dd></div>
        {doc.discount ? <div className="flex justify-between"><dt>{t(lang, "discount")} {doc.coupon}</dt><dd>−{le(doc.discount)}</dd></div> : null}
        <div className="flex justify-between text-lg font-semibold"><dt>{t(lang, "total")}</dt><dd>{le(doc.total)}</dd></div>
      </dl>
      <a className="mt-5 inline-block min-h-12 bg-coral px-4 leading-[48px] text-white" href={`/api/orders/${id}/invoice`}>{t(lang, "invoice_dl")}</a>
    </article>
  );
}
