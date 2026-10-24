import Link from "next/link";
import { addCartAction } from "@/app/actions";
import { getLang } from "@/lib/auth";
import { many, one } from "@/lib/db";
import { port } from "@/lib/channels";
import { pick, t } from "@/lib/i18n";
import { safeAsset, safeMedia } from "@/lib/safe";

export async function LiveRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getLang();
  const post = one<Record<string, unknown>>("SELECT * FROM posts WHERE id = ? AND kind = 'live'", Number(id));
  if (!post) return null;
  const products = many<{ id: number; title_en: string; title_zh: string; title_fr: string }>(
    "SELECT p.id, p.title_en, p.title_zh, p.title_fr FROM live_products lp JOIN products p ON p.id = lp.product_id WHERE lp.post_id = ? ORDER BY lp.sort",
    post.id,
  );
  return (
    <div>
      <h1 className="text-3xl font-semibold">{pick(lang, post, "title")}</h1>
      <p className="mt-2 text-sm">{pick(lang, post, "body")}</p>
      <p className="mt-2 text-sm">{t(lang, "stream_reserved")} ({port("livestream").env})</p>
      <video className="mt-4 w-full bg-black" controls poster={safeAsset(String(post.image || "")) || undefined} src={safeMedia(String(post.video || "")) || undefined} />
      <ul className="mt-4 space-y-2">
        {products.map((product) => (
          <li key={product.id} className="flex items-center justify-between border border-line bg-white p-3">
            <Link href={`/p/${product.id}`} className="underline">{pick(lang, product, "title")}</Link>
            <form action={addCartAction}>
              <input type="hidden" name="product" value={product.id} />
              <input type="hidden" name="qty" value="1" />
              <input type="hidden" name="back" value={`/live/${post.id}`} />
              <button className="min-h-11 bg-coral px-3 text-white" type="submit">{t(lang, "add")}</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
