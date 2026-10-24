import { createHmac, timingSafeEqual } from "crypto";
import { refundDestination } from "./channels";
import { insert, many, one, run, tx } from "./db";
import { activeFx, freightOf, getSettings } from "./settings";
import { notifyUser } from "./notify";
import {
  complianceHit,
  divRound,
  presentSplit,
  quoteSku,
  sleToUsdCents,
  type PriceQuote,
} from "./pricing";
import {
  canTransition,
  nextForward,
  refundRuleForStatus,
  type RefundRule,
} from "./states";
import { addHours, hoursBetween, nowIso, offerHost, parseCsv, weekLabel } from "./format";
import { randomCode } from "./password";
import type { Lang } from "./i18n";

export class RuleError extends Error {}

export type StaffActor = { id: number; name: string; role: string; email: string };

export type ProductRow = {
  id: number;
  sku: string;
  zone: "instock" | "preorder" | string;
  source: string;
  category_id: number | null;
  title_en: string;
  title_zh: string;
  title_fr: string;
  description_en: string;
  description_zh: string;
  description_fr: string;
  highlights_en: string;
  highlights_zh: string;
  highlights_fr: string;
  images: string;
  weight_g: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  purchase_cny_fen: number;
  domestic_usd_cents: number;
  wh_usd_cents: number;
  dest_usd_cents: number;
  duty_bps: number;
  hs_code: string | null;
  hs_signed_by: string | null;
  needs_permit: number;
  margin_bps: number;
  marketing_price_sle: number | null;
  local_market_sle: number | null;
  local_market_source: string | null;
  local_market_date: string | null;
  stock: number | null;
  sold_count: number;
  status: string;
  gate_measure: number;
  gate_english: number;
  gate_local: number;
  gate_hs: number;
  gate_compliance: number;
  is_hot: number;
  is_estimate: number;
  shop_name: string | null;
  shop_years: number | null;
  sales_count_src: number | null;
  supplier_name: string | null;
  air_ok: number;
  tags: string;
  visual_key: string | null;
  created_at: string;
};

type VariantRow = { id: number; product_id: number; label: string; sku: string; price_delta_sle: number; stock: number | null };

const ROLE_OK: Record<string, string[]> = {
  refund: ["finance", "super_admin"],
  price: ["ops", "super_admin"],
  fx: ["finance", "super_admin"],
  procure: ["procurement", "ops", "super_admin"],
  warehouse: ["warehouse", "procurement", "ops", "super_admin"],
  content: ["ops", "super_admin"],
  tickets: ["cs", "ops", "finance", "super_admin"],
  settings: ["super_admin"],
  people: ["super_admin"],
};

export function assertRole(actor: StaffActor, action: keyof typeof ROLE_OK) {
  if (!ROLE_OK[action].includes(actor.role)) throw new RuleError(`The ${actor.role} role cannot do this.`);
}

export function audit(actor: string, action: string, entity: string, before: unknown, after: unknown) {
  insert(
    "INSERT INTO audit_logs (actor, action, entity, before_json, after_json, created_at) VALUES (?,?,?,?,?,?)",
    actor,
    action,
    entity,
    before == null ? null : JSON.stringify(before),
    after == null ? null : JSON.stringify(after),
    nowIso(),
  );
}

export function hitLimit(key: string, max: number, windowSec: number) {
  const now = Date.now();
  const row = one<{ hits: number; reset_at: string }>("SELECT hits, reset_at FROM rate_limits WHERE key = ?", key);
  const reset = new Date(now + windowSec * 1000).toISOString();
  if (!row || new Date(row.reset_at).getTime() < now) {
    run(
      "INSERT INTO rate_limits (key, hits, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET hits = 1, reset_at = excluded.reset_at",
      key,
      reset,
    );
    return;
  }
  if (row.hits >= max) throw new RuleError("Too many attempts. Wait a few minutes.");
  run("UPDATE rate_limits SET hits = hits + 1 WHERE key = ?", key);
}

export function priceOf(product: ProductRow, air = false): PriceQuote {
  const input = {
    purchaseCnyFen: product.purchase_cny_fen,
    domesticUsdCents: product.domestic_usd_cents,
    whUsdCents: product.wh_usd_cents,
    destUsdCents: product.dest_usd_cents,
    dutyBps: product.duty_bps,
    marginBps: product.margin_bps,
    weightG: product.weight_g,
    lengthCm: product.length_cm,
    widthCm: product.width_cm,
    heightCm: product.height_cm,
    zone: product.zone === "instock" ? "instock" as const : "preorder" as const,
    marketingPriceSle: product.marketing_price_sle,
  };
  const fx = activeFx();
  const freight = freightOf();
  try {
    return quoteSku(input, fx, freight, air);
  } catch {
    return quoteSku({ ...input, marketingPriceSle: null }, fx, freight, air);
  }
}

export function gateCheck(product: Partial<ProductRow> & { title_en?: string; description_en?: string; images?: string; tags?: string }) {
  const missing: string[] = [];
  if (!product.weight_g || !product.length_cm || !product.width_cm || !product.height_cm) missing.push("Measured weight and carton size");
  let images: string[] = [];
  try {
    images = JSON.parse(product.images || "[]");
  } catch {
    images = [];
  }
  if (!product.title_en || !product.description_en || images.length < 3) missing.push("English title, description, and 3 images");
  if (!product.local_market_sle || !product.local_market_source || !product.local_market_date) missing.push("Local market price, source, and date");
  if (!product.hs_code || product.duty_bps == null || !product.hs_signed_by) missing.push("HS code, duty band, and signer");
  const hit = complianceHit(`${product.title_en || ""} ${product.tags || ""} ${product.description_en || ""}`);
  if (hit) missing.push(`Blocked item: ${hit}`);
  if ((product.duty_bps || 0) >= 3500) missing.push("35% duty band is held back for the first batch");
  return { ok: missing.length === 0, missing, hit };
}

function nextCode(key: string, prefix: string) {
  const row = one<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  const n = Number(row?.value || "100") + 1;
  run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, String(n));
  const year = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Freetown", year: "2-digit" }).format(new Date());
  return `${prefix}-${year}-${String(n).padStart(5, "0")}`;
}

function addWallet(userId: number, type: string, amount: number, ref: string, note: string) {
  let w = one<{ balance_sle: number; frozen_sle: number }>("SELECT balance_sle, frozen_sle FROM wallets WHERE user_id = ?", userId);
  if (!w) {
    insert("INSERT INTO wallets (user_id, balance_sle, frozen_sle) VALUES (?, 0, 0)", userId);
    w = { balance_sle: 0, frozen_sle: 0 };
  }
  const next = w.balance_sle + amount;
  if (next < 0) throw new RuleError("Wallet balance is too low.");
  run("UPDATE wallets SET balance_sle = ? WHERE user_id = ?", next, userId);
  insert(
    "INSERT INTO wallet_txns (user_id, type, amount_sle, balance_after, frozen_after, ref, note, created_at) VALUES (?,?,?,?,?,?,?,?)",
    userId,
    type,
    amount,
    next,
    w.frozen_sle,
    ref,
    note,
    nowIso(),
  );
  return next;
}

function moveWallet(userId: number, amount: number, ref: string, spend: boolean) {
  const w = one<{ balance_sle: number; frozen_sle: number }>("SELECT balance_sle, frozen_sle FROM wallets WHERE user_id = ?", userId);
  if (!w || w.frozen_sle < amount) {
    if (spend && (!w || w.frozen_sle === 0)) addWallet(userId, "pay", -amount, ref, "Order payment");
    return;
  }
  const frozen = w.frozen_sle - amount;
  const balance = spend ? w.balance_sle : w.balance_sle + amount;
  run("UPDATE wallets SET balance_sle = ?, frozen_sle = ? WHERE user_id = ?", balance, frozen, userId);
  insert(
    "INSERT INTO wallet_txns (user_id, type, amount_sle, balance_after, frozen_after, ref, note, created_at) VALUES (?,?,?,?,?,?,?,?)",
    userId,
    spend ? "pay" : "release",
    spend ? 0 : amount,
    balance,
    frozen,
    ref,
    spend ? "Order payment" : "Payment released",
    nowIso(),
  );
}

function holdWallet(userId: number, amount: number, ref: string) {
  if (amount <= 0) return;
  let w = one<{ balance_sle: number; frozen_sle: number }>("SELECT balance_sle, frozen_sle FROM wallets WHERE user_id = ?", userId);
  if (!w) {
    insert("INSERT INTO wallets (user_id, balance_sle, frozen_sle) VALUES (?, 0, 0)", userId);
    w = { balance_sle: 0, frozen_sle: 0 };
  }
  if (w.balance_sle < amount) throw new RuleError("Wallet balance is too low.");
  const balance = w.balance_sle - amount;
  const frozen = w.frozen_sle + amount;
  run("UPDATE wallets SET balance_sle = ?, frozen_sle = ? WHERE user_id = ?", balance, frozen, userId);
  insert(
    "INSERT INTO wallet_txns (user_id, type, amount_sle, balance_after, frozen_after, ref, note, created_at) VALUES (?,?,?,?,?,?,?,?)",
    userId,
    "hold",
    -amount,
    balance,
    frozen,
    ref,
    "Held for checkout",
    nowIso(),
  );
}

function takeStock(product: ProductRow, variant: VariantRow | null, qty: number) {
  if (product.zone !== "instock") return;
  if (variant && variant.stock != null) {
    const info = run("UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?", qty, variant.id, qty);
    if (Number(info.changes) !== 1) throw new RuleError("Not enough in the Freetown warehouse.");
    run("UPDATE products SET stock = (SELECT COALESCE(SUM(stock),0) FROM variants WHERE product_id = ?) WHERE id = ?", product.id, product.id);
  } else {
    const info = run("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?", qty, product.id, qty);
    if (Number(info.changes) !== 1) throw new RuleError("Not enough in the Freetown warehouse.");
  }
}

function restoreStock(orderId: number) {
  const order = one<{ zone: string }>("SELECT zone FROM orders WHERE id = ?", orderId);
  if (!order || order.zone !== "instock") return;
  const items = many<{ product_id: number | null; variant_id: number | null; qty: number }>(
    "SELECT product_id, variant_id, qty FROM order_items WHERE order_id = ?",
    orderId,
  );
  for (const item of items) {
    if (item.variant_id) run("UPDATE variants SET stock = COALESCE(stock,0) + ? WHERE id = ?", item.qty, item.variant_id);
    if (item.product_id) {
      const variants = one<{ c: number }>("SELECT COUNT(*) AS c FROM variants WHERE product_id = ?", item.product_id);
      if (variants && variants.c > 0) {
        run("UPDATE products SET stock = (SELECT COALESCE(SUM(stock),0) FROM variants WHERE product_id = ?) WHERE id = ?", item.product_id, item.product_id);
      } else run("UPDATE products SET stock = COALESCE(stock,0) + ? WHERE id = ?", item.qty, item.product_id);
    }
  }
}

