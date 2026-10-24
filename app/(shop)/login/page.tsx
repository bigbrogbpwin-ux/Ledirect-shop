import { sendCodeAction, verifyAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { getLang } from "@/lib/auth";
import { cookies } from "next/headers";
import { t } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const demo = getSettings().demo_mode;
  const box = await cookies();
  const hint = box.get("ld_otp_hint")?.value;
  const phone = box.get("ld_otp_phone")?.value || (demo ? "+23276111001" : "");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-semibold">{t(lang, "login_title")}</h1>
      <ErrorNote error={sp.error} />
      {demo ? <p className="mt-2 text-sm">{t(lang, "customer_hint")}: +232 76 111 001 · Aminata Bangura</p> : null}
      <form action={sendCodeAction} className="mt-4 flex gap-2">
        <input name="phone" defaultValue={phone} className="min-h-11 flex-1 border border-line bg-white px-2" />
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "send_code")}</button>
      </form>
      {hint ? <p className="mt-3 border border-coral bg-white px-3 py-2 text-sm">{t(lang, "demo_otp")}: {hint}</p> : null}
      <form action={verifyAction} className="mt-4 space-y-2">
        <input type="hidden" name="next" value={sp.next || "/account"} />
        <input name="phone" defaultValue={phone} className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="name" placeholder={t(lang, "name")} className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="code" placeholder={t(lang, "code_label")} className="min-h-11 w-full border border-line bg-white px-2" />
        <button className="min-h-12 w-full bg-coral text-white" type="submit">{t(lang, "verify")}</button>
      </form>
    </div>
  );
}
