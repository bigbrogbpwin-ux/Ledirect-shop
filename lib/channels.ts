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
  { id: "monime", env: "MONIME_SECRET", mode: "demo", note: "Demo cashier uses the same callback, idempotency, and reconciliation as the live Monime checkout." },
  { id: "whatsapp", env: "BSP_TOKEN", mode: "demo", note: "Node messages are stored in the inbox. A BSP token sends the same template." },
  { id: "sms", env: "SMS_TOKEN", mode: "demo", note: "Pickup codes and payment exceptions are stored as SMS. A Sierra Leone gateway sends the same text." },
  { id: "catalog1688", env: "ALIBABA_APP_KEY", mode: "reserved", note: "Search reads the sample catalog. The live call returns title, price, sales, shop, variants, and images." },
  { id: "vision", env: "VISION_ENDPOINT", mode: "reserved", note: "Photo search uses the sample index. The live call returns product ids." },
  { id: "livestream", env: "LIVE_STREAM_URL", mode: "reserved", note: "The room plays a recording and sells pinned goods. A stream URL replaces the recording." },
  { id: "intl_card", env: "INTL_CARD_SECRET", mode: "demo", note: "Family checkout shows USD and takes a stand-in international card through the same payment group." },
  { id: "erp", env: "ERP_WEBHOOK_URL", mode: "reserved", note: "Orders, stock, and finance export as files. A webhook pushes the same rows." },
  { id: "fx", env: "FX_FEED_URL", mode: "reserved", note: "Finance enters the central-bank rate. A feed can propose the same fields." },
  { id: "appstore", env: "APP_STORE_URL", mode: "reserved", note: "The phone install path is the PWA. Store buttons open when the native builds exist." },
];

export function port(id: string): Port {
  const found = PORTS.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown channel ${id}`);
  return found;
}

export function portReady(id: string): boolean {
  const item = port(id);
  return Boolean(process.env[item.env]);
}

/** Where a refund lands. Live Monime takes the original method. Until then, the wallet holds the money. */
export function refundDestination(method: string): "wallet" | "monime" {
  if (method === "wallet") return "wallet";
  if (process.env.MONIME_SECRET) return "monime";
  return "wallet";
}
