import { settingAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { requireStaffRole, getLang } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { redirect } from "next/navigation";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await requireStaffRole([]);
  const lang = await getLang();
  const sp = await searchParams;
  const settings = getSettings();
  const fields = ["sea_usd_cents_per_cbm", "air_usd_cents_per_kg", "delivery_sle", "free_delivery_sle", "split_threshold_sle", "deposit_bps"] as const;
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "settings")}</h1>
      <ErrorNote error={sp.error} />
      <form action={settingAction} className="mt-4 grid gap-2 md:grid-cols-2">
        {fields.map((key) => (
          <label key={key} className="text-sm">{key}
            <input name={key} defaultValue={String(settings[key])} className="mt-1 min-h-11 w-full border border-line bg-white px-2" />
          </label>
        ))}
        <label className="text-sm">gst_deductible
          <select name="gst_deductible" defaultValue={settings.gst_deductible ? "1" : "0"} className="mt-1 min-h-11 w-full border border-line bg-white px-2">
            <option value="0">charge GST</option>
            <option value="1">deductible</option>
          </select>
        </label>
        <label className="text-sm">{t(lang, "whatsapp_down")}
          <select name="whatsapp_down" defaultValue={settings.whatsapp_down ? "1" : "0"} className="mt-1 min-h-11 w-full border border-line bg-white px-2">
            <option value="0">up</option>
            <option value="1">down</option>
          </select>
        </label>
        <label className="text-sm">show_trust_stats
          <select name="show_trust_stats" defaultValue={settings.show_trust_stats ? "1" : "0"} className="mt-1 min-h-11 w-full border border-line bg-white px-2">
            <option value="1">on</option>
            <option value="0">off</option>
          </select>
        </label>
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "save")}</button>
      </form>
    </div>
  );
}
