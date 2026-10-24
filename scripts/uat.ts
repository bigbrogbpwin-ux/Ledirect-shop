import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import assert from "node:assert/strict";

process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "ledirect-")), "uat.sqlite");

async function main() {
const { getDb, one, run } = await import("../lib/db");
const commerce = await import("../lib/commerce");
const { quoteSku, divRound } = await import("../lib/pricing");
const { SEED_FX } = await import("../lib/defaults");

getDb();

const cable = quoteSku(
  {
    purchaseCnyFen: 1200,
    domesticUsdCents: 80,
    whUsdCents: 40,
    destUsdCents: 70,
    dutyBps: 1000,
    marginBps: 3500,
    weightG: 80,
    lengthCm: 20,
    widthCm: 10,
    heightCm: 3,
    zone: "instock",
  },
  SEED_FX,
  { seaUsdCentsPerCbm: 16000, airUsdCentsPerKg: 850, gstDeductible: false, gstBps: 1500, minPreorderCm3: 50000 },
);
assert.equal(cable.priceSle, 145, "cable price");

const user = one<{ id: number }>("SELECT id FROM users WHERE phone = '+23276111001'");
assert.ok(user);
const kettle = one<{ id: number; stock: number }>("SELECT id, stock FROM products WHERE sku = 'HOME-KETTLE'");
assert.equal(kettle?.stock, 1);

let failed = false;
try {
  commerce.checkout({
    userId: user.id,
    lines: [{ productId: kettle!.id, variantId: null, qty: 1 }],
    shipMethod: "pickup",
    pickupPointId: 1,
    freightMode: "sea",
    useWallet: false,
    source: "catalog",
    lang: "en",
  });
  commerce.checkout({
    userId: user.id,
    lines: [{ productId: kettle!.id, variantId: null, qty: 1 }],
    shipMethod: "pickup",
    pickupPointId: 1,
    freightMode: "sea",
    useWallet: false,
    source: "catalog",
    lang: "en",
  });
} catch {
  failed = true;
}
assert.equal(failed, true, "second kettle must fail");
assert.equal(one<{ stock: number }>("SELECT stock FROM products WHERE sku = 'HOME-KETTLE'")?.stock, 0);

const cableProduct = one<{ id: number }>("SELECT id FROM products WHERE sku = 'PHONE-CABLE'")!;
const paid = commerce.checkout({
  userId: user.id,
  lines: [{ productId: cableProduct.id, variantId: null, qty: 1 }],
  shipMethod: "pickup",
  pickupPointId: 1,
  freightMode: "sea",
  useWallet: false,
  source: "catalog",
  lang: "zh",
});
const group = one<{ charged_sle: number }>("SELECT charged_sle FROM payment_groups WHERE id = ?", paid.groupId)!;
const first = commerce.settlePayment({ groupId: paid.groupId, externalRef: "UAT-1", status: "success", method: "orange", amountSle: group.charged_sle });
const second = commerce.settlePayment({ groupId: paid.groupId, externalRef: "UAT-1", status: "success", method: "orange", amountSle: group.charged_sle });
assert.equal(second.duplicate, true);
assert.equal("paid" in first && first.paid, true);
const locked = one<{ total_sle: number; fx_sle_per_usd_e4: number }>("SELECT total_sle, fx_sle_per_usd_e4 FROM orders WHERE id = ?", paid.orderIds[0])!;
commerce.activateFx({ id: 0, name: "Amadu", role: "finance", email: "amadu@ledirect.demo" }, commerce.proposeFx({ id: 0, name: "Joseph", role: "finance", email: "joseph@ledirect.demo" }, 30, 7.2, 300));
const still = one<{ total_sle: number }>("SELECT total_sle FROM orders WHERE id = ?", paid.orderIds[0])!;
assert.equal(still.total_sle, locked.total_sle, "paid price stays locked");

const order = one<{ id: number; status: string }>("SELECT id, status FROM orders WHERE status = 'PAID' LIMIT 1");
assert.ok(order);
assert.throws(() => commerce.advanceOrder({ id: 1, name: "Wei", role: "procurement", email: "wei@ledirect.demo" }, order!.id, "SHIPPED", { bl: "X" }), /Cannot move/);

assert.throws(
  () => commerce.requestRefund({ orderId: order!.id, rule: "platform_fault", reason: "no", actor: "fanta@ledirect.demo", staff: { id: 1, name: "Fanta", role: "cs", email: "fanta@ledirect.demo" } }),
  /cannot do this/,
);

assert.throws(() => commerce.submitQuote(user.id, "https://example.com/item", 1, ""), /1688/);

const box = commerce.containerProgress();
const sum = one<{ v: number }>("SELECT COALESCE(SUM(cm3),0) AS v FROM container_lines WHERE container_id = ?", box.id)!;
assert.equal(Math.round((sum.v / box.target) * 1000) / 10, box.pct);

const bought = one<{ id: number; status: string }>("SELECT id, status FROM orders WHERE status = 'PROCURING' LIMIT 1");
if (!bought) {
  const procuring = one<{ id: number }>("SELECT id FROM orders WHERE status = 'PAID' LIMIT 1");
  if (procuring) commerce.advanceOrder({ id: 1, name: "Wei", role: "procurement", email: "wei@ledirect.demo" }, procuring.id, "PROCURING", { note: "start" });
}
const mid = one<{ id: number }>("SELECT id FROM orders WHERE status IN ('PROCURING','PROCURED','IN_CN_WH') LIMIT 1");
if (mid) {
  const before = one<{ total_sle: number }>("SELECT total_sle FROM orders WHERE id = ?", mid.id)!.total_sle;
  commerce.requestRefund({ orderId: mid.id, rule: "cancel_before_load", reason: "stop", actor: "joseph@ledirect.demo", staff: { id: 1, name: "Joseph", role: "finance", email: "joseph@ledirect.demo" } });
  const refund = one<{ amount_sle: number }>("SELECT amount_sle FROM refunds WHERE order_id = ? ORDER BY id DESC LIMIT 1", mid.id)!;
  assert.equal(refund.amount_sle, divRound(BigInt(before) * 90n, 100n));
  const owner = one<{ user_id: number }>("SELECT user_id FROM orders WHERE id = ?", mid.id)!;
  const credited = one<{ balance_sle: number }>("SELECT balance_sle FROM wallets WHERE user_id = ?", owner.user_id)!;
  assert.equal(credited.balance_sle, refund.amount_sle, "demo refunds land in the wallet");
}

const bo = one<{ id: number; fee_sle: number }>("SELECT id, fee_sle FROM pickup_points WHERE city = 'Bo'")!;
assert.throws(
  () => commerce.checkout({
    userId: user.id,
    lines: [{ productId: cableProduct.id, variantId: null, qty: 1 }],
    shipMethod: "pickup",
    pickupPointId: bo.id,
    freightMode: "sea",
    useWallet: false,
    source: "catalog",
    lang: "en",
  }),
  /Freetown/,
);
const inland = commerce.checkout({
  userId: user.id,
  lines: [{ productId: cableProduct.id, variantId: null, qty: 1 }],
  shipMethod: "upcountry",
  pickupPointId: bo.id,
  freightMode: "sea",
  useWallet: false,
  source: "catalog",
  lang: "en",
});
const inlandOrder = one<{ delivery_sle: number; total_sle: number }>("SELECT delivery_sle, total_sle FROM orders WHERE id = ?", inland.orderIds[0])!;
assert.equal(inlandOrder.delivery_sle, bo.fee_sle, "partner desk fee");

commerce.createCoupon(
  { id: 2, name: "Ibrahim", role: "ops", email: "ibrahim@ledirect.demo" },
  { code: "UAT20", kind: "amount", value: 20, minSle: 0, capSle: 0, zone: "any", maxUses: 5, perUser: 1, days: 30, title: "UAT" },
);
const fan = one<{ id: number }>("SELECT id FROM products WHERE sku = 'HOME-FAN'")!;
const saved = commerce.checkout({
  userId: user.id,
  lines: [{ productId: fan.id, variantId: null, qty: 1 }],
  shipMethod: "pickup",
  pickupPointId: 1,
  freightMode: "sea",
  useWallet: false,
  source: "catalog",
  lang: "en",
  couponCode: "UAT20",
});
const savedOrder = one<{ total_sle: number; discount_sle: number; coupon_code: string }>("SELECT total_sle, discount_sle, coupon_code FROM orders WHERE id = ?", saved.orderIds[0])!;
assert.equal(savedOrder.coupon_code, "UAT20");
assert.equal(savedOrder.discount_sle, 20);
const full = one<{ goods_sle: number; intl_sle: number; delivery_sle: number }>("SELECT goods_sle, intl_sle, delivery_sle FROM orders WHERE id = ?", saved.orderIds[0])!;
assert.equal(savedOrder.total_sle, full.goods_sle + full.intl_sle + full.delivery_sle - 20);

const { invoicePdf } = await import("../lib/invoice");
const pdf = invoicePdf(paid.orderIds[0], user.id);
assert.ok(pdf);
assert.equal(pdf!.bytes.subarray(0, 5).toString(), "%PDF-");

const shopId = commerce.submitSeller({ shop: "UAT Shop", owner: "Ada", phone: "+23276000099", email: "", category: "phone", city: "Bo", note: "" });
commerce.reviewSeller({ id: 2, name: "Ibrahim", role: "ops", email: "ibrahim@ledirect.demo" }, shopId, true, 8);
const seller = one<{ seller_code: string; commission_bps: number }>("SELECT seller_code, commission_bps FROM seller_apps WHERE id = ?", shopId)!;
assert.equal(seller.commission_bps, 800);
assert.ok(seller.seller_code.startsWith("SEL-"));

const { staffCan } = await import("../lib/auth");
assert.equal(staffCan("cs", "money"), false);
assert.equal(staffCan("warehouse", "tickets"), false);
assert.equal(staffCan("finance", "money"), true);
assert.throws(
  () => commerce.saveProduct({ id: 3, name: "Wei", role: "procurement", email: "wei@ledirect.demo" }, { sku: "X", title_en: "X" }, false),
  /cannot do this/,
);

const seaProduct = one<{ id: number } & Record<string, never>>("SELECT * FROM products WHERE zone = 'preorder' AND status = 'live' AND source = 'catalog' LIMIT 1")!;
const quoted = commerce.priceOf(seaProduct as never, false);
const shown = (await import("../lib/pricing")).presentSplit("preorder", quoted, 0);
const line = {
  itemId: 0,
  product: seaProduct as never,
  variant: null,
  qty: 2,
  unit: shown.shelf,
  goods: shown.goods,
  intl: shown.intl,
  airDelta: quoted.airDeltaSle,
  quote: quoted,
};
const bySea = commerce.priceCart([line], "pickup", false);
const byAir = commerce.priceCart([line], "pickup", true);
assert.equal(byAir.grand - bySea.grand, quoted.airDeltaSle * 2, "air difference");

const bulky = commerce.checkout({
  userId: user.id,
  lines: [{ productId: seaProduct.id, variantId: null, qty: 40 }],
  shipMethod: "pickup",
  pickupPointId: 1,
  freightMode: "sea",
  useWallet: false,
  source: "catalog",
  lang: "en",
});
assert.equal(bulky.split, true, "large order splits");
const depositGroup = one<{ charged_sle: number }>("SELECT charged_sle FROM payment_groups WHERE id = ?", bulky.groupId)!;
commerce.settlePayment({ groupId: bulky.groupId, externalRef: "UAT-SPLIT", status: "success", method: "orange", amountSle: depositGroup.charged_sle });
run("UPDATE orders SET balance_due_at = ? WHERE id = ?", new Date(Date.now() - 3600_000).toISOString(), bulky.orderIds[0]);
commerce.sweepTimeouts();
const pendingRefund = one<{ id: number; status: string }>("SELECT id, status FROM refunds WHERE order_id = ? ORDER BY id DESC LIMIT 1", bulky.orderIds[0]);
assert.ok(pendingRefund, "late balance opens a refund");
if (pendingRefund!.status === "needs_second") {
  commerce.approveRefund({ id: 7, name: "Amadu", role: "finance", email: "amadu@ledirect.demo" }, pendingRefund!.id);
}
const timedOut = one<{ status: string }>("SELECT status FROM orders WHERE id = ?", bulky.orderIds[0])!;
assert.equal(timedOut.status, "CANCELLED", "unpaid balance cancels");

const walletBefore = one<{ balance_sle: number }>("SELECT balance_sle FROM wallets WHERE user_id = ?", user.id)!.balance_sle;
const topup = commerce.startTopup(user.id, 100, "en");
const topGroup = one<{ charged_sle: number }>("SELECT charged_sle FROM payment_groups WHERE id = ?", topup)!;
commerce.settlePayment({ groupId: topup, externalRef: "UAT-TOP", status: "success", method: "orange", amountSle: topGroup.charged_sle });
assert.equal(one<{ balance_sle: number }>("SELECT balance_sle FROM wallets WHERE user_id = ?", user.id)!.balance_sle, walletBefore + 100);

const family = commerce.checkout({
  userId: user.id,
  lines: [{ productId: cableProduct.id, variantId: null, qty: 1 }],
  shipMethod: "pickup",
  pickupPointId: 1,
  freightMode: "sea",
  useWallet: false,
  source: "diaspora",
  lang: "en",
  recipient: { name: "Aminata", phone: "+23276111001", city: "Freetown", line: "14 Wilkinson Road" },
});
assert.equal(one<{ source: string }>("SELECT source FROM orders WHERE id = ?", family.orderIds[0])!.source, "diaspora");

const seen = commerce.matchImage(Buffer.from("sample-photo"));
assert.ok(seen.ids.length > 0, "image index returns products");

const { notifyUser } = await import("../lib/notify");
const ada = { id: 1, name: "Ada", role: "super_admin", email: "ada@ledirect.demo" };
commerce.setSetting(ada, "whatsapp_down", "1");
notifyUser(user.id, "ready", { number: "LD-TEST", code: "123456", place: "Kissy" }, "en");
const sms = one<{ status: string }>("SELECT status FROM messages WHERE user_id = ? AND channel = 'sms' AND template_key = 'ready' ORDER BY id DESC LIMIT 1", user.id);
assert.equal(sms?.status, "sent", "sms covers a failed WhatsApp");
commerce.setSetting(ada, "whatsapp_down", "0");

commerce.importSettlement("external_ref,amount_sle\nMISSING-REF,10\n", { id: 6, name: "Joseph", role: "finance", email: "joseph@ledirect.demo" });
const recon = one<{ c: number }>("SELECT COUNT(*) AS c FROM tickets WHERE type = 'recon' AND subject LIKE '%MISSING-REF%'")!;
assert.ok(recon.c >= 1, "settlement difference opens a case");

const fxLogs = one<{ c: number }>("SELECT COUNT(*) AS c FROM audit_logs WHERE action IN ('fx_propose','fx_activate','setting')")!;
assert.ok(fxLogs.c >= 1, "audit log records rate and settings");

const { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } = await import("fs");
const { tmpdir } = await import("os");
const { backupTree, restoreTree } = await import("../lib/backup");
const scratch = mkdtempSync(path.join(tmpdir(), "ledirect-bak-"));
const dbFile = path.join(scratch, "shop.sqlite");
const uploadDir = path.join(scratch, "uploads");
mkdirSync(uploadDir);
writeFileSync(path.join(uploadDir, "note.txt"), "keep");
const probe = new (await import("node:sqlite")).DatabaseSync(dbFile);
probe.exec("CREATE TABLE mark (v TEXT)");
probe.exec("INSERT INTO mark VALUES ('one')");
probe.close();
const savedBackup = backupTree({ dbFile, uploadDir, destRoot: path.join(scratch, "backups") });
rmSync(path.join(uploadDir, "note.txt"));
const probe2 = new (await import("node:sqlite")).DatabaseSync(dbFile);
probe2.exec("UPDATE mark SET v = 'two'");
probe2.close();
restoreTree({ backupDir: savedBackup, dbFile, uploadDir });
const probe3 = new (await import("node:sqlite")).DatabaseSync(dbFile);
const mark = probe3.prepare("SELECT v FROM mark").get() as { v: string };
probe3.close();
assert.equal(mark.v, "one", "backup restore");
assert.equal(readFileSync(path.join(uploadDir, "note.txt"), "utf8"), "keep");

console.log("uat ok");
}

main();
