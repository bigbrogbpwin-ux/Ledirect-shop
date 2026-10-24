import Link from "next/link";
import { getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { pick, t } from "@/lib/i18n";

export default async function HelpPage() {
  const lang = await getLang();
  const posts = many<{ slug: string; title_en: string; title_zh: string; title_fr: string }>("SELECT slug, title_en, title_zh, title_fr FROM posts WHERE kind = 'help' AND published = 1 ORDER BY sort");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "help")}</h1>
      <ul className="mt-4 space-y-2">
        {posts.map((post) => (
          <li key={post.slug}><Link className="block min-h-11 border border-line bg-white px-3 leading-[44px]" href={`/help/${post.slug}`}>{pick(lang, post, "title")}</Link></li>
        ))}
      </ul>
    </div>
  );
}
