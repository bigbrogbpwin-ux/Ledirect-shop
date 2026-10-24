import { ticketReplyAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { requireStaffRole, getLang } from "@/lib/auth";
import { many, one } from "@/lib/db";
import { freetown } from "@/lib/format";
import { t } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireStaffRole(["cs", "ops", "finance"]);
  const { id } = await params;
  const sp = await searchParams;
  const lang = await getLang();
  const ticket = one<Record<string, unknown>>("SELECT * FROM tickets WHERE id = ?", Number(id));
  if (!ticket) notFound();
  const messages = many<Record<string, unknown>>("SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id", ticket.id);
  return (
    <div>
      <h1 className="text-3xl font-semibold">{String(ticket.number)}</h1>
      <ErrorNote error={sp.error} />
      <p className="text-sm">{String(ticket.type)} · {String(ticket.status)} · SLA {freetown(String(ticket.sla_due_at || ""))}</p>
      <ul className="mt-4 space-y-2">
        {messages.map((message) => (
          <li key={String(message.id)} className="border border-line bg-white p-3 text-sm">
            <p className="text-xs uppercase">{String(message.author_kind)} · {String(message.author_name)}</p>
            <p>{String(message.body)}</p>
          </li>
        ))}
      </ul>
      <form action={ticketReplyAction} className="mt-4 space-y-2">
        <input type="hidden" name="id" value={String(ticket.id)} />
        <textarea name="body" required className="min-h-24 w-full border border-line bg-white p-2" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="internal" value="1" /> internal</label>
        <button className="min-h-11 bg-sea px-3 text-white" type="submit">{t(lang, "send")}</button>
      </form>
    </div>
  );
}
