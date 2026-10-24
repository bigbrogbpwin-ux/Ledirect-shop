import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const verify = scryptSync(pw, salt, 32);
  const left = Buffer.from(hash, "hex");
  if (left.length !== verify.length) return false;
  return timingSafeEqual(left, verify);
}

export function randomCode(digits = 6): string {
  const n = randomBytes(4).readUInt32BE(0) % 10 ** digits;
  return String(n).padStart(digits, "0");
}

export function randomId(bytes = 24): string {
  return randomBytes(bytes).toString("hex");
}