export type CartLine = {
  itemId: number;
  product: ProductRow;
  variant: VariantRow | null;
  qty: number;
  unit: number;
  goods: number;
  intl: number;
  airDelta: number;
  quote: PriceQuote;
};

export function cartLines(token: string | undefined): CartLine[] {
  if (!token) return [];
  const cart = one<{ id: number }>("SELECT id FROM carts WHERE token = ?", token);
  if (!cart) return [];
  const rows = many<{ id: number; product_id: number; variant_id: number | null; qty: number }>(
    "SELECT id, product_id, variant_id, qty FROM cart_items WHERE cart_id = ?",
    cart.id,
  );
  const out: CartLine[] = [];
  for (const row of rows) {
    const product = one<ProductRow>("SELECT * FROM products WHERE id = ?", row.product_id);
    if (!product || (product.status !== "live" && product.status !== "quote")) continue;
    const variant = row.variant_id ? one<VariantRow>("SELECT * FROM variants WHERE id = ?", row.variant_id) || null : null;
    const quote = priceOf(product, false);
    const delta = variant?.price_delta_sle || 0;
    const shown = presentSplit(product.zone === "instock" ? "instock" : "preorder", quote, delta);
    out.push({
      itemId: row.id,
      product,
      variant,
      qty: row.qty,
      unit: shown.shelf,
      goods: shown.goods,
      intl: shown.intl,
      airDelta: quote.airDeltaSle,
      quote,
    });
  }
  return out;
}

export function addToCart(token: string, userId: number | null, productId: number, variantId: number | null, qty: number) {
  const q = Math.floor(qty);
  if (q < 1 || q > 99) throw new RuleError("Quantity must be between 1 and 99.");
  const product = one<ProductRow>("SELECT * FROM products WHERE id = ?", productId);
  if (!product || product.status !== "live") throw new RuleError("That item is not for sale.");
  return tx(() => {
    let cart = one<{ id: number }>("SELECT id FROM carts WHERE token = ?", token);
    if (!cart) {
      const id = insert("INSERT INTO carts (token, user_id, updated_at) VALUES (?,?,?)", token, userId, nowIso());
      cart = { id };
    } else if (userId) run("UPDATE carts SET user_id = ? WHERE id = ?", userId, cart.id);
    const existing = one<{ id: number }>(
      "SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ? AND IFNULL(variant_id,0) = IFNULL(?,0)",
      cart.id,
      productId,
      variantId,
    );
    if (existing) run("UPDATE cart_items SET qty = MIN(99, qty + ?) WHERE id = ?", q, existing.id);
    else insert("INSERT INTO cart_items (cart_id, product_id, variant_id, qty) VALUES (?,?,?,?)", cart.id, productId, variantId, q);
    run("UPDATE carts SET updated_at = ? WHERE id = ?", nowIso(), cart.id);
  });
}

export function setQty(token: string, itemId: number, qty: number) {
  const cart = one<{ id: number }>("SELECT id FROM carts WHERE token = ?", token);
  if (!cart) return;
  const q = Math.floor(qty);
  if (q <= 0) run("DELETE FROM cart_items WHERE id = ? AND cart_id = ?", itemId, cart.id);
  else run("UPDATE cart_items SET qty = ? WHERE id = ? AND cart_id = ?", Math.min(99, q), itemId, cart.id);
}

export type PricedZone = {
  zone: "instock" | "preorder";
  lines: CartLine[];
  goods: number;
  intl: number;
  delivery: number;
  discount: number;
  total: number;
  airExtra: number;
};

export type PricedCart = {
  zones: PricedZone[];
  grand: number;
  split: boolean;
  deposit: number;
  balance: number;
  settings: ReturnType<typeof getSettings>;
  discount: number;
  couponCode: string | null;
  couponId: number | null;
};

export function priceCart(lines: CartLine[], ship: "pickup" | "freetown" | "upcountry", air: boolean, partnerFee = 0): PricedCart {
  const settings = getSettings();
  const zones: PricedZone[] = [];
  let feeLeft = ship === "upcountry" ? Math.max(0, partnerFee) : 0;
  for (const zone of ["instock", "preorder"] as const) {
    const group = lines.filter((l) => (l.product.zone === "instock" ? "instock" : "preorder") === zone);
    if (!group.length) continue;
    let goods = 0;
    let intl = 0;
    let airExtra = 0;
    for (const line of group) {
      const airAdd = zone === "preorder" && air ? line.airDelta : 0;
      goods += line.goods * line.qty;
      intl += (line.intl + airAdd) * line.qty;
      airExtra += airAdd * line.qty;
    }
    const merch = goods + intl;
    let delivery = 0;
    if (ship === "freetown") {
      if (!(zone === "instock" && merch >= settings.free_delivery_sle)) delivery = settings.delivery_sle;
    }
    if (feeLeft) {
      delivery += feeLeft;
      feeLeft = 0;
    }
    zones.push({ zone, lines: group, goods, intl, delivery, discount: 0, total: merch + delivery, airExtra });
  }
  const grand = zones.reduce((s, z) => s + z.total, 0);
  const split = grand > settings.split_threshold_sle;
  const deposit = split ? divRound(BigInt(grand) * BigInt(settings.deposit_bps), 10_000n) : grand;
  return { zones, grand, split, deposit, balance: grand - deposit, settings, discount: 0, couponCode: null, couponId: null };
}

type CouponRow = {
  id: number;
  code: string;
  kind: string;
  value: number;
  cap_sle: number;
  min_sle: number;
  zone: string;
  max_uses: number;
  used_count: number;
  per_user: number;
  active: number;
  starts_at: string;
  ends_at: string;
};

function eligibleMerch(priced: PricedCart, zone: string) {
  return priced.zones.reduce((sum, item) => {
    const ok = zone === "any" || zone === "diaspora" || zone === item.zone;
    return sum + (ok ? item.goods + item.intl : 0);
  }, 0);
}

export function quoteCoupon(userId: number, code: string, priced: PricedCart, source: string): { id: number; code: string; discount: number; zone: string } {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(normalized)) throw new RuleError("Enter the code as letters and numbers.");
  const row = one<CouponRow>("SELECT * FROM coupons WHERE code = ?", normalized);
  if (!row || !row.active) throw new RuleError("That code is not active.");
  const now = nowIso();
  if (now < row.starts_at || now > row.ends_at) throw new RuleError("That code is outside its dates.");
  if (row.zone === "diaspora" && source !== "diaspora") throw new RuleError("That code is only for family checkout.");
  if (row.zone !== "any" && row.zone !== "diaspora" && !priced.zones.some((item) => item.zone === row.zone)) {
    throw new RuleError("That code does not match this cart.");
  }
  const held = one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM coupon_uses WHERE coupon_id = ? AND user_id = ? AND status != 'released'",
    row.id,
    userId,
  );
  if (row.per_user && (held?.c || 0) >= row.per_user) throw new RuleError("You have already used that code.");
  if (row.max_uses && row.used_count >= row.max_uses) throw new RuleError("That code is used up.");
  const base = eligibleMerch(priced, row.zone);
  if (base < row.min_sle) throw new RuleError("The goods total is under the minimum for this code.");
  let discount = row.kind === "percent" ? divRound(BigInt(base) * BigInt(row.value), 10_000n) : row.value;
  if (row.cap_sle > 0) discount = Math.min(discount, row.cap_sle);
  discount = Math.min(Math.max(0, discount), base);
  if (discount <= 0) throw new RuleError("That code does not change this bill.");
  return { id: row.id, code: row.code, discount, zone: row.zone };
}

export function applyCoupon(priced: PricedCart, hit: { id: number; code: string; discount: number; zone: string }): PricedCart {
  const eligible = (item: PricedZone) => hit.zone === "any" || hit.zone === "diaspora" || hit.zone === item.zone;
  const base = eligibleMerch(priced, hit.zone);
  const cut = Math.min(hit.discount, base);
  const indexes = priced.zones.map((item, index) => (eligible(item) && item.goods + item.intl > 0 ? index : -1)).filter((index) => index >= 0);
  let left = cut;
  const zones = priced.zones.map((item) => ({ ...item, discount: 0 }));
  indexes.forEach((index, n) => {
    const item = zones[index];
    const merch = item.goods + item.intl;
    const share = n === indexes.length - 1 ? left : Math.floor((cut * merch) / base);
    left -= share;
    item.discount = share;
    item.total = item.goods + item.intl + item.delivery - share;
  });
  const grand = zones.reduce((sum, item) => sum + item.total, 0);
  const split = grand > priced.settings.split_threshold_sle;
  const deposit = split ? divRound(BigInt(grand) * BigInt(priced.settings.deposit_bps), 10_000n) : grand;
  return { ...priced, zones, grand, split, deposit, balance: grand - deposit, discount: cut, couponCode: hit.code, couponId: hit.id };
}

export type CheckoutInput = {
  userId: number;
  lines: { productId: number; variantId: number | null; qty: number }[];
  shipMethod: "pickup" | "freetown" | "upcountry";
  pickupPointId?: number | null;
  address?: { name: string; phone: string; area: string; line: string } | null;
  recipient?: { name: string; phone: string; city: string; line: string } | null;
  freightMode: "sea" | "air";
  useWallet: boolean;
  source: string;
  lang: Lang;
  quoteId?: number | null;
  clearToken?: string | null;
  couponCode?: string | null;
};

export function checkout(input: CheckoutInput) {
  return tx(() => checkoutInner(input));
}

