import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { insert } from "./db";
import { nowIso } from "./format";
import { randomId } from "./password";

const ALLOWED = new Set(["jpg", "png", "webp", "pdf"]);

export type UploadAccess = { visibility: "public" | "owner" | "staff"; userId?: number | null };

function sniff(buf: Buffer): "jpg" | "png" | "webp" | "pdf" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  return null;
}

function extOf(name: string) {
  const ext = (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normal = ext === "jpeg" ? "jpg" : ext;
  if (!ALLOWED.has(normal)) throw new Error("Upload a JPG, PNG, WEBP, or PDF.");
  return normal;
}

function writeNamed(buf: Buffer, prefix: string, ext: string, access: UploadAccess) {
  if (buf.length > 8_000_000) throw new Error("File is larger than 8 MB.");
  const kind = sniff(buf);
  if (!kind || kind !== ext) throw new Error("The file contents do not match its type.");
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "file";
  const name = `${safePrefix}-${Date.now()}-${randomId(16)}.${ext}`;
  const dir = path.join(process.cwd(), "data", "uploads");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), buf);
  insert(
    "INSERT INTO uploads (name, visibility, user_id, created_at) VALUES (?,?,?,?)",
    name,
    access.visibility,
    access.userId || null,
    nowIso(),
  );
  return `/api/uploads/${name}`;
}

export async function saveUpload(file: File, prefix: string, access: UploadAccess = { visibility: "staff" }): Promise<string> {
  if (!file || file.size === 0) throw new Error("Choose a file first.");
  if (file.size > 8_000_000) throw new Error("File is larger than 8 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extOf(file.name || "file.jpg");
  return writeNamed(buf, prefix, ext, access);
}

export function saveBuffer(buf: Buffer, prefix: string, ext: string, access: UploadAccess = { visibility: "public" }): string {
  const clean = extOf(`file.${ext}`);
  return writeNamed(buf, prefix, clean, access);
}
