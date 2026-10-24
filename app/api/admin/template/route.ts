import { currentStaff } from "@/lib/auth";
import { CSV_TEMPLATE } from "@/lib/commerce";

async function staffOk() {
  const staff = await currentStaff();
  return Boolean(staff && ["super_admin", "ops", "finance"].includes(staff.role));
}

export async function GET() {
  if (!(await staffOk())) return new Response("Sign in", { status: 401 });
  return new Response(CSV_TEMPLATE, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=products-template.csv" },
  });
}
