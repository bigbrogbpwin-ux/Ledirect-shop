import { staffCodeAction, staffPassAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { getLang } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { cookies } from "next/headers";

export default async function StaffLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const hint = (await cookies()).get("ld_staff_hint")?.value;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-semibold">{t(lang, "staff_login")}</h1>
      <ErrorNote error={sp.error} />
      <p className="mt-2 text-sm">{t(lang, "staff_hint")}: Demo#2026</p>
      <p className="text-xs text-ink/70">ada@ · ibrahim@ · wei@ · mamusu@ · fanta@ · joseph@ · amadu@ ledirect.demo</p>
      <form action={staffPassAction} className="mt-4 space-y-2">
        <input name="email" defaultValue="ada@ledirect.demo" className="min-h-11 w-full border border-line bg-white px-2" />
        <input name="password" type="password" className="min-h-11 w-full border border-line bg-white px-2" />
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "password")}</button>
      </form>
      {hint ? <p className="mt-3 border border-coral bg-white p-3 text-sm">{t(lang, "demo_otp")}: {hint}</p> : null}
      <form action={staffCodeAction} className="mt-3 flex gap-2">
        <input name="code" placeholder={t(lang, "second_step")} className="min-h-11 flex-1 border border-line bg-white px-2" />
        <button className="min-h-11 bg-coral px-3 text-white" type="submit">{t(lang, "verify")}</button>
      </form>
    </div>
  );
}
