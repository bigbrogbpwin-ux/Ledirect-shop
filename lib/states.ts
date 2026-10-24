export const PREORDER_FLOW = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCURING",
  "PROCURED",
  "IN_CN_WH",
  "CONSOLIDATED",
  "SHIPPED",
  "ARRIVED",
  "CLEARING",
  "IN_SL_WH",
  "READY",
  "COMPLETED",
] as const;

export const INSTOCK_FLOW = ["PENDING_PAYMENT", "PAID", "PICKING", "READY", "COMPLETED"] as const;

export type OrderStatus = (typeof PREORDER_FLOW)[number] | "DEPOSIT_HELD" | "PICKING" | "CANCELLED";

export const STATUS_EN: Record<string, string> = {
  PENDING_PAYMENT: "Waiting for payment",
  DEPOSIT_HELD: "Deposit received — price locked",
  PAID: "Payment received — price locked",
  PROCURING: "We are buying your item in China",
  PROCURED: "Bought — on its way to our China warehouse",
  IN_CN_WH: "Arrived at China warehouse",
  CONSOLIDATED: "Packed into this week's container",
  SHIPPED: "On the sea — Bill of Lading No.",
  ARRIVED: "Arrived at Freetown port",
  CLEARING: "Customs clearance in progress",
  IN_SL_WH: "Arrived at our Freetown warehouse",
  PICKING: "Packing at the Freetown warehouse",
  READY: "Ready for pickup / Out for delivery",
  COMPLETED: "Delivered",
  CANCELLED: "Cancelled",
};

export const STATUS_ZH: Record<string, string> = {
  PENDING_PAYMENT: "等待付款",
  DEPOSIT_HELD: "定金已收，价格已锁定",
  PAID: "已付款，价格已锁定",
  PROCURING: "正在中国采购",
  PROCURED: "已采购，运往中国仓",
  IN_CN_WH: "已到中国仓",
  CONSOLIDATED: "已装入本周柜子",
  SHIPPED: "已开船",
  ARRIVED: "已到弗里敦港",
  CLEARING: "正在清关",
  IN_SL_WH: "已入弗里敦仓",
  PICKING: "弗里敦仓拣货中",
  READY: "可提货 / 派送中",
  COMPLETED: "已送达",
  CANCELLED: "已取消",
};

export function statusLabel(status: string, lang: "en" | "zh" | "fr"): string {
  if (lang === "zh") return STATUS_ZH[status] || status;
  if (lang === "fr") return STATUS_FR[status] || status;
  return STATUS_EN[status] || status;
}

export const STATUS_FR: Record<string, string> = {
  PENDING_PAYMENT: "En attente de paiement",
  DEPOSIT_HELD: "Acompte reçu — prix bloqué",
  PAID: "Paiement reçu — prix bloqué",
  PROCURING: "Achat en cours en Chine",
  PROCURED: "Acheté — en route vers notre entrepôt en Chine",
  IN_CN_WH: "Arrivé à l'entrepôt en Chine",
  CONSOLIDATED: "Chargé dans le conteneur de la semaine",
  SHIPPED: "En mer — numéro de connaissement",
  ARRIVED: "Arrivé au port de Freetown",
  CLEARING: "Dédouanement en cours",
  IN_SL_WH: "Arrivé à notre entrepôt de Freetown",
  PICKING: "Préparation à l'entrepôt de Freetown",
  READY: "Prêt au retrait / en livraison",
  COMPLETED: "Livré",
  CANCELLED: "Annulé",
};

export function flowFor(zone: string): readonly string[] {
  return zone === "instock" ? INSTOCK_FLOW : PREORDER_FLOW;
}

export function canTransition(zone: string, from: string, to: string): boolean {
  if (from === to) return false;
  if (to === "CANCELLED") {
    return ["PENDING_PAYMENT", "DEPOSIT_HELD", "PAID", "PROCURING", "PROCURED", "IN_CN_WH", "PICKING"].includes(from);
  }
  if (from === "PENDING_PAYMENT" && (to === "PAID" || to === "DEPOSIT_HELD")) return true;
  if (from === "DEPOSIT_HELD" && to === "PAID") return true;
  const flow = flowFor(zone);
  const i = flow.indexOf(from);
  const j = flow.indexOf(to);
  return i >= 0 && j === i + 1;
}

export function nextForward(zone: string, status: string): string | null {
  if (status === "DEPOSIT_HELD") return "PAID";
  const flow = flowFor(zone);
  const i = flow.indexOf(status);
  if (i < 0 || i >= flow.length - 1) return null;
  return flow[i + 1];
}

export const REFUND_RULES = {
  cancel_before_buy: { pct: 100, label: "Cancel before we buy — full refund" },
  cancel_before_load: { pct: 90, label: "Cancel after buying, before the container — 90% refund" },
  platform_fault: { pct: 100, label: "We could not supply, failed inspection, or the price rose — full refund" },
  lost_or_delay: { pct: 100, label: "Lost, or more than 30 days past the promised window — full refund or free resend" },
  quality: { pct: 100, label: "Quality issue within 7 days, with unboxing photos — refund that item or resend" },
  deposit_timeout: { pct: 100, label: "Balance not paid within 72 hours — deposit refunded in full" },
} as const;

export type RefundRule = keyof typeof REFUND_RULES;

export function refundRuleForStatus(status: string): RefundRule | null {
  if (status === "PAID" || status === "PICKING") return "cancel_before_buy";
  if (["PROCURING", "PROCURED", "IN_CN_WH"].includes(status)) return "cancel_before_load";
  return null;
}
