"use server";

import { redirect } from "next/navigation";
import { currentStaff, currentUser, ensureCartToken, getLang, logoutCustomer, logoutStaff, readCartToken, requestOtp, setLang, staffPassword, staffSecond, verifyOtp } from "@/lib/auth";
import {
  acceptQuote,
  addReview,
  addToCart,
  advanceOrder,
  approveRefund,
  activateFx,
  buildReport,
  checkout,
  confirmBalance,
  dashboard,
  importProducts,
  importSettlement,
  issueQuote,
  openTicket,
  proposeFx,
  redeemPickup,
  rejectQuote,
  replyTicket,
  requestRefund,
  resendNotice,
  reviewSeller,
  RuleError,
  runCutoff,
  savePost,
  saveProduct,
  saveStaff,
  setQty,
  setSetting,
  settlePayment,
  shipLcl,
  startTopup,
  submitQuote,
  submitSeller,
  switchToAir,
  type StaffActor,
} from "@/lib/commerce";
import { one, resetDatabase, run } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { saveBuffer, saveUpload } from "@/lib/uploads";
import { matchImage } from "@/lib/commerce";
import type { Lang } from "@/lib/i18n";
import type { RefundRule } from "@/lib/states";
import { safePath, clampQty } from "@/lib/safe";

function bubble(error: unknown) {
  if (typeof error === "object" && error && "digest" in error && String((error as { digest: string }).digest).startsWith("NEXT_")) throw error;
}

function fail(error: unknown, path: string): never {
  bubble(error);
  let message = "That did not work.";
  if (error instanceof Error && error.message.length <= 180 && !/sqlite|sql|enoent|econn/i.test(error.message)) message = error.message;
  const safe = safePath(path);
  const join = safe.includes("?") ? "&" : "?";
  redirect(`${safe}${join}error=${encodeURIComponent(message)}`);
}

async function staff(): Promise<StaffActor> {
  const row = await currentStaff();
  if (!row) redirect("/admin/login");
  return row;
}

export async function setLangAction(formData: FormData) {
  const lang = String(formData.get("lang") || "en");
  const next = safePath(String(formData.get("next") || "/"));
  if (lang === "en" || lang === "zh" || lang === "fr") await setLang(lang);
  redirect(next);
}

export async function sendCodeAction(formData: FormData) {
  try {
    await requestOtp(String(formData.get("phone") || ""));
  } catch (error) {
    fail(error, "/login");
  }
  redirect("/login");
}

