import { readFileSync } from "fs";
import path from "path";
import { currentStaff, currentUser } from "@/lib/auth";
import { one } from "@/lib/db";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[\w.-]+$/.test(name) || name.includes("..")) return new Response("Not found", { status: 404 });
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const type = TYPES[ext];
  if (!type) return new Response("Not found", { status: 404 });
  const meta = one<{ visibility: string; user_id: number | null }>("SELECT visibility, user_id FROM uploads WHERE name = ?", name);
  if (!meta) return new Response("Not found", { status: 404 });
  if (meta.visibility !== "public") {
    const staff = await currentStaff();
    const user = await currentUser();
    const ownerOk = meta?.visibility === "owner" && user && user.id === meta.user_id;
    if (!staff && !ownerOk) return new Response("Not found", { status: 404 });
  }
  try {
    const buf = readFileSync(path.join(process.cwd(), "data", "uploads", name));
    return new Response(buf, {
      headers: {
        "Content-Type": type,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": ext === "pdf" ? "attachment" : "inline",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