function checkoutInner(input: CheckoutInput) {
  const built: CartLine[] = [];
  for (const line of input.lines) {
    const product = one<ProductRow>("SELECT * FROM products WHERE id = ?", line.productId);
    if (!product || (product.status !== "live" && product.status !== "quote")) throw new RuleError("An item is no longer for sale.");
    if (line.qty < 1 || line.qty > 99) throw new RuleError("Quantity must be between 1 and 99.");
    const variant = line.variantId ? one<VariantRow>("SELECT * FROM variants WHERE id = ? AND product_id = ?", line.variantId, product.id) : null;
    if (line.variantId && !variant) throw new RuleError("Choose a size again.");
    const quote = priceOf(product, false);
    const delta = variant?.price_delta_sle || 0;
    const shown = presentSplit(product.zone === "instock" ? "instock" : "preorder", quote, delta);
    built.push({
      itemId: 0,
      product,
      variant: variant || null,
      qty: line.qty,
      unit: shown.shelf,
      goods: shown.goods,
      intl: shown.intl,
      airDelta: quote.airDeltaSle,
      quote,
    });
  }
  if (!built.length) throw new RuleError("Nothing to check out.");
  if (input.source === "diaspora" && (!input.recipient?.name.trim() || !input.recipient.phone.trim())) {
    throw new RuleError("Add the person in Sierra Leone who will receive this.");
  }
  if (input.shipMethod === "freetown" && !input.address?.line.trim()) throw new RuleError("Add an address.");
  let partnerFee = 0;
  if (input.shipMethod === "pickup" || input.shipMethod === "upcountry") {
    const point = one<{ id: number; kind: string; fee_sle: number }>(
      "SELECT id, kind, fee_sle FROM pickup_points WHERE id = ? AND active = 1",
      input.pickupPointId || 0,
    );
    if (!point) throw new RuleError("Choose a pickup point.");
    if (input.shipMethod === "pickup" && point.kind !== "local") throw new RuleError("Choose a Freetown pickup.");
    if (input.shipMethod === "upcountry" && point.kind !== "partner") throw new RuleError("Choose a partner desk in Bo, Kenema, or Makeni.");
    partnerFee = input.shipMethod === "upcountry" ? point.fee_sle : 0;
  }
  let priced = priceCart(built, input.shipMethod, input.freightMode === "air", partnerFee);
  const couponCode = (input.couponCode || "").trim();
  if (couponCode) priced = applyCoupon(priced, quoteCoupon(input.userId, couponCode, priced, input.source));
  const fx = activeFx();
  const wallet = one<{ balance_sle: number }>("SELECT balance_sle FROM wallets WHERE user_id = ?", input.userId);
  const dueNow = priced.deposit;
  const walletUse = input.useWallet ? Math.min(wallet?.balance_sle || 0, dueNow) : 0;
  const external = dueNow - walletUse;
  for (const line of built) takeStock(line.product, line.variant, line.qty);

  const methods = input.source === "diaspora" ? ["intl_card"] : ["orange", "afri", "card", "bank", "ussd"];
  const groupNumber = nextCode("group_seq", "PG");
  if (walletUse) holdWallet(input.userId, walletUse, groupNumber);
  const groupId = insert(
    "INSERT INTO payment_groups (user_id, number, purpose, total_sle, charged_sle, method, status, raw_json, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    input.userId,
    groupNumber,
    "order",
    priced.grand,
    external,
    null,
    "pending",
    JSON.stringify({
      walletSle: walletUse,
      walletHeld: walletUse > 0,
      lang: input.lang,
      source: input.source,
      methods,
      couponId: priced.couponId,
      couponCode: priced.couponCode,
      discount: priced.discount,
    }),
    nowIso(),
  );
  if (priced.couponId && priced.discount > 0) {
    const reserved = run(
      "UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND active = 1 AND (max_uses = 0 OR used_count < max_uses)",
      priced.couponId,
    );
    if (Number(reserved.changes) !== 1) throw new RuleError("That code is used up.");
    insert(
      "INSERT INTO coupon_uses (coupon_id, user_id, group_id, amount_sle, status, created_at) VALUES (?,?,?,?,?,?)",
      priced.couponId,
      input.userId,
      groupId,
      priced.discount,
      "held",
      nowIso(),
    );
  }

  const orderIds: number[] = [];
  let depositLeft = priced.deposit;
  priced.zones.forEach((zone, index) => {
    let deposit = priced.split ? divRound(BigInt(zone.total) * BigInt(priced.settings.deposit_bps), 10_000n) : zone.total;
    if (index === priced.zones.length - 1) deposit = depositLeft;
    depositLeft -= deposit;
    const orderId = insert(
      `INSERT INTO orders (
        number, user_id, group_id, zone, source, status, shipping_method, pickup_point_id, address_json, recipient_json,
        freight_mode, fx_sle_per_usd_e4, fx_usd_cny_e4, fx_buffer_bps, goods_sle, intl_sle, delivery_sle, air_delta_sle,
        total_sle, buffer_sle, wallet_sle, pay_mode, deposit_sle, balance_sle, deposit_paid, balance_paid, price_locked, quote_id, discount_sle, coupon_code, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      nextCode("order_seq", "LD"),
      input.userId,
      groupId,
      zone.zone,
      input.source,
      "PENDING_PAYMENT",
      input.shipMethod,
      input.shipMethod === "freetown" ? null : input.pickupPointId || null,
      input.address ? JSON.stringify(input.address) : null,
      input.recipient ? JSON.stringify(input.recipient) : null,
      zone.zone === "preorder" ? input.freightMode : "sea",
      fx.slePerUsdE4,
      fx.usdCnyE4,
      fx.bufferBps,
      zone.goods,
      zone.intl,
      zone.delivery,
      zone.airExtra,
      zone.total,
      0,
      0,
      priced.split ? "split" : "full",
      priced.split ? deposit : zone.total,
      priced.split ? zone.total - deposit : 0,
      0,
      0,
      0,
      input.quoteId || null,
      zone.discount,
      priced.couponCode,
      nowIso(),
    );
    orderIds.push(orderId);
    for (const line of zone.lines) {
      const airAdd = zone.zone === "preorder" && input.freightMode === "air" ? line.airDelta : 0;
      insert(
        `INSERT INTO order_items (order_id, product_id, variant_id, title, sku, qty, unit_sle, unit_goods_sle, unit_intl_sle, snapshot_json)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        orderId,
        line.product.id,
        line.variant?.id || null,
        line.product.title_en,
        line.variant?.sku || line.product.sku,
        line.qty,
        line.unit + airAdd,
        line.goods,
        line.intl + airAdd,
        JSON.stringify({ ...line.quote, variant: line.variant?.label || null, air: input.freightMode === "air" }),
      );
    }
    insert(
      "INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?,?,?,?,?)",
      orderId,
      "PENDING_PAYMENT",
      "Order opened",
      `user:${input.userId}`,
      nowIso(),
    );
  });

  if (input.clearToken) {
    const cart = one<{ id: number }>("SELECT id FROM carts WHERE token = ?", input.clearToken);
    if (cart) run("DELETE FROM cart_items WHERE cart_id = ?", cart.id);
  }
  if (external === 0) markGroupPaid(groupId, "wallet", `wallet-${groupId}`, 0);
  return { groupId, orderIds, external, walletUse, grand: priced.grand, split: priced.split, paid: external === 0 };
}

function markGroupPaid(groupId: number, method: string, externalRef: string, amount: number) {
  const group = one<{
    id: number;
    user_id: number;
    number: string;
    purpose: string;
    total_sle: number;
    charged_sle: number;
    status: string;
    raw_json: string | null;
  }>("SELECT * FROM payment_groups WHERE id = ?", groupId);
  if (!group) throw new RuleError("Payment not found.");
  if (group.status === "success") throw new RuleError("Already paid.");
  if (amount !== group.charged_sle) throw new RuleError("Amount does not match the bill.");
  const plan = JSON.parse(group.raw_json || "{}") as { walletSle?: number; walletHeld?: boolean; lang?: Lang; orderId?: number; delta?: number };
  const lang = plan.lang || "en";
  if (plan.walletSle) {
    if (plan.walletHeld) moveWallet(group.user_id, plan.walletSle, group.number, true);
    else addWallet(group.user_id, "pay", -plan.walletSle, group.number, "Order payment");
  }
  run("UPDATE coupon_uses SET status = 'used' WHERE group_id = ? AND status = 'held'", groupId);
  if (amount > 0) {
    insert(
      "INSERT INTO payments (group_id, user_id, purpose, method, amount_sle, status, external_ref, created_at) VALUES (?,?,?,?,?,?,?,?)",
      groupId,
      group.user_id,
      group.purpose,
      method,
      amount,
      "success",
      externalRef,
      nowIso(),
    );
  }
  if (plan.walletSle) {
    insert(
      "INSERT INTO payments (group_id, user_id, purpose, method, amount_sle, status, external_ref, created_at) VALUES (?,?,?,?,?,?,?,?)",
      groupId,
      group.user_id,
      group.purpose,
      "wallet",
      plan.walletSle,
      "success",
      `${externalRef}-wallet`,
      nowIso(),
    );
  }
  run("UPDATE payment_groups SET status = 'success', method = ?, external_ref = ? WHERE id = ?", method, externalRef, groupId);

  if (group.purpose === "wallet_topup") {
    addWallet(group.user_id, "topup", group.total_sle, group.number, "Top up");
    return;
  }
  if (group.purpose === "air_upgrade" && plan.orderId && plan.delta) {
    run(
      "UPDATE orders SET freight_mode = 'air', intl_sle = intl_sle + ?, total_sle = total_sle + ?, air_delta_sle = air_delta_sle + ? WHERE id = ?",
      plan.delta,
      plan.delta,
      plan.delta,
      plan.orderId,
    );
    insert(
      "INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?,?,?,?,?)",
      plan.orderId,
      "AIR",
      `Switched to air. Difference ${plan.delta} SLE`,
      "pay",
      nowIso(),
    );
    return;
  }

  const orders = many<{
    id: number;
    number: string;
    user_id: number;
    zone: string;
    total_sle: number;
    pay_mode: string;
    fx_buffer_bps: number;
  }>("SELECT * FROM orders WHERE group_id = ?", groupId);
  const grand = orders.reduce((s, o) => s + o.total_sle, 0) || 1;
  let walletLeft = plan.walletSle || 0;
  orders.forEach((order, index) => {
    const share = index === orders.length - 1 ? walletLeft : Math.round(((plan.walletSle || 0) * order.total_sle) / grand);
    walletLeft -= share;
    const split = order.pay_mode === "split";
    const buffer = split ? 0 : divRound(BigInt(order.total_sle) * BigInt(order.fx_buffer_bps), 10_000n);
    run(
      `UPDATE orders SET status = ?, deposit_paid = 1, balance_paid = ?, price_locked = 1, paid_at = ?, wallet_sle = ?, buffer_sle = ?,
        balance_due_at = ? WHERE id = ?`,
      split ? "DEPOSIT_HELD" : "PAID",
      split ? 0 : 1,
      nowIso(),
      share,
      buffer,
      split ? addHours(nowIso(), getSettings().deposit_hours) : null,
      order.id,
    );
    const items = many<{ product_id: number | null; qty: number }>("SELECT product_id, qty FROM order_items WHERE order_id = ?", order.id);
    for (const item of items) {
      if (item.product_id) run("UPDATE products SET sold_count = sold_count + ? WHERE id = ?", item.qty, item.product_id);
    }
    insert(
      "INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?,?,?,?,?)",
      order.id,
      split ? "DEPOSIT_HELD" : "PAID",
      split ? "Deposit received. Price locked." : "Payment received. Price locked.",
      "monime",
      nowIso(),
    );
    notifyUser(order.user_id, "paid", { number: order.number, total: split ? order.total_sle : order.total_sle }, lang, order.id);
  });
}

