import { currentUser } from "@/lib/auth";
import { many, run } from "@/lib/db";
import { nowIso } from "@/lib/format";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ items: [] });
  const items = many<{ id: number; body: string; channel: string }>(
    "SELECT id, body, channel FROM messages WHERE user_id = ? AND popup = 1 AND read_at IS NULL ORDER BY id DESC LIMIT 4",
    user.id,
  );
  if (items.length) {
    run(`UPDATE messages SET read_at = ? WHERE id IN (${items.map(() => "?").join(",")})`, nowIso(), ...items.map((item) => item.id));
  }
  return Response.json({ items });
}
