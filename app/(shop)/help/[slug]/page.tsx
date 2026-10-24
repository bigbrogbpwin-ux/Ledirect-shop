import { getLang } from "@/lib/auth";
import { one } from "@/lib/db";
import { pick, t } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function HelpArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await getLang();
  const post = one<Record<string, unknown>>("SELECT * FROM posts WHERE kind = 'help' AND slug = ?", slug);
  if (!post) notFound();
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold">{pick(lang, post, "title")}</h1>
      <p className="mt-4 whitespace-pre-wrap leading-7">{pick(lang, post, "body")}</p>
    </article>
  );
}