export async function verifyAction(formData: FormData) {
  const next = safePath(String(formData.get("next") || "/account"), "/account");
  try {
    await verifyOtp(String(formData.get("phone") || ""), String(formData.get("code") || ""), String(formData.get("name") || ""));
  } catch (error) {
    fail(error, `/login?next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function logoutAction() {
  await logoutCustomer();
  redirect("/");
}

export async function staffPassAction(formData: FormData) {
  try {
    await staffPassword(String(formData.get("email") || ""), String(formData.get("password") || ""));
  } catch (error) {
    fail(error, "/admin/login");
  }
  redirect("/admin/login");
}

export async function staffCodeAction(formData: FormData) {
  try {
    await staffSecond(String(formData.get("code") || ""));
  } catch (error) {
    fail(error, "/admin/login");
  }
  redirect("/admin");
}

export async function staffOutAction() {
  await logoutStaff();
  redirect("/admin/login");
}

export async function addCartAction(formData: FormData) {
  const back = safePath(String(formData.get("back") || "/cart"), "/cart");
  try {
    const token = await ensureCartToken();
    const user = await currentUser();
    await addToCart(token, user?.id || null, Number(formData.get("product")), Number(formData.get("variant") || "0") || null, clampQty(Number(formData.get("qty") || "1")));
  } catch (error) {
    fail(error, back);
  }
  redirect("/cart");
}

export async function qtyAction(formData: FormData) {
  const token = await readCartToken();
  if (token) setQty(token, Number(formData.get("item")), clampQty(Number(formData.get("qty") || "0"), true));
  redirect("/cart");
}

export async function checkoutAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/checkout");
  try {
    const token = await readCartToken();
    const { cartLines } = await import("@/lib/commerce");
    const lines = cartLines(token).map((line) => ({ productId: line.product.id, variantId: line.variant?.id || null, qty: line.qty }));
    const shipRaw = String(formData.get("ship") || "pickup");
    const ship = shipRaw === "freetown" || shipRaw === "upcountry" ? shipRaw : "pickup";
    const sourceRaw = String(formData.get("source") || "catalog");
    const source = ["catalog", "1688", "diaspora", "link"].includes(sourceRaw) ? sourceRaw : "catalog";
    const address = ship === "pickup" ? null : {
      name: String(formData.get("name") || user.name).slice(0, 80),
      phone: String(formData.get("phone") || user.phone).slice(0, 24),
      area: String(formData.get("area") || "freetown").slice(0, 40),
      line: String(formData.get("line") || "").slice(0, 200),
    };
    const recipient = formData.get("source") === "diaspora" ? {
      name: String(formData.get("rname") || ""),
      phone: String(formData.get("rphone") || ""),
      city: String(formData.get("rcity") || "Freetown"),
      line: String(formData.get("rline") || ""),
    } : null;
    const result = checkout({
      userId: user.id,
      lines,
      shipMethod: ship,
      pickupPointId: ship === "freetown" ? null : Number(formData.get("pickup") || "0"),
      address,
      recipient,
      freightMode: formData.get("air") === "1" ? "air" : "sea",
      useWallet: formData.get("wallet") === "1",
      source,
      lang: await getLang(),
      clearToken: token,
      couponCode: String(formData.get("coupon") || ""),
    });
    if (result.paid) redirect(`/pay/result/${result.groupId}`);
    redirect(`/pay/${result.groupId}`);
  } catch (error) {
    fail(error, "/checkout");
  }
}

export async function payAction(formData: FormData) {
  const groupId = Number(formData.get("group"));
  const method = String(formData.get("method") || "orange").slice(0, 32);
  const failIt = formData.get("fail") === "1";
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safePath(`/pay/${groupId}`))}`);
  try {
    const group = one<{ charged_sle: number; user_id: number }>("SELECT charged_sle, user_id FROM payment_groups WHERE id = ?", groupId);
    if (!group || group.user_id !== user.id) throw new RuleError("Payment not found.");
    if (!getSettings().demo_mode) throw new RuleError("Live checkout is not connected yet.");
    const ref = `${failIt ? "fail" : "demo"}-${groupId}-${Date.now()}`;
    settlePayment({ groupId, externalRef: ref, status: failIt ? "failed" : "success", method, amountSle: group.charged_sle });
  } catch (error) {
    fail(error, `/pay/${groupId}`);
  }
  redirect(`/pay/result/${groupId}`);
}

export async function quoteAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/link");
  try {
    const id = submitQuote(user.id, String(formData.get("url") || ""), clampQty(Number(formData.get("qty") || "1")), String(formData.get("note") || "").slice(0, 500));
    redirect(`/link/${id}`);
  } catch (error) {
    fail(error, "/link");
  }
}

export async function demoQuoteAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const user = await currentUser();
  if (!user) redirect(`/login?next=/link/${id}`);
  try {
    issueQuote(null, id, { title: "Linked item from your URL", cny: 36, weightG: 400, l: 25, w: 18, h: 8, dutyPct: 10, hs: "8544.42", marginPct: 35 }, user.id);
  } catch (error) {
    fail(error, `/link/${id}`);
  }
  redirect(`/link/${id}`);
}

export async function quoteDecisionAction(formData: FormData) {
  const user = await currentUser();
  const id = Number(formData.get("id"));
  if (!user) redirect(`/login?next=/link/${id}`);
  if (formData.get("decision") === "reject") {
    rejectQuote(user.id, id);
    redirect(`/link/${id}`);
  }
  try {
    const result = acceptQuote(
      user.id,
      id,
      await getLang(),
      "pickup",
      Number(formData.get("pickup") || user.pickup_point_id || 1),
      null,
    );
    redirect(result.paid ? `/pay/result/${result.groupId}` : `/pay/${result.groupId}`);
  } catch (error) {
    fail(error, `/link/${id}`);
  }
}

export async function topupAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/wallet");
  try {
    const id = startTopup(user.id, Number(formData.get("amount") || "0"), await getLang());
    redirect(`/pay/${id}`);
  } catch (error) {
    fail(error, "/wallet");
  }
}

