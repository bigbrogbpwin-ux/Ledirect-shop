import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { insert, one, run } from "./db";
import { hitLimit } from "./commerce";
import { getSettings } from "./settings";
import { addHours, normalizePhone, nowIso } from "./format";
import type { Lang } from "./i18n";
import { randomCode, randomId, verifyPassword } from "./password";

function sessionCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

export type UserRow = { id: number; phone: string; name: string; email: string | null; pickup_point_id: number | null };
export type StaffRow = { id: number; email: string; name: string; role: string; active: number };

async function jar() {
  return cookies();
}

export async function getLang(): Promise<Lang> {
  const value = (await jar()).get("lang")?.value;
  if (value === "zh" || value === "fr") return value;
  return "en";
}

export async function readCartToken() {
  return (await jar()).get("ld_cart")?.value;
}

export async function ensureCartToken() {
  const box = await jar();
  let token = box.get("ld_cart")?.value;
  if (!token) {
    token = randomId(16);
    box.set("ld_cart", token, sessionCookie(60 * 60 * 24 * 45));
  }
  return token;
}

export async function currentUser() {
  const sid = (await jar()).get("ld_sid")?.value;
  if (!sid) return null;
  const session = one<{ user_id: number; kind: string }>("SELECT user_id, kind FROM sessions WHERE id = ?", sid);
  if (!session || session.kind !== "customer") return null;
  return one<UserRow>("SELECT id, phone, name, email, pickup_point_id FROM users WHERE id = ?", session.user_id) || null;
}

export async function currentStaff() {
  const sid = (await jar()).get("ld_staff")?.value;
  if (!sid) return null;
  const session = one<{ user_id: number; kind: string }>("SELECT user_id, kind FROM sessions WHERE id = ?", sid);
  if (!session || session.kind !== "staff") return null;
  return one<StaffRow>("SELECT id, email, name, role, active FROM staff WHERE id = ? AND active = 1", session.user_id) || null;
}

function startSession(kind: "customer" | "staff", userId: number) {
  const id = randomId(18);
  insert("INSERT INTO sessions (id, kind, user_id, created_at) VALUES (?,?,?,?)", id, kind, userId, nowIso());
  return id;
}

export async function requestOtp(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  hitLimit(`otp:${phone}`, 5, 600);
  const code = randomCode(6);
  insert("INSERT INTO otp_codes (phone, code, purpose, expires_at) VALUES (?,?,?,?)", phone, code, "login", addHours(nowIso(), 0.16));
  const box = await jar();
  box.set("ld_otp_phone", phone, sessionCookie(600));
  if (getSettings().demo_mode) box.set("ld_otp_hint", code, sessionCookie(600));
  return phone;
}

export async function verifyOtp(phoneRaw: string, code: string, name: string) {
  const phone = normalizePhone(phoneRaw);
  hitLimit(`otp-try:${phone}`, 8, 600);
  const row = one<{ id: number; code: string }>(
    "SELECT id, code FROM otp_codes WHERE phone = ? AND purpose = 'login' AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1",
    phone,
    nowIso(),
  );
  if (!row || row.code !== code.trim()) throw new Error("That code is not right.");
  run("UPDATE otp_codes SET used = 1 WHERE id = ?", row.id);
  let user = one<UserRow>("SELECT id, phone, name, email, pickup_point_id FROM users WHERE phone = ?", phone);
  if (!user) {
    if (!name.trim()) throw new Error("Add your name the first time.");
    const id = insert("INSERT INTO users (phone, name, created_at) VALUES (?,?,?)", phone, name.trim(), nowIso());
    insert("INSERT INTO wallets (user_id, balance_sle, frozen_sle) VALUES (?,0,0)", id);
    user = { id, phone, name: name.trim(), email: null, pickup_point_id: null };
  } else if (name.trim() && !user.name) {
    run("UPDATE users SET name = ? WHERE id = ?", name.trim(), user.id);
  }
  const sid = startSession("customer", user.id);
  const box = await jar();
  box.set("ld_sid", sid, sessionCookie(60 * 60 * 24 * 30));
  box.delete("ld_otp_hint");
  const token = box.get("ld_cart")?.value;
  if (token) run("UPDATE carts SET user_id = ? WHERE token = ?", user.id, token);
  return user;
}

export async function logoutCustomer() {
  const box = await jar();
  const sid = box.get("ld_sid")?.value;
  if (sid) run("DELETE FROM sessions WHERE id = ?", sid);
  box.delete("ld_sid");
}

export async function staffPassword(email: string, password: string) {
  hitLimit(`staff:${email.toLowerCase()}`, 8, 600);
  const staff = one<StaffRow & { password_hash: string }>("SELECT * FROM staff WHERE email = ? AND active = 1", email.trim().toLowerCase());
  if (!staff || !verifyPassword(password, staff.password_hash)) throw new Error("Email or password is wrong.");
  const code = randomCode(6);
  insert("INSERT INTO otp_codes (phone, code, purpose, expires_at) VALUES (?,?,?,?)", staff.email, code, "staff", addHours(nowIso(), 0.16));
  const box = await jar();
  box.set("ld_staff_pending", staff.email, sessionCookie(600));
  if (getSettings().demo_mode) box.set("ld_staff_hint", code, sessionCookie(600));
}

export async function staffSecond(code: string) {
  const box = await jar();
  const email = box.get("ld_staff_pending")?.value;
  if (!email) throw new Error("Start again with your password.");
  const row = one<{ id: number; code: string }>(
    "SELECT id, code FROM otp_codes WHERE phone = ? AND purpose = 'staff' AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1",
    email,
    nowIso(),
  );
  if (!row || row.code !== code.trim()) throw new Error("That second code is not right.");
  run("UPDATE otp_codes SET used = 1 WHERE id = ?", row.id);
  const staff = one<StaffRow>("SELECT id, email, name, role, active FROM staff WHERE email = ?", email);
  if (!staff) throw new Error("Staff account missing.");
  const sid = startSession("staff", staff.id);
  box.set("ld_staff", sid, sessionCookie(60 * 60 * 12));
  box.delete("ld_staff_hint");
  box.delete("ld_staff_pending");
}

export async function logoutStaff() {
  const box = await jar();
  const sid = box.get("ld_staff")?.value;
  if (sid) run("DELETE FROM sessions WHERE id = ?", sid);
  box.delete("ld_staff");
}

export async function setLang(lang: Lang) {
  (await jar()).set("lang", lang, { ...sessionCookie(60 * 60 * 24 * 365), httpOnly: false });
}

const STAFF_CAN: Record<string, string[]> = {
  orders: ["ops", "procurement", "warehouse", "cs", "finance"],
  tickets: ["cs", "ops", "finance"],
  move: ["ops", "procurement", "warehouse"],
  money: ["finance"],
  notify: ["cs", "ops"],
};

export function staffCan(role: string, action: keyof typeof STAFF_CAN) {
  if (role === "super_admin") return true;
  return STAFF_CAN[action].includes(role);
}

export async function requireStaffRole(roles: string[]) {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  if (staff.role !== "super_admin" && !roles.includes(staff.role)) redirect("/admin");
  return staff;
}