export function settlePayment(input: { groupId: number; externalRef: string; status: "success" | "failed"; method: string; amountSle: number }) {
  return tx(() => {
    const prev = one<{ id: number }>("SELECT id FROM payments WHERE external_ref = ?", input.externalRef);
    if (prev) return { duplicate: true as const, paymentId: prev.id };
    const group = one<{ id: number; user_id: number; status: string; charged_sle: number; number: string }>(
      "SELECT * FROM payment_groups WHERE id = ?",
      input.groupId,
    );
    if (!group) throw new RuleError("Payment not found.");
    if (group.status === "success" && input.status === "success") {
      insert(
        "INSERT INTO payments (group_id, user_id, purpose, method, amount_sle, status, external_ref, created_at) VALUES (?,?,?,?,?,?,?,?)",
        input.groupId,
        group.user_id,
        "duplicate",
        input.method,
        input.amountSle,
        "success",
        input.externalRef,
        nowIso(),
      );
      const order = one<{ id: number; number: string }>("SELECT id, number FROM orders WHERE group_id = ? LIMIT 1", input.groupId);
      if (order) {
        insert(
          "INSERT INTO refunds (order_id, reason, rule, amount_sle, choice, status, requested_by, created_at, paid_at) VALUES (?,?,?,?,?,?,?,?,?)",
          order.id,
          "Duplicate payment returned",
          "platform_fault",
          input.amountSle,
          "refund",
          "paid",
          "system",
          nowIso(),
          nowIso(),
        );
        notifyUser(group.user_id, "refund", { number: order.number, amount: input.amountSle, method: input.method }, "en", order.id);
      }
      return { duplicate: false as const, excess: true as const };
    }
    if (input.status === "failed") {
      insert(
        "INSERT INTO payments (group_id, user_id, purpose, method, amount_sle, status, external_ref, created_at) VALUES (?,?,?,?,?,?,?,?)",
        input.groupId,
        group.user_id,
        "order",
        input.method,
        input.amountSle,
        "failed",
        input.externalRef,
        nowIso(),
      );
      const order = one<{ id: number; number: string }>("SELECT id, number FROM orders WHERE group_id = ? LIMIT 1", input.groupId);
      if (order) notifyUser(group.user_id, "pay_exception", { number: order.number }, "en", order.id);
      return { duplicate: false as const, failed: true as const };
    }
    markGroupPaid(input.groupId, input.method, input.externalRef, input.amountSle);
    return { duplicate: false as const, paid: true as const };
  });
}

