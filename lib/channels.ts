/**
 * External channels. Demo and sample data stay inside this file.
 * A live connection replaces the body of one function and reads the env key.
 * Pages and orders do not change.
 */

export type PortMode = "demo" | "reserved";

export type Port = {
  id: string;
  env: string;
  mode: PortMode;
  note: string;
};

export const PORTS: Port[] = [
  { id: "monime", env: "MONIME_SECRET", mode: "demo", note: "Demo cashier until MONIME_SECRET and MONIME_SPACE_ID are both set. Live checkout uses the same callback, idempotency, and reconciliation." },
  { id: "whatsapp", env: "BSP_TOKEN", mode: "demo", note: "Inbox until BSP_TOKEN and BSP_URL are both set. The same template is posted as JSON." },
  { id: "sms", env: "SMS_TOKEN", mode: "demo", note: "Pickup codes and payment exceptions stay in the inbox until SMS_TOKEN and SMS_URL are both set." },
  { id: "catalog1688", env: "ALIBABA_APP_KEY", mode: "reserved", note: "Search reads the sample catalog. The live call returns title, price, sales, shop, variants, and images." },
  { id: "vision", env: "VISION_ENDPOINT", mode: "reserved", note: "Photo search uses the sample index. The live call returns product ids." },
  { id: "livestream", env: "LIVE_STREAM_URL", mode: "reserved", note: "The room plays a recording and sells pinned goods. A stream URL replaces the recording." },
  { id: "intl_card", env: "INTL_CARD_SECRET", mode: "demo", note: "Family checkout shows USD and takes a stand-in international card through the same payment group." },
  { id: "erp", env: "ERP_WEBHOOK_URL", mode: "reserved", note: "Orders, stock, and finance export as files. A webhook pushes the same rows." },
  { id: "fx", env: "FX_FEED_URL", mode: "reserved", note: "Finance enters the central-bank rate. A feed can propose the same fields." },
  { id: "appstore", env: "APP_STORE_URL", mode: "reserved", note: "The phone install path is the PWA. Store buttons open when the native builds exist." },
];

const MONIME_VERSION = "caph.2025-08-23";
const DEMO_WEBHOOK_SECRET = "demo-monime-secret";

