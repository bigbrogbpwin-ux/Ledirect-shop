import Link from "next/link";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { t } from "@/lib/i18n";
export default async function TicketsPage() {
  await requireStaffRole(["cs", "ops", "finance"]);
  const lang = await getLang();
  const rows = many<Record<string, unknown>>("SELECT * FROM tickets ORDER BY id DESC LIMIT 50");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "tickets")}</h1>
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={String(row.id)}>
            <Link className="underline" href={`/admin/tickets/${row.id}`}>{String(row.number)}</Link>
            {" · "}{String(row.type)} · {String(row.status)} · {String(row.subject)}
          </li>
        ))}
      </ul>
    </div>
  );
}
