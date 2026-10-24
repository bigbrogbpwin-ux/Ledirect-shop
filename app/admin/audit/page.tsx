import { requireStaffRole, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { freetown } from "@/lib/format";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function AuditPage() {
  const staff = await requireStaffRole([]);
  const lang = await getLang();
  const rows = many<Record<string, unknown>>("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 80");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "audit")}</h1>
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={String(row.id)} className="border border-line bg-white p-2">
            {freetown(String(row.created_at))} · {String(row.actor)} · {String(row.action)} · {String(row.entity)}
          </li>
        ))}
      </ul>
    </div>
  );
}
