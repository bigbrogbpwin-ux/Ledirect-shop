import path from "path";
import { latestBackup } from "@/lib/backup";
import { one } from "@/lib/db";

export async function GET() {
  const products = one<{ c: number }>("SELECT COUNT(*) AS c FROM products")?.c ?? 0;
  const backup = latestBackup(path.join(process.cwd(), "data", "backups"));
  return Response.json({
    ok: products > 0,
    service: "ledirect",
    products,
    backup: backup ? path.basename(backup) : null,
  });
}