export class MonimeError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function port(id: string): Port {
  const found = PORTS.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown channel ${id}`);
  return found;
}

export function portReady(id: string): boolean {
  const item = port(id);
  return Boolean(process.env[item.env]);
}

export function monimeReady(): boolean {
  return Boolean(process.env.MONIME_SECRET && process.env.MONIME_SPACE_ID);
}

/** Where a refund lands. Live Monime takes the original method. Until then, the wallet holds the money. */
export function refundDestination(method: string): "wallet" | "monime" {
  if (method === "wallet") return "wallet";
  if (monimeReady()) return "monime";
  return "wallet";
}

export type PayNotice =
  | { kind: "legacy"; groupId: number; externalRef: string; status: "success" | "failed"; method: string; amountSle: number }
  | {
      kind: "checkout";
      status: "success" | "failed";
      sessionId: string;
      reference: string;
      groupId: number | null;
      externalRef: string;
      method: string;
      amountSle: number | null;
    }
  | { kind: "payout"; status: "completed" | "failed"; payoutId: string; refundId: number | null }
  | { kind: "ignore" };

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Json;
}

function methodFrom(provider: string, hint: string): string {
  if (provider === "m17") return "orange";
  if (provider === "m18") return "afri";
  if (hint === "card" || hint === "bank" || hint === "ussd" || hint === "orange" || hint === "afri") return hint;
  if (provider.startsWith("slb")) return "bank";
  return hint || "orange";
}

/** Demo callbacks stay `{ groupId, externalRef, status, method, amountSle }`. Live Monime events use the caph envelope. */
export function readPayNotice(body: string): PayNotice {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { kind: "ignore" };
  }
  const root = asRecord(parsed);
  if (!root) return { kind: "ignore" };
  const event = asRecord(root.event);
  const name = typeof event?.name === "string" ? event.name : "";
  if (!name && typeof root.groupId === "number" && typeof root.externalRef === "string" && (root.status === "success" || root.status === "failed")) {
    return {
      kind: "legacy",
      groupId: root.groupId,
      externalRef: root.externalRef,
      status: root.status,
      method: typeof root.method === "string" ? root.method : "orange",
      amountSle: Number(root.amountSle),
    };
  }
  const data = asRecord(root.data) || {};
  if (name.startsWith("payout.")) {
    if (name !== "payout.completed" && name !== "payout.failed") return { kind: "ignore" };
    const meta = asRecord(data.metadata);
    const refundId = Number(meta?.refundId);
    const payoutId = typeof data.id === "string" ? data.id : "";
    if (!payoutId) return { kind: "ignore" };
    return {
      kind: "payout",
      status: name === "payout.completed" ? "completed" : "failed",
      payoutId,
      refundId: Number.isFinite(refundId) && refundId > 0 ? refundId : null,
    };
  }
  if (!name.startsWith("checkout_session.") && !name.startsWith("payment_code.")) return { kind: "ignore" };
  const ok = name.endsWith(".completed");
  const bad = name.endsWith(".expired") || name.endsWith(".cancelled") || name.endsWith(".failed");
  if (!ok && !bad) return { kind: "ignore" };
  const meta = asRecord(data.metadata);
  const payment = asRecord(data.paymentData);
  const channel = asRecord(payment?.channelData);
  const amountObj = asRecord(payment?.amount) || asRecord(data.amount);
  const groupRaw = Number(meta?.groupId);
  const provider = typeof channel?.providerId === "string" ? channel.providerId : "";
  const hint = typeof meta?.method === "string" ? meta.method : "";
  const externalRef =
    (typeof payment?.paymentId === "string" && payment.paymentId) ||
    (typeof data.orderNumber === "string" && data.orderNumber) ||
    (typeof data.id === "string" && data.id) ||
    (typeof event?.id === "string" ? event.id : "");
  if (!externalRef) return { kind: "ignore" };
  const minor = amountObj ? Number(amountObj.value) : NaN;
  return {
    kind: "checkout",
    status: ok ? "success" : "failed",
    sessionId: typeof data.id === "string" ? data.id : "",
    reference: typeof data.reference === "string" ? data.reference : "",
    groupId: Number.isFinite(groupRaw) && groupRaw > 0 ? groupRaw : null,
    externalRef,
    method: methodFrom(provider, hint),
    amountSle: Number.isFinite(minor) ? Math.round(minor / 100) : null,
  };
}

/** Production never accepts the secret published in the repository. Local demo mode still does. */
export function webhookSecret(settingsSecret: string): string {
  const env = process.env.MONIME_WEBHOOK_SECRET || "";
  if (env && env !== DEMO_WEBHOOK_SECRET) return env;
  if (process.env.NODE_ENV !== "production") return settingsSecret;
  return "";
}

function paymentOptions(method: string) {
  const off = { disable: true as const };
  const base = { card: { ...off }, bank: { ...off }, momo: { ...off }, wallet: { ...off } };
  if (method === "card") return { ...base, card: { disable: false } };
  if (method === "bank") return { ...base, bank: { disable: false } };
  if (method === "afri") return { ...base, momo: { disable: false, enabledProviders: ["m18"] } };
  if (method === "orange" || method === "ussd") return { ...base, momo: { disable: false, enabledProviders: ["m17"] } };
  return { card: { disable: false }, bank: { disable: false }, momo: { disable: false }, wallet: { disable: true } };
}

async function monimeFetch(path: string, init: RequestInit = {}) {
  const token = process.env.MONIME_SECRET;
  const space = process.env.MONIME_SPACE_ID;
  if (!token || !space) throw new MonimeError(503, "Monime is not configured.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Monime-Space-Id", space);
  headers.set("Monime-Version", MONIME_VERSION);
  if (init.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`https://api.monime.io${path}`, { ...init, headers, signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new MonimeError(599, "Monime did not respond.");
  }
  const json = (await response.json().catch(() => null)) as { success?: boolean; messages?: { message?: string }[]; result?: unknown; pagination?: { next?: string | null } } | null;
  if (!response.ok || json?.success === false) {
    const text = json?.messages?.map((item) => item.message).filter(Boolean).join(" ") || `Monime returned ${response.status}`;
    throw new MonimeError(response.status, text.slice(0, 180));
  }
  return json || {};
}

