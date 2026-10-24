import { NextResponse } from "next/server";
import { safePath } from "@/lib/safe";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("lang");
  const lang = raw === "zh" || raw === "fr" ? raw : "en";
  const dest = new URL(safePath(url.searchParams.get("next") || "/"), url.origin);
  const res = NextResponse.redirect(dest);
  res.cookies.set("lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
