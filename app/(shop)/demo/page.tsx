import Link from "next/link";
import { demoResetAction } from "@/app/actions";
import { getLang } from "@/lib/auth";
import { t } from "@/lib/i18n";

const STEPS = [
  ["/", "Home, two shops, container"],
  ["/shop?zone=instock", "In-stock goods"],
  ["/cart", "Cart"],
  ["/checkout", "Bill, coupon, partner desk, then pay"],
  ["/orders", "Orders, invoice, timeline"],
  ["/account", "Coupons WELCOME500, SEA10, FAMILY200"],
  ["/s/SEL-1001", "Approved seller shop"],
  ["/link", "Paste a 1688 link"],
  ["/source", "1688 sample catalog"],
  ["/visual", "Search by photo"],
  ["/wallet", "Wallet top up"],
  ["/sell", "Seller application"],
  ["/family", "Shop for family"],
  ["/live", "Warehouse live"],
  ["/get-app", "Add to the phone"],
  ["/admin", "Back office"],
];

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "script")}</h1>
      {sp.reset ? <p className="mt-2 text-sm">Demo data is back to the start.</p> : null}
      <p className="mt-2 text-sm">Customer +232 76 111 001. Staff password Demo#2026. Resetting the demo data needs Ada signed in as super admin.</p>
      <ol className="mt-4 space-y-2">
        {STEPS.map(([href, label], index) => (
          <li key={href}>
            <Link href={href} className="block min-h-11 border border-line bg-white px-3 leading-[44px]">
              {index + 1}. {label}
            </Link>
          </li>
        ))}
      </ol>
      <form action={demoResetAction} className="mt-6">
        <button className="min-h-11 border border-coral px-3 text-coral" type="submit">{t(lang, "reset_demo")}</button>
      </form>
    </div>
  );
}
