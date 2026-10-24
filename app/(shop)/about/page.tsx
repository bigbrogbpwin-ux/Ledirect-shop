import { getLang } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { one } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export default async function AboutPage() {
  const lang = await getLang();
  const settings = getSettings();
  const orders = one<{ c: number }>("SELECT COUNT(*) AS c FROM orders WHERE price_locked = 1")?.c || 0;
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold">{t(lang, "about")}</h1>
      <p>{BRAND.legal}</p>
      <p>{BRAND.reg}</p>
      <p>{BRAND.warehouse}</p>
      <p>{t(lang, "hours")}: {BRAND.hours}</p>
      <p>{BRAND.agent} · {BRAND.phone}</p>
      <div className="aspect-video bg-mist" style={{ backgroundImage: "url(/photos/wh-1.jpg)", backgroundSize: "cover" }} />
      <div className="aspect-video bg-mist" style={{ backgroundImage: "url(/photos/port-1.jpg)", backgroundSize: "cover" }} />
      {settings.show_trust_stats ? <p>{orders} {t(lang, "trust_orders")}</p> : null}
      <p className="text-sm text-ink/70">{t(lang, "footer_note")}</p>
    </article>
  );
}
