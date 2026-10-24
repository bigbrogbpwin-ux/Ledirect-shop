import { currentUser } from "@/lib/auth";
import { invoicePdf } from "@/lib/invoice";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Sign in", { status: 401 });
  const { id } = await ctx.params;
  const pdf = invoicePdf(Number(id), user.id);
  if (!pdf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.filename.replace(/[^A-Za-z0-9.-]/g, "") || "invoice.pdf"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
