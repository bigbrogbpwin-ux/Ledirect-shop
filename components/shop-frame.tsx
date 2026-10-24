import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { DemoDock, PwaRegister } from "@/components/dock";
import { LangSwitch } from "@/components/lang-switch";
import { BRAND } from "@/lib/brand";
import { t, type Lang } from "@/lib/i18n";

export function ShopFrame({
  lang,
  cartCount,
  userId,
  children,
}: {
  lang: Lang;
  cartCount: number;
  userId: number | null;
  children: React.ReactNode;
}) {
  const links = [
    ["/", t(lang, "nav_home")],
    ["/shop", t(lang, "nav_shop")],
    ["/cart", t(lang, "nav_cart")],
    ["/orders", t(lang, "nav_orders")],
    ["/account", t(lang, "nav_account")],
  ];
  return (
    <div className="min-h-screen">
      <PwaRegister />
      <header className="sticky top-0 z-30 bg-sea text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            {BRAND.name}
          </Link>
          <form action="/search" className="hidden min-w-0 flex-1 md:block">
            <input name="q" placeholder={t(lang, "search_ph")} className="min-h-11 w-full rounded-md bg-white/10 px-3 text-white placeholder:text-white/60" />
          </form>
          <nav className="ml-auto hidden items-center gap-4 text-sm md:flex">
            {links.slice(1, 4).map(([href, label]) => (
              <Link key={href} href={href} className="min-h-11 leading-[44px]">
                {label}
                {href === "/cart" && cartCount ? ` (${cartCount})` : ""}
              </Link>
            ))}
            <Link href="/account" className="min-h-11 leading-[44px]">
              {t(lang, "nav_account")}
            </Link>
          </nav>
          <LangSwitch lang={lang} />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-5 pb-24">{children}</div>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-8 text-sm">
          <Link href="/help">{t(lang, "help")}</Link>
          <Link href="/about">{t(lang, "about")}</Link>
          <Link href="/sell">{t(lang, "sell_link")}</Link>
          <Link href="/family">{t(lang, "family_link")}</Link>
          <Link href="/source">{t(lang, "source_link")}</Link>
          <Link href="/get-app">{t(lang, "app_link")}</Link>
          <Link href="/demo">{t(lang, "demo_title")}</Link>
          <Link href="/admin">{t(lang, "staff_login")}</Link>
          {userId ? (
            <form action={logoutAction}>
              <button className="underline" type="submit">
                {t(lang, "logout")}
              </button>
            </form>
          ) : null}
          <p className="w-full text-xs text-ink/60">{t(lang, "footer_note")}</p>
        </div>
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white md:hidden">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="min-h-14 py-2 text-center text-xs">
            {label}
            {href === "/cart" && cartCount ? ` ${cartCount}` : ""}
          </Link>
        ))}
      </nav>
      <DemoDock userId={userId} label={t(lang, "notice_popup")} closeLabel={t(lang, "got_it")} />
    </div>
  );
}
