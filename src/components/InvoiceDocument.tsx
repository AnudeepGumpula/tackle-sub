import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Invoice, Settings } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

function qty(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

export function InvoiceDocument({ invoice, settings }: { invoice: Invoice; settings: Settings }) {
  const c = invoice.currency;
  return (
    <article className="card p-6 sm:p-10" data-testid="invoice-document">
      <header className="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div>
          <p className="text-lg font-bold">{settings.business_name}</p>
          {settings.business_email && <p className="text-sm text-slate-500">{settings.business_email}</p>}
          {settings.business_address && <p className="whitespace-pre-line text-sm text-slate-500">{settings.business_address}</p>}
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Invoice</p>
          <p className="text-2xl font-bold" data-testid="invoice-number">{invoice.number}</p>
          <div className="mt-2"><StatusBadge status={invoice.display_status} /></div>
        </div>
      </header>

      <div className="mt-8 grid gap-6 text-sm sm:grid-cols-3">
        <div>
          <p className="label">Billed to</p>
          <p className="font-medium" data-testid="invoice-client">{invoice.client.name}</p>
          {invoice.client.email && <p className="text-slate-500">{invoice.client.email}</p>}
        </div>
        <div>
          <p className="label">Issued</p>
          <p>{formatDate(invoice.issue_date)}</p>
        </div>
        <div>
          <p className="label">{invoice.status === "paid" ? "Paid" : "Due"}</p>
          <p className={invoice.display_status === "overdue" ? "font-semibold text-red-600" : ""}>
            {invoice.status === "paid" ? formatDate(invoice.paid_at) : formatDate(invoice.due_date)}
          </p>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 font-semibold">Description</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="hidden py-2 text-right font-semibold sm:table-cell">Price</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.line_items.map((li) => (
            <tr key={li.id} className="border-b border-slate-100">
              <td className="py-3 pr-2">{li.description}</td>
              <td className="py-3 text-right tabular-nums">{qty(li.quantity)}</td>
              <td className="hidden py-3 text-right tabular-nums sm:table-cell">{formatMoney(li.unit_price_cents, c)}</td>
              <td className="py-3 text-right tabular-nums">{formatMoney(li.amount_cents, c)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-6 grid max-w-xs grid-cols-2 gap-y-1.5 text-sm">
        <dt className="text-slate-500">Subtotal</dt><dd className="text-right tabular-nums">{formatMoney(invoice.subtotal_cents, c)}</dd>
        {invoice.tax_rate > 0 && (<><dt className="text-slate-500">Tax ({invoice.tax_rate}%)</dt><dd className="text-right tabular-nums">{formatMoney(invoice.tax_cents, c)}</dd></>)}
        <dt className="border-t border-slate-200 pt-2 font-semibold">{invoice.status === "paid" ? "Total paid" : "Amount due"}</dt>
        <dd className="border-t border-slate-200 pt-2 text-right text-xl font-bold tabular-nums" data-testid="invoice-total">{formatMoney(invoice.total_cents, c)}</dd>
      </dl>

      {invoice.notes && <p className="mt-8 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{invoice.notes}</p>}
    </article>
  );
}
