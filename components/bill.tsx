import { le } from "@/lib/format";
import { t, type Lang } from "@/lib/i18n";

export function Bill({
  lang,
  goods,
  intl,
  delivery,
  total,
  showIntl,
  discount = 0,
  deliveryLabel,
}: {
  lang: Lang;
  goods: number;
  intl: number;
  delivery: number;
  total: number;
  showIntl: boolean;
  discount?: number;
  deliveryLabel?: string;
}) {
  const rows = [
    [t(lang, "goods"), le(goods)],
    ...(showIntl ? [[t(lang, "freight"), le(intl)]] : []),
    [deliveryLabel || t(lang, "delivery"), delivery ? le(delivery) : t(lang, "free")],
    ...(discount ? [[t(lang, "discount"), `-${le(discount)}`]] : []),
  ];
  return (
    <div className="bill">
      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-sea/70">{t(lang, "bill_title")}</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-1 text-sm">
          <span>{label}</span>
          <span>{value}</span>
        </div>
      ))}
      <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
        <span className="text-sm">{t(lang, "total")}</span>
        <span className="text-2xl font-semibold tracking-tight">{le(total)}</span>
      </div>
    </div>
  );
}

export function ShipTrack({ pct, label }: { pct: number; label: string }) {
  const shown = Math.max(0, Math.min(pct, 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{shown}%</span>
      </div>
      <div className="ship" aria-hidden>
        <svg className="boat" style={{ left: `${shown}%` }} viewBox="0 0 64 32">
          <path d="M4 22h40l8-8H18z" fill="#0c3d38" />
          <path d="M30 14V4h4l10 10" fill="#e23e12" />
        </svg>
        <div className="lane">
          <span style={{ width: `${shown}%` }} />
        </div>
      </div>
    </div>
  );
}
