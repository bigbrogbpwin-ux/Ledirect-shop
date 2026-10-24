import { port } from "@/lib/channels";
import { getLang } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default async function AppPage() {
  const lang = await getLang();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold">{t(lang, "app_title")}</h1>
      <p className="mt-2 text-sm">{t(lang, "app_body")}</p>
      <p className="mt-4 text-sm">{t(lang, "add_screen")}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="border border-line bg-white p-4">
          <p className="font-semibold">{t(lang, "ios")}</p>
          <div className="mt-3 h-28 w-28 bg-mist" aria-hidden />
          <p className="mt-2 text-xs">{t(lang, "coming")}</p>
        </div>
        <div className="border border-line bg-white p-4">
          <p className="font-semibold">{t(lang, "android")}</p>
          <div className="mt-3 h-28 w-28 bg-mist" aria-hidden />
          <p className="mt-2 text-xs">{t(lang, "coming")}</p>
          <p className="mt-1 text-xs">{port("appstore").env}</p>
        </div>
      </div>
    </div>
  );
}
