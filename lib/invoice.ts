import { BRAND } from "./brand";
import { one, many } from "./db";
import { freetown, le } from "./format";

export type InvoiceLine = { title: string; sku: string; qty: number; unit: number; amount: number };

export type InvoiceDoc = {
  filename: string;
  kind: "proforma" | "commercial";
  number: string;
  issued: string;
  buyer: string;
  phone: string;
  ship: string;
  lines: InvoiceLine[];
  goods: number;
  intl: number;
  delivery: number;
  discount: number;
  coupon: string;
  total: number;
  deposit: number;
  balance: number;
  fx: string;
  source: string;
};

type OrderRow = {
  id: number;
  number: string;
  user_id: number;
  status: string;
  source: string;
  shipping_method: string;
  address_json: string | null;
  recipient_json: string | null;
  goods_sle: number;
  intl_sle: number;
  delivery_sle: number;
  discount_sle: number;
  coupon_code: string | null;
  total_sle: number;
  deposit_sle: number;
  balance_sle: number;
  price_locked: number;
  fx_sle_per_usd_e4: number;
  created_at: string;
};

function ascii(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderPdf(lines: string[]): Buffer {
  const commands = ["BT", "/F1 11 Tf", "48 800 Td", "14 TL"];
  for (const line of lines.slice(0, 48)) commands.push(`(${ascii(line)}) Tj`, "T*");
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

export function loadInvoice(orderId: number, userId: number): InvoiceDoc | null {
  const order = one<OrderRow>("SELECT * FROM orders WHERE id = ? AND user_id = ?", orderId, userId);
  if (!order || order.status === "CANCELLED") return null;
  const user = one<{ name: string; phone: string }>("SELECT name, phone FROM users WHERE id = ?", userId);
  const items = many<{ title: string; sku: string; qty: number; unit_sle: number }>(
    "SELECT title, sku, qty, unit_sle FROM order_items WHERE order_id = ?",
    order.id,
  );
  const point = one<{ name: string; city: string }>(
    "SELECT p.name, p.city FROM pickup_points p JOIN orders o ON o.pickup_point_id = p.id WHERE o.id = ?",
    order.id,
  );
  let ship = order.shipping_method;
  if (point) ship = `${point.name}, ${point.city}`;
  if (order.address_json) {
    try {
      const address = JSON.parse(order.address_json) as { line?: string; area?: string };
      ship = [address.area, address.line].filter(Boolean).join(" · ") || ship;
    } catch {
      /* keep method */
    }
  }
  if (order.recipient_json) {
    try {
      const person = JSON.parse(order.recipient_json) as { name?: string; phone?: string; city?: string };
      ship = `For ${person.name || ""} ${person.phone || ""} ${person.city || ""}`.trim();
    } catch {
      /* keep */
    }
  }
  const kind = order.price_locked ? "commercial" : "proforma";
  return {
    filename: `${kind}-${order.number}.pdf`,
    kind,
    number: order.number,
    issued: freetown(order.created_at),
    buyer: user?.name || "Customer",
    phone: user?.phone || "",
    ship,
    lines: items.map((item) => ({ title: item.title, sku: item.sku, qty: item.qty, unit: item.unit_sle, amount: item.unit_sle * item.qty })),
    goods: order.goods_sle,
    intl: order.intl_sle,
    delivery: order.delivery_sle,
    discount: order.discount_sle,
    coupon: order.coupon_code || "",
    total: order.total_sle,
    deposit: order.deposit_sle,
    balance: order.balance_sle,
    fx: (order.fx_sle_per_usd_e4 / 10000).toFixed(2),
    source: order.source,
  };
}

export function invoiceLines(doc: InvoiceDoc): string[] {
  const head = doc.kind === "proforma" ? "PROFORMA INVOICE" : "COMMERCIAL INVOICE";
  const lines = [
    BRAND.legal,
    `Reg ${BRAND.reg}`,
    BRAND.warehouse,
    "",
    head,
    `No. ${doc.number}`,
    `Issued ${doc.issued}`,
    `Buyer ${doc.buyer}  ${doc.phone}`,
    `Ship ${doc.ship}`,
    `Source ${doc.source}`,
    `Rate locked at SLE ${doc.fx} per USD`,
    "",
  ];
  for (const item of doc.lines.slice(0, 12)) {
    lines.push(`${item.qty} x ${item.title} (${item.sku})  ${le(item.amount)}`);
  }
  lines.push(
    "",
    `Goods ${le(doc.goods)}`,
    `Freight and tax ${le(doc.intl)}`,
    `Delivery ${le(doc.delivery)}`,
    doc.discount ? `Discount ${doc.coupon} -${le(doc.discount)}` : "Discount none",
    `Total ${le(doc.total)}`,
    `Deposit ${le(doc.deposit)}`,
    `Balance ${le(doc.balance)}`,
    "",
    "This proforma is a price quotation. It becomes a commercial invoice when payment locks the price.",
    "Amounts are integer Sierra Leone leones.",
  );
  return lines;
}

export function invoicePdf(orderId: number, userId: number): { filename: string; bytes: Buffer } | null {
  const doc = loadInvoice(orderId, userId);
  if (!doc) return null;
  return { filename: doc.filename, bytes: renderPdf(invoiceLines(doc)) };
}
