import { roleAction } from "@/app/actions";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many } from "@/lib/db";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

const ROLES = ["super_admin", "ops", "procurement", "warehouse", "cs", "finance"];

export default async function PeoplePage() {
  const staff = await requireStaffRole([]);
  const lang = await getLang();
  const rows = many<{ id: number; name: string; email: string; role: string; active: number }>("SELECT id, name, email, role, active FROM staff ORDER BY id");
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(lang, "users")}</h1>
      <ul className="mt-4 space-y-3 text-sm">
        {rows.map((row) => (
          <li key={row.id}>
            <form action={roleAction} className="flex flex-wrap items-center gap-2 border border-line bg-white p-3">
              <input type="hidden" name="id" value={row.id} />
              <span className="w-48">{row.name}<br />{row.email}</span>
              <select name="role" defaultValue={row.role} className="min-h-11 border border-line px-2">
                {ROLES.map((role) => <option key={role}>{role}</option>)}
              </select>
              <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "save")}</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
