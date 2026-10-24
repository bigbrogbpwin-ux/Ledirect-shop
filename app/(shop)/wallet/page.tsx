import { topupAction } from "@/app/actions";
import { ErrorNote } from "@/components/card";
import { currentUser, getLang } from "@/lib/auth";
import { many, one } from "@/lib/db";
import { freetown, le } from "@/lib/format";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login?next=/wallet");
  const lang = await getLang();
  const wallet = one<{ balance_sle: number; frozen_sle: number }>("SELECT balance_sle, frozen_sle FROM wallets WHERE user_id = ?", user.id);
  const txns = many<{ id: number; type: string; amount_sle: number; balance_after: number; note: string; created_at: string }>(
    "SELECT id, type, amount_sle, balance_after, note, created_at FROM wallet_txns WHERE user_id = ? ORDER BY id DESC LIMIT 30",
    user.id,
  );
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold">{t(lang, "wallet")}</h1>
      <ErrorNote error={sp.error} />
      <p className="mt-3 text-4xl font-semibold">{le(wallet?.balance_sle || 0)}</p>
      <p className="text-sm">{t(lang, "frozen")} {le(wallet?.frozen_sle || 0)}</p>
      <form action={topupAction} className="mt-4 flex gap-2">
        <input name="amount" type="number" min={20} defaultValue={500} className="min-h-11 flex-1 border border-line bg-white px-2" />
        <button className="min-h-11 bg-coral px-4 text-white" type="submit">{t(lang, "topup")}</button>
      </form>
      <ul className="mt-6 space-y-2 text-sm">
        {txns.map((txn) => (
          <li key={txn.id} className="border border-line bg-white p-3">
            {txn.type} {le(txn.amount_sle)} · {t(lang, "balance_label")} {le(txn.balance_after)}
            <p className="text-xs text-ink/60">{txn.note} · {freetown(txn.created_at)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