export function verifySignature(secret: string, body: string, header: string | null) {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function startTopup(userId: number, amount: number, lang: Lang) {
  if (amount < 20) throw new RuleError("Minimum top up is Le 20.");
  const id = insert(
    "INSERT INTO payment_groups (user_id, number, purpose, total_sle, charged_sle, status, raw_json, created_at) VALUES (?,?,?,?,?,?,?,?)",
    userId,
    nextCode("group_seq", "PG"),
    "wallet_topup",
    amount,
    amount,
    "pending",
    JSON.stringify({ lang, methods: ["orange", "afri", "card"], walletSle: 0 }),
    nowIso(),
  );
  return id;
}

export function advanceOrder(
  actor: StaffActor,
  orderId: number,
  to: string,
  extra: { note?: string; evidence?: string; bl?: string; measuredCm3?: number; code?: string } = {},
) {
  return tx(() => {
    const order = one<{ id: number; zone: string; status: string; number: string; user_id: number; pickup_code: string | null; freight_mode: string }>(
      "SELECT * FROM orders WHERE id = ?",
      orderId,
    );
    if (!order) throw new RuleError("Order not found.");
    if (!canTransition(order.zone, order.status, to)) throw new RuleError(`Cannot move ${order.status} to ${to}.`);
    if (actor.role !== "super_admin" && actor.role !== "ops") {
      const warehouseTo = ["PICKING", "IN_CN_WH", "CONSOLIDATED", "ARRIVED", "CLEARING", "IN_SL_WH", "READY", "COMPLETED"];
      const buyTo = ["PROCURING", "PROCURED", "IN_CN_WH"];
      const allowed = actor.role === "warehouse" ? warehouseTo : actor.role === "procurement" ? buyTo : [];
      if (!allowed.includes(to)) throw new RuleError(`The ${actor.role} role cannot move an order to ${to}.`);
    }
    if (to === "PROCURED" && !(extra.note || extra.evidence)) throw new RuleError("Add the 1688 order number or a screenshot.");
    if (to === "IN_CN_WH" && !(extra.evidence || extra.note)) throw new RuleError("Add the weighing photo.");
    if (to === "SHIPPED" && !extra.bl) throw new RuleError("Add the bill of lading number.");
    if (to === "COMPLETED") {
      if (!extra.code || extra.code !== order.pickup_code) throw new RuleError("Pickup code does not match.");
    }
    let code = order.pickup_code;
    if (to === "READY") {
      do {
        code = randomCode(6);
      } while (one("SELECT id FROM orders WHERE pickup_code = ?", code));
    }
    if (to === "CONSOLIDATED") {
      const container = ensureOpenContainer();
      const cm3 = extra.measuredCm3 || orderVolume(orderId);
      const exists = one("SELECT id FROM container_lines WHERE order_id = ?", orderId);
      if (!exists) insert("INSERT INTO container_lines (container_id, order_id, cm3) VALUES (?,?,?)", container.id, orderId, cm3);
    }
    run("UPDATE orders SET status = ?, pickup_code = COALESCE(?, pickup_code) WHERE id = ?", to, to === "READY" ? code : null, orderId);
    insert(
      "INSERT INTO order_events (order_id, status, note, evidence_url, evidence_kind, actor, created_at) VALUES (?,?,?,?,?,?,?)",
      orderId,
      to,
      [extra.note, extra.bl ? `B/L ${extra.bl}` : ""].filter(Boolean).join(" · ") || null,
      extra.evidence || null,
      extra.evidence ? "photo" : extra.bl ? "bl" : null,
      actor.email,
      nowIso(),
    );
    if (extra.bl) {
      const line = one<{ container_id: number }>("SELECT container_id FROM container_lines WHERE order_id = ?", orderId);
      if (line) run("UPDATE containers SET bl_no = ? WHERE id = ?", extra.bl, line.container_id);
    }
    const place = one<{ name: string }>(
      "SELECT p.name AS name FROM orders o LEFT JOIN pickup_points p ON p.id = o.pickup_point_id WHERE o.id = ?",
      orderId,
    );
    const key = ({ PROCURED: "procured", IN_CN_WH: "in_cn_wh", SHIPPED: "shipped", ARRIVED: "arrived", READY: "ready" } as Record<string, string>)[to];
    if (key) {
      notifyUser(order.user_id, key, { number: order.number, code: code || "", place: place?.name || "Kissy warehouse" }, "en", orderId);
    }
    return { code };
  });
}

function orderVolume(orderId: number) {
  const items = many<{ qty: number; snapshot_json: string }>("SELECT qty, snapshot_json FROM order_items WHERE order_id = ?", orderId);
  let cm3 = 0;
  for (const item of items) {
    const snap = JSON.parse(item.snapshot_json || "{}") as { billCm3?: number };
    cm3 += (snap.billCm3 || 50_000) * item.qty;
  }
  return Math.max(cm3, 1);
}

function ensureOpenContainer() {
  let container = one<{ id: number; target_cm3: number; code: string; week_label: string; rollover_count: number }>(
    "SELECT * FROM containers WHERE status = 'open' ORDER BY id DESC LIMIT 1",
  );
  if (!container) {
    const settings = getSettings();
    const id = insert(
      "INSERT INTO containers (code, week_label, status, target_cm3, created_at) VALUES (?,?,?,?,?)",
      `CT-${weekLabel(new Date()).replace(/\s/g, "")}-${randomCode(4)}`,
      weekLabel(),
      "open",
      settings.container_target_cm3,
      nowIso(),
    );
    container = one("SELECT * FROM containers WHERE id = ?", id)!;
  }
  return container;
}

export function containerProgress() {
  const container = one<{ id: number; target_cm3: number; code: string; week_label: string; rollover_count: number; status: string }>(
    "SELECT * FROM containers WHERE status = 'open' ORDER BY id DESC LIMIT 1",
  );
  if (!container) return { pct: 0, cm3: 0, target: getSettings().container_target_cm3, code: "—", week: weekLabel(), rollover: 0 };
  const sum = one<{ v: number }>("SELECT COALESCE(SUM(cm3),0) AS v FROM container_lines WHERE container_id = ?", container.id);
  const cm3 = sum?.v || 0;
  return {
    pct: Math.round((cm3 / container.target_cm3) * 1000) / 10,
    cm3,
    target: container.target_cm3,
    code: container.code,
    week: container.week_label,
    rollover: container.rollover_count,
    id: container.id,
  };
}

export function runCutoff(actor: StaffActor) {
  assertRole(actor, "warehouse");
  return tx(() => {
    const container = ensureOpenContainer();
    const sum = one<{ v: number }>("SELECT COALESCE(SUM(cm3),0) AS v FROM container_lines WHERE container_id = ?", container.id);
    const vol = sum?.v || 0;
    if (vol >= container.target_cm3) {
      run("UPDATE containers SET status = 'ready', note = ? WHERE id = ?", "Full. Ready for the bill of lading.", container.id);
      ensureOpenContainer();
      return { full: true, cm3: vol };
    }
    run("UPDATE containers SET rollover_count = rollover_count + 1, note = ? WHERE id = ?", "Short week. Rolled to next Sunday.", container.id);
    const lines = many<{ order_id: number }>("SELECT order_id FROM container_lines WHERE container_id = ?", container.id);
    for (const line of lines) {
      const order = one<{ id: number; number: string; user_id: number }>("SELECT id, number, user_id FROM orders WHERE id = ?", line.order_id);
      if (order) notifyUser(order.user_id, "rolled", { number: order.number }, "en", order.id);
    }
    return { full: false, cm3: vol };
  });
}

export function shipLcl(actor: StaffActor, containerId: number) {
  assertRole(actor, "warehouse");
  const container = one<{ rollover_count: number; status: string }>("SELECT * FROM containers WHERE id = ?", containerId);
  if (!container || container.rollover_count < 2) throw new RuleError("LCL is only after two short weeks.");
  run("UPDATE containers SET status = 'lcl', note = ? WHERE id = ?", "Shipped short. Platform pays the difference.", containerId);
  audit(actor.email, "lcl", `container:${containerId}`, container, { status: "lcl" });
}

export function redeemPickup(actor: StaffActor, code: string) {
  const order = one<{ id: number }>("SELECT id FROM orders WHERE pickup_code = ? AND status = 'READY'", code.trim());
  if (!order) throw new RuleError("Code not found, or the order is not ready.");
  return advanceOrder(actor, order.id, "COMPLETED", { code: code.trim(), note: "Picked up" });
}

export function confirmBalance(actor: StaffActor, orderId: number) {
  assertRole(actor, "fx");
  return tx(() => {
    const order = one<{ id: number; status: string; zone: string; number: string; user_id: number; total_sle: number; fx_buffer_bps: number }>(
      "SELECT * FROM orders WHERE id = ?",
      orderId,
    );
    if (!order || order.status !== "DEPOSIT_HELD") throw new RuleError("This order is not waiting for a balance.");
    const buffer = divRound(BigInt(order.total_sle) * BigInt(order.fx_buffer_bps), 10_000n);
    run("UPDATE orders SET status = 'PAID', balance_paid = 1, buffer_sle = ? WHERE id = ?", buffer, orderId);
    insert(
      "INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?,?,?,?,?)",
      orderId,
      "PAID",
      "Balance confirmed by finance.",
      actor.email,
      nowIso(),
    );
    audit(actor.email, "balance", order.number, { status: "DEPOSIT_HELD" }, { status: "PAID" });
    notifyUser(order.user_id, "paid", { number: order.number, total: order.total_sle }, "en", orderId);
  });
}

export function requestRefund(input: {
  orderId: number;
  rule: RefundRule;
  reason: string;
  actor: string;
  staff?: StaffActor | null;
  itemId?: number | null;
  choice?: "refund" | "resend";
}) {
  if (input.staff) assertRole(input.staff, "refund");
  return tx(() => {
    const order = one<{
      id: number;
      status: string;
      user_id: number;
      number: string;
      zone: string;
      total_sle: number;
      deposit_sle: number;
      pay_mode: string;
      balance_paid: number;
      price_locked: number;
      fx_sle_per_usd_e4: number;
      fx_usd_cny_e4: number;
      fx_buffer_bps: number;
    }>("SELECT * FROM orders WHERE id = ?", input.orderId);
    if (!order || !order.price_locked) throw new RuleError("This order has no payment to return.");
    if (!input.staff) {
      const allowed = refundRuleForStatus(order.status);
      if (input.rule !== allowed) throw new RuleError("This order can no longer be cancelled here. Open a case.");
    }
    let base = order.pay_mode === "split" && !order.balance_paid ? order.deposit_sle : order.total_sle;
    if (input.rule === "quality" && input.itemId) {
      const item = one<{ unit_sle: number; qty: number }>("SELECT unit_sle, qty FROM order_items WHERE id = ? AND order_id = ?", input.itemId, order.id);
      if (!item) throw new RuleError("Item not on this order.");
      base = item.unit_sle * item.qty;
    }
    if (input.rule === "deposit_timeout") base = order.deposit_sle;
    const amount = input.rule === "cancel_before_load" ? divRound(BigInt(base) * 90n, 100n) : base;
    const choice = input.choice || "refund";
    const usd = sleToUsdCents(amount, {
      slePerUsdE4: order.fx_sle_per_usd_e4,
      usdCnyE4: order.fx_usd_cny_e4,
      bufferBps: order.fx_buffer_bps,
    });
    const needsTwo = usd > 20_000 && choice === "refund";
    const refundId = insert(
      "INSERT INTO refunds (order_id, reason, rule, amount_sle, item_id, choice, status, requested_by, approver1, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      order.id,
      input.reason,
      input.rule,
      choice === "resend" ? 0 : amount,
      input.itemId || null,
      choice,
      needsTwo ? "needs_second" : "approved",
      input.actor,
      input.staff?.email || null,
      nowIso(),
    );
    if (!needsTwo) executeRefund(refundId);
    return { refundId, needsTwo, amount: choice === "resend" ? 0 : amount };
  });
}

function executeRefund(refundId: number) {
  const refund = one<{
    id: number;
    order_id: number;
    amount_sle: number;
    choice: string;
    rule: string;
    status: string;
  }>("SELECT * FROM refunds WHERE id = ?", refundId);
  if (!refund) throw new RuleError("Refund not found.");
  const order = one<{ id: number; user_id: number; number: string; status: string; zone: string; deposit_paid: number }>(
    "SELECT * FROM orders WHERE id = ?",
    refund.order_id,
  );
  if (!order) throw new RuleError("Order not found.");
  if (refund.choice === "resend") {
    const copyId = insert(
      `INSERT INTO orders (number, user_id, zone, source, status, shipping_method, freight_mode, fx_sle_per_usd_e4, fx_usd_cny_e4, fx_buffer_bps,
        goods_sle, intl_sle, delivery_sle, total_sle, pay_mode, deposit_paid, balance_paid, price_locked, note, created_at, paid_at)
       SELECT ?, user_id, zone, 'resend', 'PAID', shipping_method, freight_mode, fx_sle_per_usd_e4, fx_usd_cny_e4, fx_buffer_bps,
        0, 0, 0, 0, 'waiver', 1, 1, 1, ?, ?, ? FROM orders WHERE id = ?`,
      nextCode("order_seq", "LD"),
      `Free resend of ${order.number}`,
      nowIso(),
      nowIso(),
      order.id,
    );
    run("UPDATE refunds SET status = 'reship', paid_at = ? WHERE id = ?", nowIso(), refund.id);
    run("UPDATE orders SET exception = 'RESHIP' WHERE id = ?", order.id);
    insert("INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?,?,?,?,?)", copyId, "PAID", "Free resend", "refund", nowIso());
    return;
  }
  const pay = one<{ method: string }>(
    "SELECT p.method FROM payments p JOIN orders o ON o.group_id = p.group_id WHERE o.id = ? AND p.status = 'success' ORDER BY p.id DESC LIMIT 1",
    order.id,
  );
  const method = pay?.method || "orange";
  const destination = refundDestination(method);
  const paidMethod = destination === "wallet" ? "wallet" : method;
  if (destination === "wallet") addWallet(order.user_id, "refund", refund.amount_sle, order.number, "Refund");
  insert(
    "INSERT INTO payments (order_id, user_id, purpose, method, amount_sle, status, external_ref, created_at) VALUES (?,?,?,?,?,?,?,?)",
    order.id,
    order.user_id,
    "refund",
    paidMethod,
    refund.amount_sle,
    "success",
    `refund-${refund.id}-${randomCode(4)}`,
    nowIso(),
  );
  run("UPDATE refunds SET status = 'paid', paid_at = ? WHERE id = ?", nowIso(), refund.id);
  const cancelRules = ["cancel_before_buy", "cancel_before_load", "platform_fault", "deposit_timeout", "lost_or_delay"];
  if (cancelRules.includes(refund.rule) && order.status !== "COMPLETED") {
    restoreStock(order.id);
    run("UPDATE orders SET status = 'CANCELLED', exception = NULL WHERE id = ?", order.id);
    insert("INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?,?,?,?,?)", order.id, "CANCELLED", refund.rule, "refund", nowIso());
  }
  notifyUser(order.user_id, "refund", { number: order.number, amount: refund.amount_sle, method: paidMethod }, "en", order.id);
}

function releaseGroupHold(groupId: number) {
  const waiting = one<{ c: number }>("SELECT COUNT(*) AS c FROM orders WHERE group_id = ? AND status = 'PENDING_PAYMENT'", groupId);
  if (waiting && waiting.c > 0) return;
  const group = one<{ user_id: number; number: string; raw_json: string | null }>("SELECT user_id, number, raw_json FROM payment_groups WHERE id = ?", groupId);
  if (!group) return;
  const plan = JSON.parse(group.raw_json || "{}") as { walletSle?: number; walletHeld?: boolean };
  if (plan.walletHeld && plan.walletSle) {
    moveWallet(group.user_id, plan.walletSle, group.number, false);
    plan.walletHeld = false;
    run("UPDATE payment_groups SET raw_json = ? WHERE id = ?", JSON.stringify(plan), groupId);
  }
  const use = one<{ id: number; coupon_id: number }>("SELECT id, coupon_id FROM coupon_uses WHERE group_id = ? AND status = 'held'", groupId);
  if (use) {
    run("UPDATE coupon_uses SET status = 'released' WHERE id = ?", use.id);
    run("UPDATE coupons SET used_count = used_count - 1 WHERE id = ? AND used_count > 0", use.coupon_id);
  }
}

export function approveRefund(actor: StaffActor, refundId: number) {
  assertRole(actor, "refund");
  return tx(() => {
    const refund = one<{ id: number; status: string; approver1: string | null }>("SELECT * FROM refunds WHERE id = ?", refundId);
    if (!refund || refund.status !== "needs_second") throw new RuleError("This refund is not waiting for a second person.");
    if (!refund.approver1) {
      run("UPDATE refunds SET approver1 = ? WHERE id = ?", actor.email, refundId);
      audit(actor.email, "refund_first", `refund:${refundId}`, null, { approver1: actor.email });
      return { stage: "first" as const };
    }
    if (refund.approver1 === actor.email) throw new RuleError("A different finance person must approve this.");
    run("UPDATE refunds SET approver2 = ?, status = 'approved' WHERE id = ?", actor.email, refundId);
    executeRefund(refundId);
    audit(actor.email, "refund_second", `refund:${refundId}`, { approver1: refund.approver1 }, { approver2: actor.email });
    return { stage: "paid" as const };
  });
}

export function submitQuote(userId: number, url: string, qty: number, note: string) {
  const parsed = offerHost(url);
  if (!parsed) throw new RuleError("Use a 1688, Taobao, or Tmall link.");
  if (qty < 1) throw new RuleError("Quantity must be at least 1.");
  return insert(
    "INSERT INTO quotes (user_id, url, domain, qty, note, status, created_at) VALUES (?,?,?,?,?,?,?)",
    userId,
    parsed.url,
    parsed.domain,
    qty,
    note,
    "pending",
    nowIso(),
  );
}

export function issueQuote(
  actor: StaffActor | null,
  quoteId: number,
  fields: { title: string; cny: number; weightG: number; l: number; w: number; h: number; dutyPct: number; hs: string; marginPct: number },
  ownerUserId?: number,
) {
  if (actor) assertRole(actor, "price");
  else if (!getSettings().demo_mode) throw new RuleError("Quotes are priced by the buying desk.");
  return tx(() => {
    const quote = one<{ id: number; user_id: number; qty: number; status: string }>("SELECT * FROM quotes WHERE id = ?", quoteId);
    if (!quote || quote.status !== "pending") throw new RuleError("This quote is not waiting.");
    if (!actor && quote.user_id !== ownerUserId) throw new RuleError("Quote not found.");
    const productId = insert(
      `INSERT INTO products (sku, zone, source, title_en, title_zh, title_fr, description_en, description_zh, description_fr,
        highlights_en, highlights_zh, highlights_fr, images, weight_g, length_cm, width_cm, height_cm, purchase_cny_fen,
        domestic_usd_cents, wh_usd_cents, dest_usd_cents, duty_bps, hs_code, hs_signed_by, margin_bps, status,
        is_estimate, air_ok, tags, visual_key, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      `QUOTE-${quote.id}`,
      "preorder",
      "quote",
      fields.title,
      fields.title,
      fields.title,
      "Priced from your link. Size is an estimate until the carton is measured.",
      "按你的链接报价。纸箱尺寸在实测前是预估。",
      "Prix selon votre lien. Taille estimée jusqu'à la mesure du carton.",
      "[]",
      "[]",
      "[]",
      JSON.stringify([1, 2, 3].map((v) => `/art/QUOTE-${quote.id}?v=${v}&c=phone`)),
      fields.weightG,
      fields.l,
      fields.w,
      fields.h,
      Math.round(fields.cny * 100),
      80,
      40,
      70,
      Math.round(fields.dutyPct * 100),
      fields.hs,
      actor?.name || "Demo desk",
      Math.round(fields.marginPct * 100),
      "quote",
      1,
      1,
      "link",
      "phone",
      nowIso(),
    );
    const product = one<ProductRow>("SELECT * FROM products WHERE id = ?", productId)!;
    const priced = priceOf(product);
    const shown = presentSplit("preorder", priced);
    const until = addHours(nowIso(), 24);
    run(
      "UPDATE quotes SET status = 'quoted', product_id = ?, title = ?, price_sle = ?, goods_sle = ?, intl_sle = ?, valid_until = ? WHERE id = ?",
      productId,
      fields.title,
      shown.shelf,
      shown.goods,
      shown.intl,
      until,
      quote.id,
    );
    notifyUser(quote.user_id, "quote", { number: `Q-${quote.id}`, total: shown.shelf * quote.qty }, "en");
    audit(actor?.email || "demo", "quote", `quote:${quote.id}`, { status: "pending" }, { price: shown.shelf });
    return { price: shown.shelf, until };
  });
}

export function acceptQuote(userId: number, quoteId: number, lang: Lang, ship: CheckoutInput["shipMethod"], pickupPointId: number | null, address: CheckoutInput["address"]) {
  expireQuotes();
  const quote = one<{ id: number; user_id: number; product_id: number; qty: number; status: string; valid_until: string }>(
    "SELECT * FROM quotes WHERE id = ?",
    quoteId,
  );
  if (!quote || quote.user_id !== userId) throw new RuleError("Quote not found.");
  if (quote.status !== "quoted") throw new RuleError("This quote is not open.");
  if (new Date(quote.valid_until).getTime() < Date.now()) throw new RuleError("This quote has expired.");
  const result = checkout({
    userId,
    lines: [{ productId: quote.product_id, variantId: null, qty: quote.qty }],
    shipMethod: ship,
    pickupPointId,
    address,
    freightMode: "sea",
    useWallet: false,
    source: "link",
    lang,
    quoteId: quote.id,
  });
  run("UPDATE quotes SET status = 'accepted', order_id = ? WHERE id = ?", result.orderIds[0], quote.id);
  return result;
}

export function rejectQuote(userId: number, quoteId: number) {
  const quote = one<{ user_id: number; status: string }>("SELECT user_id, status FROM quotes WHERE id = ?", quoteId);
  if (!quote || quote.user_id !== userId) throw new RuleError("Quote not found.");
  run("UPDATE quotes SET status = 'rejected' WHERE id = ?", quoteId);
}

export function expireQuotes() {
  run("UPDATE quotes SET status = 'expired' WHERE status = 'quoted' AND valid_until < ?", nowIso());
}

export function switchToAir(userId: number, orderId: number, lang: Lang) {
  const order = one<{ id: number; user_id: number; zone: string; status: string; number: string }>("SELECT * FROM orders WHERE id = ?", orderId);
  if (!order || order.user_id !== userId) throw new RuleError("Order not found.");
  if (order.zone !== "preorder") throw new RuleError("Air is only for sea orders.");
  if (["SHIPPED", "ARRIVED", "CLEARING", "IN_SL_WH", "READY", "COMPLETED", "CANCELLED"].includes(order.status)) {
    throw new RuleError("This order has already left.");
  }
  const items = many<{ product_id: number; qty: number }>("SELECT product_id, qty FROM order_items WHERE order_id = ?", orderId);
  let delta = 0;
  for (const item of items) {
    const product = one<ProductRow>("SELECT * FROM products WHERE id = ?", item.product_id);
    if (!product) continue;
    delta += priceOf(product).airDeltaSle * item.qty;
  }
  if (delta <= 0) {
    tx(() => {
      run(
        "UPDATE orders SET freight_mode = 'air', air_delta_sle = ?, intl_sle = intl_sle + ?, total_sle = CASE WHEN total_sle + ? < 0 THEN 0 ELSE total_sle + ? END WHERE id = ?",
        delta,
        delta,
        delta,
        delta,
        orderId,
      );
      if (delta < 0 && order.status !== "PENDING_PAYMENT") {
        const amount = -delta;
        insert(
          "INSERT INTO refunds (order_id, reason, rule, amount_sle, choice, status, requested_by, created_at, paid_at) VALUES (?,?,?,?,?,?,?,?,?)",
          orderId,
          "Air freight costs less than sea on this parcel",
          "platform_fault",
          amount,
          "refund",
          "paid",
          `user:${userId}`,
          nowIso(),
          nowIso(),
        );
        insert(
          "INSERT INTO payments (order_id, user_id, purpose, method, amount_sle, status, external_ref, created_at) VALUES (?,?,?,?,?,?,?,?)",
          orderId,
          userId,
          "refund",
          "orange",
          amount,
          "success",
          `air-save-${orderId}-${randomCode(4)}`,
          nowIso(),
        );
        notifyUser(userId, "refund", { number: order.number, amount, method: "orange" }, lang, orderId);
      }
    });
    return { due: 0, groupId: 0 };
  }
  const groupId = insert(
    "INSERT INTO payment_groups (user_id, number, purpose, total_sle, charged_sle, status, raw_json, created_at) VALUES (?,?,?,?,?,?,?,?)",
    userId,
    nextCode("group_seq", "PG"),
    "air_upgrade",
    delta,
    delta,
    "pending",
    JSON.stringify({ lang, orderId, delta, walletSle: 0, methods: ["orange", "afri", "card"] }),
    nowIso(),
  );
  return { due: delta, groupId };
}

export function sweepTimeouts() {
  expireQuotes();
  const settings = getSettings();
  const deposits = many<{ id: number }>(
    "SELECT id FROM orders WHERE status = 'DEPOSIT_HELD' AND balance_due_at IS NOT NULL AND balance_due_at < ?",
    nowIso(),
  );
  for (const order of deposits) {
    try {
      requestRefund({
        orderId: order.id,
        rule: "deposit_timeout",
        reason: "Balance not paid within 72 hours",
        actor: "system",
        staff: { id: 0, name: "System", role: "super_admin", email: "system@ledirect.demo" },
      });
    } catch {
      /* already handled */
    }
  }
  const old = many<{ id: number; group_id: number | null }>(
    "SELECT id, group_id FROM orders WHERE status = 'PENDING_PAYMENT' AND created_at < ?",
    addHours(nowIso(), -settings.unpaid_hold_hours),
  );
  for (const order of old) {
    tx(() => {
      const current = one<{ status: string }>("SELECT status FROM orders WHERE id = ?", order.id);
      if (!current || current.status !== "PENDING_PAYMENT") return;
      restoreStock(order.id);
      run("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", order.id);
      insert("INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?,?,?,?,?)", order.id, "CANCELLED", "Payment window closed", "system", nowIso());
      if (order.group_id) releaseGroupHold(order.group_id);
    });
  }
}

export function warnings() {
  const rows = many<{ id: number; number: string; status: string; since: string | null }>(
    `SELECT o.id, o.number, o.status,
      (SELECT e.created_at FROM order_events e WHERE e.order_id = o.id AND e.status = o.status ORDER BY e.id DESC LIMIT 1) AS since
     FROM orders o WHERE o.status NOT IN ('COMPLETED','CANCELLED','PENDING_PAYMENT','DEPOSIT_HELD')`,
  );
  const out: { id: number; number: string; kind: string; hours: number }[] = [];
  for (const row of rows) {
    const hours = hoursBetween(row.since || nowIso());
    if (row.status === "PROCURING" && hours > 72) out.push({ ...row, kind: "Buying is past 72 hours", hours });
    if (row.status === "IN_CN_WH" && hours > 24 * 5) out.push({ ...row, kind: "In China more than 5 days", hours });
    if (row.status === "SHIPPED" && hours > 24 * 49) out.push({ ...row, kind: "At sea more than 49 days", hours });
    if ((row.status === "IN_SL_WH" || row.status === "READY") && hours > 24 * 7) out.push({ ...row, kind: "Waiting in Freetown more than 7 days", hours });
  }
  return out;
}

export function importSettlement(text: string, actor: StaffActor) {
  assertRole(actor, "fx");
  const rows = parseCsv(text).filter((r) => r[0] && r[0] !== "external_ref");
  const batchId = insert(
    "INSERT INTO recon_batches (filename, imported_by, created_at) VALUES (?,?,?)",
    "upload.csv",
    actor.email,
    nowIso(),
  );
  let matched = 0;
  let exceptions = 0;
  for (const row of rows) {
    const ref = row[0].trim();
    const amount = Math.round(Number(row[1] || "0"));
    const pay = one<{ id: number; amount_sle: number; group_id: number }>(
      "SELECT id, amount_sle, group_id FROM payments WHERE external_ref = ? AND status = 'success' AND purpose != 'refund'",
      ref,
    );
    if (pay && pay.amount_sle === amount) {
      matched += 1;
      const order = one<{ id: number }>("SELECT id FROM orders WHERE group_id = ?", pay.group_id);
      insert("INSERT INTO recon_lines (batch_id, external_ref, amount_sle, status, order_id, note) VALUES (?,?,?,?,?,?)", batchId, ref, amount, "matched", order?.id || null, "");
    } else {
      exceptions += 1;
      insert(
        "INSERT INTO recon_lines (batch_id, external_ref, amount_sle, status, note) VALUES (?,?,?,?,?)",
        batchId,
        ref,
        amount,
        "exception",
        pay ? "Amount differs" : "No payment with this reference",
      );
      insert(
        "INSERT INTO tickets (number, user_id, type, status, subject, sla_due_at, created_at) VALUES (?,?,?,?,?,?,?)",
        nextCode("ticket_seq", "TK"),
        1,
        "recon",
        "open",
        `Settlement difference ${ref}`,
        addHours(nowIso(), 24),
        nowIso(),
      );
    }
  }
  run("UPDATE recon_batches SET matched = ?, exceptions = ? WHERE id = ?", matched, exceptions, batchId);
  return { batchId, matched, exceptions };
}

export function supplementOrder(actor: StaffActor, orderNumber: string, externalRef: string, amount: number) {
  assertRole(actor, "fx");
  const order = one<{ id: number; group_id: number; status: string }>("SELECT * FROM orders WHERE number = ?", orderNumber.trim());
  if (!order) throw new RuleError("Order not found.");
  if (order.status !== "PENDING_PAYMENT" && order.status !== "DEPOSIT_HELD") throw new RuleError("This order is not waiting for money.");
  const group = one<{ charged_sle: number }>("SELECT charged_sle FROM payment_groups WHERE id = ?", order.group_id);
  if (!group || group.charged_sle !== amount) throw new RuleError("Amount does not match what the order is waiting for.");
  return settlePayment({ groupId: order.group_id, externalRef, status: "success", method: "bank", amountSle: amount });
}

export function matchImage(buf: Buffer) {
  let h = 2166136261;
  for (const byte of buf) h = Math.imul(h ^ byte, 16777619);
  const cats = ["phone", "solar", "beauty", "home", "moto", "apparel"];
  const cat = cats[(h >>> 0) % cats.length];
  const rows = many<{ id: number }>(
    "SELECT id FROM products WHERE visual_key = ? AND status = 'live' AND source != 'quote' ORDER BY is_hot DESC, sold_count DESC LIMIT 8",
    cat,
  );
  return { category: cat, ids: rows.map((r) => r.id), engine: "stub-phash" };
}

export function buildReport(fromIso: string, toIso: string) {
  const orders = many<{ id: number; total_sle: number; buffer_sle: number; status: string; zone: string; paid_at: string | null; created_at: string }>(
    "SELECT * FROM orders WHERE price_locked = 1 AND created_at >= ? AND created_at < ?",
    fromIso,
    toIso,
  );
  const refunds = many<{ amount_sle: number }>(
    "SELECT amount_sle FROM refunds WHERE status = 'paid' AND created_at >= ? AND created_at < ?",
    fromIso,
    toIso,
  );
  let margin = 0;
  let checked = 0;
  let onTime = 0;
  for (const order of orders) {
    const items = many<{ qty: number; unit_sle: number; snapshot_json: string }>("SELECT qty, unit_sle, snapshot_json FROM order_items WHERE order_id = ?", order.id);
    for (const item of items) {
      const snap = JSON.parse(item.snapshot_json || "{}") as { costSle?: number };
      if (snap.costSle != null) {
        margin += (item.unit_sle - snap.costSle) * item.qty;
        checked += 1;
      }
    }
    if (order.zone === "preorder" && order.status === "COMPLETED" && order.paid_at) {
      if (hoursBetween(order.paid_at, new Date(order.created_at)) <= 49 * 24 || true) {
        const done = one<{ created_at: string }>("SELECT created_at FROM order_events WHERE order_id = ? AND status = 'COMPLETED' ORDER BY id DESC LIMIT 1", order.id);
        if (done && hoursBetween(order.paid_at, new Date(done.created_at)) <= 49 * 24) onTime += 1;
      }
    }
  }
  const completedSea = orders.filter((o) => o.zone === "preorder" && o.status === "COMPLETED").length;
  return {
    gmv: orders.reduce((s, o) => s + o.total_sle, 0),
    orders: orders.length,
    buffer: orders.reduce((s, o) => s + o.buffer_sle, 0),
    refunds: refunds.reduce((s, r) => s + r.amount_sle, 0),
    refundRate: orders.length ? refunds.length / orders.length : 0,
    margin,
    onTimeRate: completedSea ? onTime / completedSea : 1,
  };
}

export function setSetting(actor: StaffActor, key: string, value: string) {
  assertRole(actor, "settings");
  const before = one<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
  audit(actor.email, "setting", key, before?.value ?? null, value);
}

export function proposeFx(actor: StaffActor, sle: number, cny: number, bufferBps: number) {
  assertRole(actor, "fx");
  const id = insert(
    "INSERT INTO fx_rates (sle_per_usd_e4, usd_cny_e4, buffer_bps, effective_at, entered_by, status) VALUES (?,?,?,?,?,?)",
    Math.round(sle * 10_000),
    Math.round(cny * 10_000),
    bufferBps,
    nowIso(),
    actor.email,
    "pending",
  );
  audit(actor.email, "fx_propose", `fx:${id}`, null, { sle, cny, bufferBps });
  return id;
}

export function activateFx(actor: StaffActor, id: number) {
  assertRole(actor, "fx");
  const row = one<{ entered_by: string; status: string }>("SELECT * FROM fx_rates WHERE id = ?", id);
  if (!row || row.status !== "pending") throw new RuleError("Rate is not waiting.");
  if (row.entered_by === actor.email) throw new RuleError("A different finance person must confirm the rate.");
  run("UPDATE fx_rates SET status = 'archived' WHERE status = 'active'");
  run("UPDATE fx_rates SET status = 'active', reviewed_by = ? WHERE id = ?", actor.email, id);
  audit(actor.email, "fx_activate", `fx:${id}`, row, { status: "active" });
}

export function saveProduct(actor: StaffActor, fields: Record<string, string>, publish: boolean) {
  assertRole(actor, "price");
  const id = Number(fields.id || "0");
  const images = (fields.images || "").split(/\s+/).map((s) => s.trim()).filter(Boolean);
  const row = {
    sku: fields.sku.trim(),
    zone: fields.zone === "instock" ? "instock" : "preorder",
    source: fields.source || "catalog",
    category_id: Number(fields.category_id || "0") || null,
    title_en: fields.title_en || "",
    title_zh: fields.title_zh || fields.title_en || "",
    title_fr: fields.title_fr || fields.title_en || "",
    description_en: fields.description_en || "",
    description_zh: fields.description_zh || fields.description_en || "",
    description_fr: fields.description_fr || fields.description_en || "",
    highlights_en: JSON.stringify((fields.highlights_en || "").split("|").map((s) => s.trim()).filter(Boolean)),
    highlights_zh: "[]",
    highlights_fr: "[]",
    images: JSON.stringify(images),
    weight_g: Number(fields.weight_g || "0"),
    length_cm: Number(fields.length_cm || "0"),
    width_cm: Number(fields.width_cm || "0"),
    height_cm: Number(fields.height_cm || "0"),
    purchase_cny_fen: Math.round(Number(fields.purchase_cny || "0") * 100),
    domestic_usd_cents: Number(fields.domestic_usd_cents || "80"),
    wh_usd_cents: Number(fields.wh_usd_cents || "40"),
    dest_usd_cents: Number(fields.dest_usd_cents || "70"),
    duty_bps: Math.round(Number(fields.duty_pct || "0") * 100),
    hs_code: fields.hs_code || null,
    hs_signed_by: fields.hs_signed_by || null,
    margin_bps: Math.round(Number(fields.margin_pct || "35") * 100),
    marketing_price_sle: fields.marketing_price_sle ? Number(fields.marketing_price_sle) : null,
    local_market_sle: fields.local_market_sle ? Number(fields.local_market_sle) : null,
    local_market_source: fields.local_market_source || null,
    local_market_date: fields.local_market_date || null,
    stock: fields.zone === "instock" ? Number(fields.stock || "0") : null,
    tags: fields.tags || "",
    visual_key: fields.visual_key || "phone",
    supplier_name: fields.supplier_name || null,
    air_ok: 1,
  };
  if (row.marketing_price_sle) {
    quoteSku(
      {
        purchaseCnyFen: row.purchase_cny_fen,
        domesticUsdCents: row.domestic_usd_cents,
        whUsdCents: row.wh_usd_cents,
        destUsdCents: row.dest_usd_cents,
        dutyBps: row.duty_bps,
        marginBps: row.margin_bps,
        weightG: row.weight_g,
        lengthCm: row.length_cm,
        widthCm: row.width_cm,
        heightCm: row.height_cm,
        zone: row.zone as "instock" | "preorder",
        marketingPriceSle: row.marketing_price_sle,
      },
      activeFx(),
      freightOf(),
    );
  }
  const gates = gateCheck({ ...row, images: row.images, duty_bps: row.duty_bps });
  if (publish && !gates.ok) throw new RuleError(gates.missing.join(" "));
  const livePrice = priceOf({ ...row, id: id || 0, status: "draft", sold_count: 0, is_hot: 0, is_estimate: 0, created_at: nowIso() } as ProductRow);
  let hot = fields.hot === "1" ? 1 : 0;
  if (hot && row.local_market_sle && livePrice.priceSle > row.local_market_sle * 0.8) {
    throw new RuleError("Hot slot needs a price at or below 80% of the local market.");
  }
  const status = publish ? "live" : "draft";
  const values = [
    row.sku, row.zone, row.source, row.category_id, row.title_en, row.title_zh, row.title_fr, row.description_en, row.description_zh,
    row.description_fr, row.highlights_en, row.highlights_zh, row.highlights_fr, row.images, row.weight_g, row.length_cm, row.width_cm,
    row.height_cm, row.purchase_cny_fen, row.domestic_usd_cents, row.wh_usd_cents, row.dest_usd_cents, row.duty_bps, row.hs_code,
    row.hs_signed_by, row.margin_bps, row.marketing_price_sle, row.local_market_sle, row.local_market_source, row.local_market_date,
    row.stock, status, gates.ok ? 1 : 0, gates.ok ? 1 : 0, gates.ok ? 1 : 0, gates.ok ? 1 : 0, gates.ok ? 1 : 0, hot, row.tags,
    row.visual_key, row.supplier_name, row.air_ok,
  ];
  if (id) {
    const before = one("SELECT marketing_price_sle, status FROM products WHERE id = ?", id);
    run(
      `UPDATE products SET sku=?, zone=?, source=?, category_id=?, title_en=?, title_zh=?, title_fr=?, description_en=?, description_zh=?,
        description_fr=?, highlights_en=?, highlights_zh=?, highlights_fr=?, images=?, weight_g=?, length_cm=?, width_cm=?, height_cm=?,
        purchase_cny_fen=?, domestic_usd_cents=?, wh_usd_cents=?, dest_usd_cents=?, duty_bps=?, hs_code=?, hs_signed_by=?, margin_bps=?,
        marketing_price_sle=?, local_market_sle=?, local_market_source=?, local_market_date=?, stock=?, status=?, gate_measure=?,
        gate_english=?, gate_local=?, gate_hs=?, gate_compliance=?, is_hot=?, tags=?, visual_key=?, supplier_name=?, air_ok=? WHERE id=?`,
      ...values,
      id,
    );
    audit(actor.email, "price", row.sku, before, { marketing: row.marketing_price_sle, status });
    return id;
  }
  const newId = insert(
    `INSERT INTO products (sku, zone, source, category_id, title_en, title_zh, title_fr, description_en, description_zh, description_fr,
      highlights_en, highlights_zh, highlights_fr, images, weight_g, length_cm, width_cm, height_cm, purchase_cny_fen, domestic_usd_cents,
      wh_usd_cents, dest_usd_cents, duty_bps, hs_code, hs_signed_by, margin_bps, marketing_price_sle, local_market_sle, local_market_source,
      local_market_date, stock, status, gate_measure, gate_english, gate_local, gate_hs, gate_compliance, is_hot, tags, visual_key,
      supplier_name, air_ok, sold_count, is_estimate, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ...values,
    0,
    0,
    nowIso(),
  );
  audit(actor.email, "product_create", row.sku, null, { status });
  return newId;
}

export function importProducts(actor: StaffActor, text: string) {
  assertRole(actor, "price");
  const rows = parseCsv(text);
  const header = rows.shift() || [];
  const idx = (name: string) => header.indexOf(name);
  if (rows.length > 200) throw new RuleError("Import at most 200 rows.");
  let n = 0;
  for (const row of rows) {
    const get = (name: string) => row[idx(name)] || "";
    saveProduct(
      actor,
      {
        sku: get("sku"),
        zone: get("zone") || "preorder",
        category_id: get("category_id"),
        title_en: get("title_en"),
        title_zh: get("title_zh"),
        title_fr: get("title_fr"),
        description_en: get("description_en") || get("title_en"),
        weight_g: get("weight_g"),
        length_cm: get("length_cm"),
        width_cm: get("width_cm"),
        height_cm: get("height_cm"),
        purchase_cny: get("purchase_cny"),
        duty_pct: get("duty_pct"),
        hs_code: get("hs_code"),
        hs_signed_by: get("hs_signed_by") || actor.name,
        margin_pct: get("margin_pct") || "35",
        local_market_sle: get("local_market_sle"),
        local_market_source: get("local_market_source"),
        local_market_date: get("local_market_date"),
        stock: get("stock"),
        tags: get("tags"),
        visual_key: get("visual_key"),
        images: get("images"),
        source: "catalog",
      },
      false,
    );
    n += 1;
  }
  return n;
}

export const CSV_TEMPLATE =
  "sku,zone,category_id,title_en,title_zh,title_fr,description_en,weight_g,length_cm,width_cm,height_cm,purchase_cny,duty_pct,hs_code,hs_signed_by,margin_pct,local_market_sle,local_market_source,local_market_date,stock,tags,visual_key,images\n";

export function submitSeller(input: { shop: string; owner: string; phone: string; email: string; category: string; city: string; note: string; doc?: string }) {
  const clip = (value: string, max: number) => value.trim().slice(0, max);
  const shop = clip(input.shop, 80);
  const owner = clip(input.owner, 80);
  const phone = clip(input.phone, 24);
  if (!shop || !owner || !phone) throw new RuleError("Add the shop, owner, and phone.");
  return insert(
    "INSERT INTO seller_apps (shop_name, owner_name, phone, email, category, city, doc_note, doc_url, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    shop,
    owner,
    phone,
    clip(input.email || "", 80),
    clip(input.category, 80),
    clip(input.city || "", 40),
    clip(input.note || "", 500),
    input.doc || null,
    "submitted",
    nowIso(),
  );
}

export function reviewSeller(actor: StaffActor, id: number, approve: boolean, commissionPct: number, reason = "") {
  assertRole(actor, "content");
  const app = one<{ id: number; phone: string; shop_name: string; status: string }>("SELECT id, phone, shop_name, status FROM seller_apps WHERE id = ?", id);
  if (!app || app.status !== "submitted") throw new RuleError("This application is not waiting.");
  const note = reason.trim().slice(0, 300);
  if (!approve && !note) throw new RuleError("Add a reason.");
  const user = one<{ id: number }>("SELECT id FROM users WHERE phone = ?", app.phone);
  if (!approve) {
    run("UPDATE seller_apps SET status = 'rejected', reject_reason = ?, reviewed_at = ? WHERE id = ?", note, nowIso(), id);
    if (user) notifyUser(user.id, "seller_no", { shop: app.shop_name, reason: note }, "en");
    audit(actor.email, "seller_reject", `seller:${id}`, { status: "submitted" }, { status: "rejected", reason: note });
    return;
  }
  const pct = Math.round(commissionPct * 100);
  if (pct < 100 || pct > 3000) throw new RuleError("Commission must be between 1% and 30%.");
  const code = `SEL-${String(id).padStart(4, "0")}`;
  run(
    "UPDATE seller_apps SET status = 'approved', commission_bps = ?, seller_code = ?, reviewed_at = ? WHERE id = ?",
    pct,
    code,
    nowIso(),
    id,
  );
  if (user) notifyUser(user.id, "seller_ok", { shop: app.shop_name, code }, "en");
  audit(actor.email, "seller_approve", `seller:${id}`, { status: "submitted" }, { status: "approved", code, commission_bps: pct });
}

export function createCoupon(
  actor: StaffActor,
  input: { code: string; kind: string; value: number; minSle: number; capSle: number; zone: string; maxUses: number; perUser: number; days: number; title: string },
) {
  assertRole(actor, "content");
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) throw new RuleError("Use 4 to 16 letters or numbers.");
  if (one("SELECT id FROM coupons WHERE code = ?", code)) throw new RuleError("That code already exists.");
  const kind = input.kind === "percent" ? "percent" : "amount";
  const value = Math.round(input.value);
  if (kind === "percent" && (value < 1 || value > 80)) throw new RuleError("Percent must be from 1 to 80.");
  if (kind === "amount" && (value < 1 || value > 50_000)) throw new RuleError("Amount must be from Le 1 to Le 50,000.");
  const zone = ["any", "instock", "preorder", "diaspora"].includes(input.zone) ? input.zone : "any";
  const days = Math.min(365, Math.max(1, Math.round(input.days || 90)));
  const id = insert(
    `INSERT INTO coupons (code, title_en, title_zh, title_fr, kind, value, cap_sle, min_sle, zone, max_uses, per_user, active, starts_at, ends_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
    code,
    input.title.trim().slice(0, 80) || code,
    input.title.trim().slice(0, 80) || code,
    input.title.trim().slice(0, 80) || code,
    kind,
    kind === "percent" ? value * 100 : value,
    Math.max(0, Math.round(input.capSle || 0)),
    Math.max(0, Math.round(input.minSle || 0)),
    zone,
    Math.max(0, Math.round(input.maxUses || 0)),
    Math.max(1, Math.round(input.perUser || 1)),
    nowIso(),
    addHours(nowIso(), days * 24),
    nowIso(),
  );
  audit(actor.email, "coupon", `coupon:${id}`, null, { code, kind, value });
  return id;
}

export function openTicket(userId: number, orderId: number, type: string, body: string, image?: string) {
  const order = one<{ user_id: number }>("SELECT user_id FROM orders WHERE id = ?", orderId);
  if (!order || order.user_id !== userId) throw new RuleError("Order not found.");
  const id = insert(
    "INSERT INTO tickets (number, user_id, order_id, type, status, subject, sla_due_at, created_at) VALUES (?,?,?,?,?,?,?,?)",
    nextCode("ticket_seq", "TK"),
    userId,
    orderId,
    type,
    "open",
    body.slice(0, 80),
    addHours(nowIso(), 2),
    nowIso(),
  );
  const user = one<{ name: string }>("SELECT name FROM users WHERE id = ?", userId);
  insert(
    "INSERT INTO ticket_messages (ticket_id, author_kind, author_name, body, images, created_at) VALUES (?,?,?,?,?,?)",
    id,
    "user",
    user?.name || "Customer",
    body,
    image || null,
    nowIso(),
  );
  run("UPDATE orders SET exception = 'ISSUE' WHERE id = ?", orderId);
  return id;
}

export function replyTicket(actor: StaffActor, ticketId: number, body: string, internal: boolean) {
  assertRole(actor, "tickets");
  const ticket = one<{ first_response_at: string | null }>("SELECT first_response_at FROM tickets WHERE id = ?", ticketId);
  if (!ticket) throw new RuleError("Case not found.");
  insert(
    "INSERT INTO ticket_messages (ticket_id, author_kind, author_name, body, created_at) VALUES (?,?,?,?,?)",
    ticketId,
    internal ? "internal" : "staff",
    actor.name,
    body,
    nowIso(),
  );
  if (!internal && !ticket.first_response_at) {
    run("UPDATE tickets SET first_response_at = ?, status = 'pending_user' WHERE id = ?", nowIso(), ticketId);
  }
}

export function addReview(userId: number, orderId: number, productId: number, rating: number, body: string) {
  const order = one<{ user_id: number; status: string }>("SELECT user_id, status FROM orders WHERE id = ?", orderId);
  if (!order || order.user_id !== userId || order.status !== "COMPLETED") throw new RuleError("You can review after delivery.");
  const user = one<{ name: string }>("SELECT name FROM users WHERE id = ?", userId);
  insert(
    "INSERT INTO reviews (product_id, user_name, rating, body, created_at) VALUES (?,?,?,?,?)",
    productId,
    user?.name || "Customer",
    Math.min(5, Math.max(1, rating)),
    body,
    nowIso(),
  );
}

export function resendNotice(actor: StaffActor, orderId: number) {
  assertRole(actor, "tickets");
  const order = one<{ id: number; user_id: number; number: string; status: string; pickup_code: string | null }>("SELECT * FROM orders WHERE id = ?", orderId);
  if (!order) throw new RuleError("Order not found.");
  const key = ({ PAID: "paid", DEPOSIT_HELD: "paid", PROCURED: "procured", IN_CN_WH: "in_cn_wh", SHIPPED: "shipped", ARRIVED: "arrived", READY: "ready" } as Record<string, string>)[order.status] || "paid";
  notifyUser(order.user_id, key, { number: order.number, code: order.pickup_code || "", total: "" }, "en", order.id);
}

export function savePost(actor: StaffActor, fields: Record<string, string>) {
  assertRole(actor, "content");
  const id = Number(fields.id || "0");
  const values = [fields.kind || "help", fields.slug || null, fields.title_en, fields.title_zh, fields.title_fr, fields.body_en, fields.body_zh, fields.body_fr, fields.image || null, fields.video || null, fields.published === "0" ? 0 : 1];
  if (id) {
    run("UPDATE posts SET kind=?, slug=?, title_en=?, title_zh=?, title_fr=?, body_en=?, body_zh=?, body_fr=?, image=?, video=?, published=? WHERE id=?", ...values, id);
    return id;
  }
  return insert(
    "INSERT INTO posts (kind, slug, title_en, title_zh, title_fr, body_en, body_zh, body_fr, image, video, published, sort) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    ...values,
    0,
  );
}

export function saveStaff(actor: StaffActor, id: number, role: string, active: boolean) {
  assertRole(actor, "people");
  const before = one("SELECT role, active FROM staff WHERE id = ?", id);
  run("UPDATE staff SET role = ?, active = ? WHERE id = ?", role, active ? 1 : 0, id);
  audit(actor.email, "role", `staff:${id}`, before, { role, active });
}

export function dashboard() {
  const box = containerProgress();
  return {
    quotes: one<{ c: number }>("SELECT COUNT(*) AS c FROM quotes WHERE status = 'pending'")?.c || 0,
    toBuy: one<{ c: number }>("SELECT COUNT(*) AS c FROM orders WHERE status = 'PAID'")?.c || 0,
    warnings: warnings().length,
    recon: one<{ c: number }>("SELECT COUNT(*) AS c FROM tickets WHERE type = 'recon' AND status = 'open'")?.c || 0,
    box,
  };
}
