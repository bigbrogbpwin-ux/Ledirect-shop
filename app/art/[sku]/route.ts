import { packshotSvg } from "@/lib/art";

export async function GET(req: Request, ctx: { params: Promise<{ sku: string }> }) {
  const { sku } = await ctx.params;
  const url = new URL(req.url);
  const svg = packshotSvg(decodeURIComponent(sku), url.searchParams.get("c") || "phone", Number(url.searchParams.get("v") || "1"));
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
