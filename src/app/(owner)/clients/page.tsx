import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { getSettings, listClients } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [clients, settings] = await Promise.all([listClients(), getSettings()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="mt-1 text-slate-500">Added automatically when you invoice someone new.</p>
      </div>
      <div className="card overflow-x-auto">
        {clients.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No clients yet. <Link className="text-brand-700 underline" href="/">Create an invoice</Link> to add one.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm" data-testid="clients-table">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 text-right font-semibold">Invoices</th>
                <th className="px-5 py-3 text-right font-semibold">Outstanding</th>
                <th className="px-5 py-3 text-right font-semibold">Paid to date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.email ?? "no email"}</p>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.invoice_count}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(c.outstanding_cents, settings.currency)}
                    {c.overdue_count > 0 && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{c.overdue_count} overdue</span>}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-emerald-700">{formatMoney(c.paid_cents, settings.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