export async function ticketAction(formData: FormData) {
  const user = await currentUser();
  const orderId = Number(formData.get("order"));
  if (!user) redirect(`/login?next=/orders/${orderId}`);
  let image: string | undefined;
  const file = formData.get("photo");
  if (file instanceof File && file.size) image = await saveUpload(file, "case", { visibility: "owner", userId: user.id });
  try {
    const id = openTicket(user.id, orderId, String(formData.get("type") || "quality"), String(formData.get("body") || ""), image);
    redirect(`/account?ticket=${id}`);
  } catch (error) {
    fail(error, `/orders/${orderId}`);
  }
}

export async function reviewAction(formData: FormData) {
  const user = await currentUser();
  const orderId = Number(formData.get("order"));
  if (!user) redirect("/login");
  try {
    addReview(user.id, orderId, Number(formData.get("product")), Number(formData.get("rating") || "5"), String(formData.get("body") || ""));
  } catch (error) {
    fail(error, `/orders/${orderId}`);
  }
  redirect(`/orders/${orderId}`);
}

export async function cancelAction(formData: FormData) {
  const user = await currentUser();
  const orderId = Number(formData.get("order"));
  if (!user) redirect("/login");
  try {
    const order = one<{ status: string; user_id: number }>("SELECT status, user_id FROM orders WHERE id = ?", orderId);
    if (!order || order.user_id !== user.id) throw new RuleError("Order not found.");
    const { refundRuleForStatus } = await import("@/lib/states");
    const rule = refundRuleForStatus(order.status);
    if (!rule) throw new RuleError("This order can no longer be cancelled here.");
    requestRefund({ orderId, rule, reason: "Customer cancelled", actor: user.phone });
  } catch (error) {
    fail(error, `/orders/${orderId}`);
  }
  redirect(`/orders/${orderId}`);
}

export async function airAction(formData: FormData) {
  const user = await currentUser();
  const orderId = Number(formData.get("order"));
  if (!user) redirect("/login");
  try {
    const result = switchToAir(user.id, orderId, await getLang());
    if (result.groupId) redirect(`/pay/${result.groupId}`);
  } catch (error) {
    fail(error, `/orders/${orderId}`);
  }
  redirect(`/orders/${orderId}`);
}

export async function proofAction(formData: FormData) {
  const user = await currentUser();
  const orderId = Number(formData.get("order"));
  if (!user) redirect("/login");
  const file = formData.get("proof");
  if (!(file instanceof File) || !file.size) fail(new RuleError("Upload the transfer slip."), `/orders/${orderId}`);
  const url = await saveUpload(file, "proof", { visibility: "owner", userId: user.id });
  run("UPDATE orders SET balance_proof = ? WHERE id = ? AND user_id = ?", url, orderId, user.id);
  redirect(`/orders/${orderId}`);
}

export async function addressAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  const { insert } = await import("@/lib/db");
  insert(
    "INSERT INTO addresses (user_id, name, phone, area, line, is_default) VALUES (?,?,?,?,?,1)",
    user.id,
    String(formData.get("name") || user.name),
    String(formData.get("phone") || user.phone),
    String(formData.get("area") || "freetown"),
    String(formData.get("line") || ""),
  );
  redirect("/account");
}

