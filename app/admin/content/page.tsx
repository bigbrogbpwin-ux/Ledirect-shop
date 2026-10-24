import { postAction } from "@/app/actions";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function ContentPage() {
  await requireStaffRole(["ops"]);
  const lang = await getLang();
  const posts = many<Record<string, unknown>>("SELECT id, kind, slug, title_en FROM posts ORDER BY id DESC");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "content")}</h1>
      <ul className="mt-3 text-sm">{posts.map((post) => <li key={String(post.id)}>{String(post.kind)} · {String(post.title_en)}</li>)}</ul>
      <form action={postAction} className="mt-4 grid gap-2">
        <input name="kind" defaultValue="help" className="min-h-11 border border-line bg-white px-2" />
        <input name="slug" placeholder="slug" className="min-h-11 border border-line bg-white px-2" />
        <input name="title_en" placeholder="English title" className="min-h-11 border border-line bg-white px-2" />
        <input name="title_zh" placeholder="中文标题" className="min-h-11 border border-line bg-white px-2" />
        <input name="title_fr" placeholder="Titre" className="min-h-11 border border-line bg-white px-2" />
        <textarea name="body_en" placeholder="English" className="min-h-24 border border-line bg-white p-2" />
        <textarea name="body_zh" placeholder="中文" className="min-h-24 border border-line bg-white p-2" />
        <textarea name="body_fr" placeholder="Français" className="min-h-24 border border-line bg-white p-2" />
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "save")}</button>
      </form>
    </div>
  );
}
