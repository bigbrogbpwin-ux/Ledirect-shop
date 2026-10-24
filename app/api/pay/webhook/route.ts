import { getSettings } from "@/lib/settings";
import { settlePayment, verifySignature } from "@/lib/commerce";

export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > 32_000) return Response.json({ error: "Body too large" }, { status: 413 });
  const settings = getSettings();
  const secret = process.env.MONIME_WEBHOOK_SECRET || settings.webhook_secret;
  if (!settings.demo_mode && (!process.env.MONIME_WEBHOOK_SECRET || secret === "demo-monime-secret")) {
    return Response.json({ error: "Webhook secret is not configured" }, { status: 503 });
  }
  if (!verifySignature(secret, body, req.headers.get("x-monime-signature"))) {
    return Response.json({ error: "Bad signature" }, { status: 401 });
  }
  let data: { groupId: number; externalRef: string; status: "success" | "failed"; method: string; amountSle: number };
  try {
    data = JSON.parse(body);
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  try {
    return Response.json(settlePayment(data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return Response.json({ error: message.slice(0, 180) }, { status: 400 });
  }
}
