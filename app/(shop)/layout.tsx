import { ShopFrame } from "@/components/shop-frame";
import { currentUser, getLang, readCartToken } from "@/lib/auth";
import { cartLines, sweepTimeouts } from "@/lib/commerce";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  try {
    sweepTimeouts();
  } catch {
    /* timeouts retry next request */
  }
  const lang = await getLang();
  const user = await currentUser();
  const count = cartLines(await readCartToken()).reduce((sum, line) => sum + line.qty, 0);
  return (
    <ShopFrame lang={lang} userId={user?.id ?? null} cartCount={count}>
      {children}
    </ShopFrame>
  );
}