export async function openMonimeCheckout(input: {
  groupId: number;
  groupNumber: string;
  amountSle: number;
  method: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string; method: string }> {
  if (input.successUrl.length > 255 || input.cancelUrl.length > 255) throw new MonimeError(400, "Return URL is too long for Monime.");
  const json = await monimeFetch("/v1/checkout-sessions", {
    method: "POST",
    headers: { "Idempotency-Key": `cs-${input.groupId}-${input.method}`.slice(0, 64) },
    body: JSON.stringify({
      name: input.groupNumber.slice(0, 150),
      reference: input.groupNumber,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      callbackState: String(input.groupId),
      metadata: { groupId: String(input.groupId), method: input.method },
      lineItems: [
        {
          type: "custom",
          name: input.groupNumber.slice(0, 100),
          quantity: 1,
          reference: String(input.groupId),
          price: { currency: "SLE", value: Math.round(input.amountSle * 100) },
        },
      ],
      paymentOptions: paymentOptions(input.method),
    }),
  });
  const result = asRecord(json.result);
  const id = typeof result?.id === "string" ? result.id : "";
  const url = typeof result?.redirectUrl === "string" ? result.redirectUrl : "";
  if (!id || !url) throw new MonimeError(502, "Monime did not return a checkout URL.");
  return { id, url, method: input.method };
}

export async function sendMonimePayout(input: { refundId: number; amountSle: number; phone: string; method: string }) {
  const provider = input.method === "afri" ? "m18" : "m17";
  const json = await monimeFetch("/v1/payouts", {
    method: "POST",
    headers: { "Idempotency-Key": `refund-${input.refundId}`.slice(0, 64) },
    body: JSON.stringify({
      amount: { currency: "SLE", value: Math.round(input.amountSle * 100) },
      destination: { type: "momo", providerId: provider, phoneNumber: input.phone },
      metadata: { refundId: String(input.refundId) },
    }),
  });
  const result = asRecord(json.result);
  const id = typeof result?.id === "string" ? result.id : "";
  const status = typeof result?.status === "string" ? result.status : "pending";
  if (!id) throw new MonimeError(502, "Monime did not return a payout id.");
  return { id, status };
}

/** Credits from the last 36 hours, already converted to integer leones. */
export async function monimeCreditCsv(): Promise<string> {
  const since = Date.now() - 36 * 60 * 60 * 1000;
  const lines = ["external_ref,amount_sle"];
  let after = "";
  for (let page = 0; page < 5; page += 1) {
    const query = new URLSearchParams({ limit: "50", type: "credit" });
    if (after) query.set("after", after);
    const json = await monimeFetch(`/v1/financial-transactions?${query}`);
    const rows = Array.isArray(json.result) ? json.result : [];
    for (const item of rows) {
      const row = asRecord(item);
      if (!row || row.originatingFee || row.originatingReversal) continue;
      const stamp = Date.parse(String(row.timestamp || ""));
      if (Number.isFinite(stamp) && stamp < since) continue;
      const reference = typeof row.reference === "string" ? row.reference.trim() : "";
      const amount = asRecord(row.amount);
      if (!reference || !amount || (amount.currency && amount.currency !== "SLE")) continue;
      const minor = Number(amount.value);
      if (!Number.isFinite(minor)) continue;
      lines.push(`${reference},${Math.round(minor / 100)}`);
    }
    const next = json.pagination?.next;
    if (!next) break;
    after = next;
  }
  return lines.join("\n");
}

/**
 * Accept the shop CSV (`external_ref,amount_sle`, leones) or a Monime export (`reference,value`, cents).
 */
export function settlementToCsv(text: string): string {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return "external_ref,amount_sle";
  const head = lines[0].toLowerCase().replace(/^\uFEFF/, "");
  if (head.startsWith("external_ref")) return lines.join("\n");
  if (!head.includes("reference")) return lines.join("\n");
  const out = ["external_ref,amount_sle"];
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const ref = cells[0]?.trim();
    const minor = Number(cells[1]);
    if (!ref || !Number.isFinite(minor)) continue;
    out.push(`${ref},${Math.round(minor / 100)}`);
  }
  return out.join("\n");
}

export async function postChannel(url: string, token: string, payload: { to: string; body: string; template: string }): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