export async function sellerAction(formData: FormData) {
  let doc: string | undefined;
  const file = formData.get("doc");
  if (file instanceof File && file.size) doc = await saveUpload(file, "seller", { visibility: "staff" });
  const id = submitSeller({
    shop: String(formData.get("shop") || ""),
    owner: String(formData.get("owner") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    category: String(formData.get("category") || ""),
    city: String(formData.get("city") || "Freetown"),
    note: String(formData.get("note") || ""),
    doc,
  });
  redirect(`/sell?done=${id}`);
}

export async function visualAction(formData: FormData) {
  const file = formData.get("image");
  if (!(file instanceof File) || !file.size) fail(new RuleError("Choose a photo."), "/visual");
  const buf = Buffer.from(await file.arrayBuffer());
  const saved = saveBuffer(buf, "visual", "jpg");
  const match = matchImage(buf);
  redirect(`/visual?file=${encodeURIComponent(saved)}&cat=${match.category}&ids=${match.ids.join(",")}`);
}

export async function advanceAction(formData: FormData) {
  const actor = await staff();
  const orderId = Number(formData.get("order"));
  let evidence: string | undefined;
  const file = formData.get("file");
  if (file instanceof File && file.size) {
    const owner = one<{ user_id: number }>("SELECT user_id FROM orders WHERE id = ?", orderId);
    evidence = await saveUpload(file, "evidence", { visibility: "owner", userId: owner?.user_id || null });
  }
  try {
    advanceOrder(actor, orderId, String(formData.get("to") || ""), {
      note: String(formData.get("note") || ""),
      evidence,
      bl: String(formData.get("bl") || ""),
      measuredCm3: Number(formData.get("cm3") || "0") || undefined,
      code: String(formData.get("code") || ""),
    });
  } catch (error) {
    fail(error, `/admin/orders/${orderId}`);
  }
  redirect(`/admin/orders/${orderId}`);
}

export async function redeemAction(formData: FormData) {
  const actor = await staff();
  try {
    await redeemPickup(actor, String(formData.get("code") || ""));
  } catch (error) {
    fail(error, "/admin/warehouse");
  }
  redirect("/admin/warehouse");
}

export async function balanceAction(formData: FormData) {
  const actor = await staff();
  const orderId = Number(formData.get("order"));
  try {
    confirmBalance(actor, orderId);
  } catch (error) {
    fail(error, `/admin/orders/${orderId}`);
  }
  redirect(`/admin/orders/${orderId}`);
}

export async function refundAction(formData: FormData) {
  const actor = await staff();
  const orderId = Number(formData.get("order"));
  try {
    requestRefund({
      orderId,
      rule: String(formData.get("rule") || "quality") as RefundRule,
      reason: String(formData.get("reason") || "Refund"),
      actor: actor.email,
      staff: actor,
      itemId: Number(formData.get("item") || "0") || null,
      choice: formData.get("choice") === "resend" ? "resend" : "refund",
    });
  } catch (error) {
    fail(error, `/admin/orders/${orderId}`);
  }
  redirect(`/admin/orders/${orderId}`);
}

export async function approveRefundAction(formData: FormData) {
  const actor = await staff();
  const id = Number(formData.get("id"));
  try {
    approveRefund(actor, id);
  } catch (error) {
    fail(error, "/admin/finance");
  }
  redirect("/admin/finance");
}

export async function issueQuoteAction(formData: FormData) {
  const actor = await staff();
  const id = Number(formData.get("id"));
  try {
    issueQuote(actor, id, {
      title: String(formData.get("title") || "Linked item"),
      cny: Number(formData.get("cny") || "30"),
      weightG: Number(formData.get("g") || "400"),
      l: Number(formData.get("l") || "20"),
      w: Number(formData.get("w") || "15"),
      h: Number(formData.get("h") || "8"),
      dutyPct: Number(formData.get("duty") || "10"),
      hs: String(formData.get("hs") || "8544.42"),
      marginPct: Number(formData.get("margin") || "35"),
    });
  } catch (error) {
    fail(error, "/admin/quotes");
  }
  redirect("/admin/quotes");
}

export async function productAction(formData: FormData) {
  const actor = await staff();
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const uploaded: string[] = [];
  for (const file of files) uploaded.push(await saveUpload(file, "sku", { visibility: "public" }));
  const existing = String(formData.get("images") || "");
  const images = [...existing.split(/\s+/).filter(Boolean), ...uploaded].join(" ");
  try {
    const id = saveProduct(actor, { ...Object.fromEntries(formData.entries()), images } as Record<string, string>, formData.get("publish") === "1");
    redirect(`/admin/products/${id}`);
  } catch (error) {
    const id = formData.get("id");
    fail(error, id ? `/admin/products/${id}` : "/admin/products");
  }
}

export async function pullPhotoAction(formData: FormData) {
  const actor = await staff();
  const id = Number(formData.get("id"));
  const product = one<{ id: number; sku: string; visual_key: string | null; images: string }>("SELECT id, sku, visual_key, images FROM products WHERE id = ?", id);
  if (!product) redirect("/admin/products");
  const pool: Record<string, string> = {
    phone: "photo-1511707171634-5f897ff02aa9",
    solar: "photo-1509391366360-2e959784a276",
    beauty: "photo-1522335789203-aabd1fc54bc9",
    home: "photo-1556911220-e15b29be8c8f",
    moto: "photo-1558981403-c5f9899a28bc",
    apparel: "photo-1521572163474-6864f9cf17ab",
  };
  const photo = pool[product.visual_key || "phone"] || pool.phone;
  try {
    const res = await fetch(`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=900&q=70`);
    if (!res.ok) throw new RuleError("Could not fetch a sample photo.");
    const saved = saveBuffer(Buffer.from(await res.arrayBuffer()), product.sku, "jpg");
    const images = JSON.parse(product.images || "[]") as string[];
    images.unshift(saved);
    run("UPDATE products SET images = ? WHERE id = ?", JSON.stringify(images), id);
    const { audit } = await import("@/lib/commerce");
    audit(actor.email, "photo_fetch", product.sku, null, saved);
  } catch (error) {
    fail(error, `/admin/products/${id}`);
  }
  redirect(`/admin/products/${id}`);
}

export async function importAction(formData: FormData) {
  const actor = await staff();
  const file = formData.get("file");
  if (!(file instanceof File)) fail(new RuleError("Choose a CSV."), "/admin/products");
  try {
    const n = importProducts(actor, await file.text());
    redirect(`/admin/products?imported=${n}`);
  } catch (error) {
    fail(error, "/admin/products");
  }
}

export async function reconAction(formData: FormData) {
  const actor = await staff();
  const file = formData.get("file");
  if (!(file instanceof File)) fail(new RuleError("Choose the settlement file."), "/admin/finance");
  try {
    const result = importSettlement(await file.text(), actor);
    redirect(`/admin/finance?matched=${result.matched}&bad=${result.exceptions}`);
  } catch (error) {
    fail(error, "/admin/finance");
  }
}

export async function supplementAction(formData: FormData) {
  const actor = await staff();
  try {
    const { supplementOrder } = await import("@/lib/commerce");
    supplementOrder(actor, String(formData.get("number") || ""), String(formData.get("ref") || ""), Number(formData.get("amount") || "0"));
  } catch (error) {
    fail(error, "/admin/finance");
  }
  redirect("/admin/finance");
}

export async function fxProposeAction(formData: FormData) {
  const actor = await staff();
  try {
    proposeFx(actor, Number(formData.get("sle") || "24"), Number(formData.get("cny") || "7.15"), Number(formData.get("buffer") || "300"));
  } catch (error) {
    fail(error, "/admin/finance");
  }
  redirect("/admin/finance");
}

export async function fxActivateAction(formData: FormData) {
  const actor = await staff();
  try {
    activateFx(actor, Number(formData.get("id")));
  } catch (error) {
    fail(error, "/admin/finance");
  }
  redirect("/admin/finance");
}

export async function settingAction(formData: FormData) {
  const actor = await staff();
  try {
    for (const key of ["sea_usd_cents_per_cbm", "air_usd_cents_per_kg", "delivery_sle", "free_delivery_sle", "split_threshold_sle", "deposit_bps", "gst_deductible", "whatsapp_down", "show_trust_stats"]) {
      const value = formData.get(key);
      if (value != null) setSetting(actor, key, String(value));
    }
  } catch (error) {
    fail(error, "/admin/settings");
  }
  redirect("/admin/settings");
}

export async function cutoffAction() {
  const actor = await staff();
  try {
    runCutoff(actor);
  } catch (error) {
    fail(error, "/admin/warehouse");
  }
  redirect("/admin/warehouse");
}

export async function lclAction(formData: FormData) {
  const actor = await staff();
  try {
    shipLcl(actor, Number(formData.get("id")));
  } catch (error) {
    fail(error, "/admin/warehouse");
  }
  redirect("/admin/warehouse");
}

export async function ticketReplyAction(formData: FormData) {
  const actor = await staff();
  const id = Number(formData.get("id"));
  try {
    replyTicket(actor, id, String(formData.get("body") || ""), formData.get("internal") === "1");
  } catch (error) {
    fail(error, `/admin/tickets/${id}`);
  }
  redirect(`/admin/tickets/${id}`);
}

export async function sellerReviewAction(formData: FormData) {
  const actor = await staff();
  try {
    reviewSeller(actor, Number(formData.get("id")), formData.get("approve") === "1", Number(formData.get("commission") || "8"), String(formData.get("reason") || ""));
  } catch (error) {
    fail(error, "/admin/sellers");
  }
  redirect("/admin/sellers");
}

export async function couponAction(formData: FormData) {
  const actor = await staff();
  try {
    const { createCoupon } = await import("@/lib/commerce");
    createCoupon(actor, {
      code: String(formData.get("code") || ""),
      kind: String(formData.get("kind") || "amount"),
      value: Number(formData.get("value") || "0"),
      minSle: Number(formData.get("min") || "0"),
      capSle: Number(formData.get("cap") || "0"),
      zone: String(formData.get("zone") || "any"),
      maxUses: Number(formData.get("max") || "0"),
      perUser: Number(formData.get("per") || "1"),
      days: Number(formData.get("days") || "90"),
      title: String(formData.get("title") || ""),
    });
  } catch (error) {
    fail(error, "/admin/coupons");
  }
  redirect("/admin/coupons");
}

export async function postAction(formData: FormData) {
  const actor = await staff();
  try {
    savePost(actor, Object.fromEntries(formData.entries()) as Record<string, string>);
  } catch (error) {
    fail(error, "/admin/content");
  }
  redirect("/admin/content");
}

export async function roleAction(formData: FormData) {
  const actor = await staff();
  try {
    saveStaff(actor, Number(formData.get("id")), String(formData.get("role") || "cs"), formData.get("active") !== "0");
  } catch (error) {
    fail(error, "/admin/people");
  }
  redirect("/admin/people");
}

export async function resendAction(formData: FormData) {
  const actor = await staff();
  const orderId = Number(formData.get("order"));
  try {
    resendNotice(actor, orderId);
  } catch (error) {
    fail(error, `/admin/orders/${orderId}`);
  }
  redirect(`/admin/orders/${orderId}`);
}

export async function demoResetAction() {
  const actor = await staff();
  if (!getSettings().demo_mode || actor.role !== "super_admin") redirect("/");
  resetDatabase();
  redirect("/demo?reset=1");
}

export async function demoAdvanceAction(formData: FormData) {
  if (!getSettings().demo_mode) redirect("/");
  const user = await currentUser();
  const orderId = Number(formData.get("order"));
  if (!user) redirect(`/login?next=/orders/${orderId}`);
  const order = one<{ user_id: number; zone: string; status: string; pickup_code: string | null }>(
    "SELECT user_id, zone, status, pickup_code FROM orders WHERE id = ?",
    orderId,
  );
  if (!order || order.user_id !== user.id) redirect("/orders");
  const { nextForward } = await import("@/lib/states");
  const to = nextForward(order.zone, order.status);
  if (!to || to === "PAID") redirect(`/orders/${orderId}`);
  const actor: StaffActor = { id: 0, name: "Demo desk", role: "super_admin", email: "demo@ledirect.demo" };
  try {
    advanceOrder(actor, orderId, to, {
      note: to === "PROCURED" ? "1688 order 88421 demo" : "Demo desk",
      evidence: "/photos/wh-1.jpg",
      bl: to === "SHIPPED" ? "MSCU990011" : "",
      code: order.pickup_code || "",
    });
  } catch (error) {
    fail(error, `/orders/${orderId}`);
  }
  redirect(`/orders/${orderId}`);
}

export async function replayAction(formData: FormData) {
  const actor = await staff();
  if (!["finance", "super_admin"].includes(actor.role)) fail(new RuleError("Finance only."), "/admin/finance");
  const groupId = Number(formData.get("group"));
  const group = one<{ external_ref: string; charged_sle: number; method: string }>("SELECT external_ref, charged_sle, method FROM payment_groups WHERE id = ?", groupId);
  if (!group?.external_ref) fail(new RuleError("No payment to replay."), "/admin/finance");
  settlePayment({ groupId, externalRef: group.external_ref, status: "success", method: group.method || "orange", amountSle: group.charged_sle });
  redirect("/admin/finance?replay=1");
}

export async function reportNote() {
  return buildReport(new Date(Date.now() - 400 * 86400000).toISOString(), new Date(Date.now() + 86400000).toISOString());
}

export async function desk() {
  return dashboard();
}
