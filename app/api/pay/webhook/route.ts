import { readPayNotice, webhookSecret } from "@/lib/channels";
import { completeQueuedRefund, failQueuedRefund, settlePayment, verifySignature } from "@/lib/commerce";
import { one } from "@/lib/db";
import { flushOutbound } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > 32_000) return Response.json({ error: "Body too large" }, { status: 413 });
  const secret = webhookSecret(getSettings().webhook_secret);
  if (!secret) return Response.json({ error: "Webhook secret is not configured" }, { status: 503 });
  if (!verifySignature(secret, body, signatureHeader(req))) {
    return Response.json({ error: "Bad signature" }, { status: 401 });
  }
  const notice = readPayNotice(body);
  try {
    if (notice.kind === "ignore") return Response.json({ ignored: true });
    if (notice.kind === "legacy") return Response.json(settlePayment(notice));
    if (notice.kind === "payout") {
      const refund = notice.refundId
        ? one<{ id: number }>("SELECT id FROM refunds WHERE id = ?", notice.refundId)
        : one<{ id: number }>("SELECT id FROM refunds WHERE payout_ref = ?", notice.payoutId);
      if (!refund) return Response.json({ missing: true });
      const result = notice.status === "completed" ? completeQueuedRefund(refund.id) : failQueuedRefund(refund.id, "Monime payout failed");
      await flushOutbound();
      return Response.json(result ?? { failed: true });
    }
    const group = groupFor(notice);
    if (!group) return Response.json({ error: "Payment not found" }, { status: 404 });
    const result = settlePayment({
      groupId: group.id,
      externalRef: notice.externalRef,
      status: notice.status,
      method: notice.method,
      amountSle: notice.amountSle ?? group.charged_sle,
    });
    const { dispatchRefunds } = await import("@/lib/commerce");
    await dispatchRefunds();
    await flushOutbound();
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return Response.json({ error: message.slice(0, 180) }, { status: 400 });
  }
}

function signatureHeader(req: Request) {
  const raw = req.headers.get("x-monime-signature") || req.headers.get("monime-signature") || "";
  const v1 = raw.match(/v1=([a-f0-9]+)/i);
  if (v1) return v1[1];
  return raw.replace(/^sha256=/i, "");
}

function groupFor(notice: { groupId: number | null; reference: string; sessionId: string }) {
  if (notice.groupId) {
    const row = one<{ id: number; charged_sle: number }>("SELECT id, charged_sle FROM payment_groups WHERE id = ?", notice.groupId);
    if (row) return row;
  }
  if (notice.reference) {
    const row = one<{ id: number; charged_sle: number }>("SELECT id, charged_sle FROM payment_groups WHERE number = ?", notice.reference);
    if (row) return row;
  }
  if (/^[A-Za-z0-9_-]{6,80}$/.test(notice.sessionId)) {
    return one<{ id: number; charged_sle: number }>("SELECT id, charged_sle FROM payment_groups WHERE raw_json LIKE ?", `%"id":"${notice.sessionId}"%`) || null;
  }
  return null;
}
