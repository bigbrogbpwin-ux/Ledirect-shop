import { insert, one } from "./db";
import { getSettings } from "./settings";
import { le, nowIso } from "./format";
import type { Lang } from "./i18n";

const DEFAULT_TPL: Record<string, Record<Lang, string>> = {
  paid: {
    en: "How di body, {name}. Payment received — price locked. Order {number} is {total}.",
    zh: "{name}，付款已收到，价格已锁定。订单 {number}，金额 {total}。",
    fr: "Bonjour {name}. Paiement reçu — prix bloqué. Commande {number} : {total}.",
  },
  procured: {
    en: "How di body, {name}. We bought your item in China. Order {number} is on the way to our warehouse.",
    zh: "{name}，已在中国买下。订单 {number} 正运往仓库。",
    fr: "Bonjour {name}. Article acheté en Chine. Commande {number} en route vers notre entrepôt.",
  },
  in_cn_wh: {
    en: "How di body, {name}. Order {number} arrived at our China warehouse. We weighed it and took photos.",
    zh: "{name}，订单 {number} 已到中国仓，已称重并拍照。",
    fr: "Bonjour {name}. Commande {number} arrivée à l'entrepôt en Chine. Pesée et photos faites.",
  },
  shipped: {
    en: "How di body, {name}. Order {number} is on the sea. Bill of lading {code}.",
    zh: "{name}，订单 {number} 已开船。提单号 {code}。",
    fr: "Bonjour {name}. Commande {number} est en mer. Connaissement {code}.",
  },
  arrived: {
    en: "How di body, {name}. Order {number} arrived at Freetown port. Customs is next.",
    zh: "{name}，订单 {number} 已到弗里敦港，下一步是清关。",
    fr: "Bonjour {name}. Commande {number} est arrivée au port de Freetown.",
  },
  ready: {
    en: "How di body, {name}. Order {number} is ready. Pickup code {code} at {place}.",
    zh: "{name}，订单 {number} 可以取货。提货码 {code}，地点：{place}。",
    fr: "Bonjour {name}. Commande {number} est prête. Code de retrait {code} à {place}.",
  },
  refund: {
    en: "How di body, {name}. Refund of {amount} for order {number} is going back to {method}.",
    zh: "{name}，订单 {number} 的退款 {amount} 将退回 {method}。",
    fr: "Bonjour {name}. Remboursement de {amount} pour {number} sur {method}.",
  },
  quote: {
    en: "How di body, {name}. Your link quote is {total}. It stays open for 24 hours.",
    zh: "{name}，链接报价 {total}，24 小时内有效。",
    fr: "Bonjour {name}. Votre devis lien est {total}. Valable 24 heures.",
  },
  rolled: {
    en: "How di body, {name}. This week's container is not full. Order {number} moves to next Sunday. You can switch to air and pay the difference.",
    zh: "{name}，本周柜子没装满。订单 {number} 顺延到下周日。可以改空运并补差价。",
    fr: "Bonjour {name}. Le conteneur n'est pas plein. Commande {number} passe à dimanche prochain. Vous pouvez passer en avion en payant l'écart.",
  },
  seller_ok: {
    en: "How di body, {name}. {shop} is approved. Your seller id is {code}.",
    zh: "{name}，{shop} 已通过。商家编号 {code}。",
    fr: "Bonjour {name}. {shop} est approuvée. Identifiant vendeur {code}.",
  },
  seller_no: {
    en: "How di body, {name}. {shop} was not approved. {reason}",
    zh: "{name}，{shop} 未通过。{reason}",
    fr: "Bonjour {name}. {shop} n'est pas approuvée. {reason}",
  },
  pay_exception: {
    en: "How di body, {name}. We could not confirm payment for {number}. If money left your wallet, reply to this message.",
    zh: "{name}，订单 {number} 的付款没有确认。如果钱已经扣出，请回复这条消息。",
    fr: "Bonjour {name}. Paiement non confirmé pour {number}. Si l'argent a quitté votre compte, répondez ici.",
  },
};

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export function notifyUser(
  userId: number,
  key: string,
  vars: Record<string, string | number>,
  lang: Lang = "en",
  orderId?: number,
) {
  const user = one<{ name: string }>("SELECT name FROM users WHERE id = ?", userId);
  const fallback = lang === "zh" ? "朋友" : lang === "fr" ? "ami" : "friend";
  const strings: Record<string, string> = { name: user?.name || fallback };
  for (const [k, v] of Object.entries(vars)) strings[k] = typeof v === "number" ? le(v) : String(v);
  if (typeof vars.total === "number") strings.total = le(vars.total);
  if (typeof vars.amount === "number") strings.amount = le(vars.amount);

  const custom = one<{ value: string }>("SELECT value FROM settings WHERE key = ?", `tpl_${key}`);
  let pack = DEFAULT_TPL[key] || { en: key, zh: key, fr: key };
  if (custom?.value) {
    try {
      pack = { ...pack, ...JSON.parse(custom.value) };
    } catch {
      /* keep default */
    }
  }
  const body = fill(pack[lang] || pack.en, strings);
  const down = getSettings().whatsapp_down;
  const waOk = !down;
  const smsToo = key === "ready" || key === "pay_exception";
  insert(
    "INSERT INTO messages (user_id, channel, template_key, body, status, popup, order_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
    userId,
    "whatsapp",
    key,
    body,
    waOk ? "sent" : "failed",
    waOk ? 1 : 0,
    orderId ?? null,
    nowIso(),
  );
  if (smsToo) {
    insert(
      "INSERT INTO messages (user_id, channel, template_key, body, status, popup, order_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
      userId,
      "sms",
      key,
      body,
      "sent",
      waOk ? 0 : 1,
      orderId ?? null,
      nowIso(),
    );
  }
}

export { DEFAULT_TPL };
