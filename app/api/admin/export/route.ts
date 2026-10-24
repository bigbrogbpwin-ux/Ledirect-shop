import { currentStaff } from "@/lib/auth";
import { buildReport } from "@/lib/commerce";
import { many } from "@/lib/db";
import { toCsv } from "@/lib/format";

export async function GET(req: Request) {
  const staff = await currentStaff();
  if (!staff || !["super_admin", "finance", "ops"].includes(staff.role)) return new Response("Sign in", { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || new Date(Date.now() - 400 * 86400000).toISOString();
  const to = url.searchParams.get("to") || new Date().toISOString();
  const kind = url.searchParams.get("kind") || "orders";
  if (kind === "report") {
    const report = buildReport(from, to);
    const csv = toCsv([
      ["gmv", "orders", "margin", "buffer", "refunds", "on_time"],
      [report.gmv, report.orders, report.margin, report.buffer, report.refunds, report.onTimeRate],
    ]);
    return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=report.csv" } });
  }
  const rows = many<Record<string, unknown>>("SELECT number, status, zone, source, total_sle, goods_sle, intl_sle, delivery_sle, created_at FROM orders WHERE created_at >= ? AND created_at < ?", from, to);
  const csv = toCsv([
    ["number", "status", "zone", "source", "total_sle", "goods_sle", "intl_sle", "delivery_sle", "created_at"],
    ...rows.map((row) => ["number", "status", "zone", "source", "total_sle", "goods_sle", "intl_sle", "delivery_sle", "created_at"].map((key) => row[key] as string | number)),
  ]);
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=orders.csv" } });
}
