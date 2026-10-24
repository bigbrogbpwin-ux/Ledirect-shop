import Link from "next/link";
import { getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { pick, t } from "@/lib/i18n";

export default async function LiveIndex() {
  const lang = await getLang();
  const posts = many<{ id: number; title_en: string; title_zh: string; title_fr: string }>("SELECT id, title_en, title_zh, title_fr FROM posts WHERE kind = 'live' AND published = 1");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "live_title")}</h1>
      {posts.map((post) => (
        <Link key={post.id} href={`/live/${post.id}`} className="mt-3 block border border-line bg-white p-4">{pick(lang, post, "title")}</Link>
      ))}
    </div>
  );
}
