import { timingSafeEqual } from "crypto";
import path from "path";
import { backupTree } from "@/lib/backup";
import { monimeCreditCsv, monimeReady } from "@/lib/channels";
import { dispatchRefunds, importSettlement } from "@/lib/commerce";
import { flushOutbound } from "@/lib/notify";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!bearerOk(req.headers.get("authorization"), secret)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dir = backupTree({
    dbFile: process.env.DB_PATH || path.join(process.cwd(), "data", "ledirect.sqlite"),
    uploadDir: path.join(process.cwd(), "data", "uploads"),
    destRoot: path.join(process.cwd(), "data", "backups"),
  });
  const payouts = await dispatchRefunds();
  const sent = await flushOutbound();
  let settlement: { matched: number; exceptions: number } | { error: string } | null = null;
  if (monimeReady()) {
    try {
      const csv = await monimeCreditCsv();
      settlement = importSettlement(csv, { id: 0, name: "Cron", role: "super_admin", email: "cron@ledirect.demo" });
    } catch (error) {
      settlement = { error: error instanceof Error ? error.message.slice(0, 180) : "settlement failed" };
    }
  }
  return Response.json({ backup: path.basename(dir), payouts, sent, settlement });
}

function bearerOk(header: string | null, secret: string) {
  const got = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
