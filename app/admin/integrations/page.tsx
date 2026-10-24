import { PORTS, portReady } from "@/lib/channels";
import { requireStaffRole, getLang } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default async function IntegrationsPage() {
  await requireStaffRole(["finance"]);
  const lang = await getLang();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{t(lang, "integrations")}</h1>
      <p className="text-sm">Each row is the seam for a live service. The shop already runs on the demo or sample side of that seam. Set the env key, then replace the function in `lib/channels.ts`.</p>
      <ul className="space-y-2 text-sm">
        {PORTS.map((item) => (
          <li key={item.id} className="border border-line bg-white p-3">
            <p className="font-semibold">{item.id} · {item.mode} · {portReady(item.id) ? "key present" : "key empty"}</p>
            <p>{item.env}</p>
            <p>{item.note}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm">Payment notices arrive at `POST /api/pay/webhook` with header `x-monime-signature`. Orders, stock, and finance files export from Reports.</p>
      <a className="inline-block underline" href="/api/admin/export">{t(lang, "export")} orders</a>
      <a className="ml-4 inline-block underline" href="/api/admin/template">{t(lang, "template")}</a>
    </div>
  );
}
