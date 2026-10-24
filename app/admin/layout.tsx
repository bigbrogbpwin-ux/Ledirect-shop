import Link from "next/link";
import { staffOutAction } from "@/app/actions";
import { LangSwitch } from "@/components/lang-switch";
import { currentStaff, getLang } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { version } from "@/package.json";

const LINKS = ["", "products", "quotes", "orders", "warehouse", "finance", "tickets", "reports", "content", "coupons", "settings", "audit", "sellers", "integrations", "people"];
const KEYS = ["desk", "products", "quotes", "nav_orders", "warehouse", "finance", "tickets", "reports", "content", "coupons", "settings", "audit", "sellers", "integrations", "users"];

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}

async function Shell({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const staff = await currentStaff();
  return (
    <div className="min-h-screen bg-foam">
      <header className="bg-sea text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/admin" className="font-semibold">LeDirect desk</Link>
          <span className="text-sm text-white/70">v{version}</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {staff ? <span>{staff.name} · {staff.role}</span> : null}
            <LangSwitch lang={lang} />
            {staff ? (
              <form action={staffOutAction}><button className="underline" type="submit">{t(lang, "logout")}</button></form>
            ) : (
              <Link href="/">{t(lang, "nav_home")}</Link>
            )}
          </div>
        </div>
        {staff ? (
          <nav className="mx-auto flex max-w-6xl gap-3 overflow-x-auto px-4 pb-3 text-sm">
            {LINKS.map((href, i) => (
              <Link key={href} href={href ? `/admin/${href}` : "/admin"} className="whitespace-nowrap underline-offset-4 hover:underline">
                {t(lang, KEYS[i])}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <div className="mx-auto max-w-6xl px-4 py-5">{children}</div>
    </div>
  );
}
