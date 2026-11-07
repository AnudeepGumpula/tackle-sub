"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computeTotals, CURRENCIES, formatMoney, toCents } from "@/lib/money";
import type { InvoiceDraft } from "@/lib/types";

interface ItemState { description: string; quantity: string; unit_price: string }

export interface EditorInitial extends Omit<InvoiceDraft, "assumptions" | "source"> {
  source_text?: string | null;
}

export function InvoiceEditor({
  initial,
  invoiceId,
  assumptions = [],
  onCancel,
}: {
  initial: EditorInitial;
  invoiceId?: string;
  assumptions?: string[];
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [clientName, setClientName] = useState(initial.client_name);
  const [clientEmail, setClientEmail] = useState(initial.client_email ?? "");
  const [items, setItems] = useState<ItemState[]>(
    initial.line_items.map((i) => ({ description: i.description, quantity: String(i.quantity), unit_price: String(i.unit_price) })),
  );
  const [dueDate, setDueDate] = useState(initial.due_date);
  const [taxRate, setTaxRate] = useState(String(initial.tax_rate ?? 0));
  const [currency, setCurrency] = useState(initial.currency);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [saving, setSaving] = useState<null | "draft" | "send">(null);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(
    () => computeTotals(items.map((i) => ({ quantity: Number(i.quantity) || 0, unit_price_cents: toCents(Number(i.unit_price) || 0) })), Number(taxRate) || 0),
    [items, taxRate],
  );

  const updateItem = (idx: number, patch: Partial<ItemState>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  async function save(send: boolean) {
    setErr(null);
    setSaving(send ? "send" : "draft");
    try {
      const body = {
        client_name: clientName,
        client_email: clientEmail || null,
        line_items: items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) || 0 })),
        due_date: dueDate,
        tax_rate: Number(taxRate) || 0,
        currency,
        notes: notes || null,
        source_text: initial.source_text ?? null,
        send,
      };
      const res = await fetch(invoiceId ? `/api/invoices/${invoiceId}` : "/api/invoices", {
        method: invoiceId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save invoice");
      if (invoiceId && send && data.invoice.status === "draft") {
        await fetch(`/api/invoices/${invoiceId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "sent" }) });
      }
      router.push(`/invoices/${data.invoice.id}${invoiceId ? "" : "?created=1"}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save invoice");
      setSaving(null);
    }
  }

  return (
    <form
      className="card p-5 sm:p-6"
      data-testid="invoice-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save(true);
      }}
    >
      {assumptions.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2" data-testid="assumptions">
          <span className="text-xs font-semibold text-amber-700">Check these:</span>
          {assumptions.map((a) => (
            <span key={a} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800 ring-1 ring-amber-200">{a}</span>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="client_name">Client name</label>
          <input id="client_name" name="client_name" className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="client_email">Client email</label>
          <input id="client_email" name="client_email" type="email" className="input" placeholder="optional" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 hidden grid-cols-[1fr_90px_120px_110px_36px] gap-2 sm:grid">
          <span className="label">Description</span><span className="label">Qty</span><span className="label">Price</span><span className="label text-right">Amount</span><span />
        </div>
        <div className="space-y-3 sm:space-y-2">
          {items.map((it, idx) => {
            const amount = Math.round((Number(it.quantity) || 0) * toCents(Number(it.unit_price) || 0));
            return (
              <div key={idx} className="grid grid-cols-[1fr_1fr_36px] gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[1fr_90px_120px_110px_36px] sm:bg-transparent sm:p-0" data-testid="line-item">
                <input aria-label={`Item ${idx + 1} description`} className="input col-span-3 sm:col-span-1" value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="What did you do?" required />
                <input aria-label={`Item ${idx + 1} quantity`} className="input" inputMode="decimal" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} required />
                <input aria-label={`Item ${idx + 1} price`} className="input" inputMode="decimal" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: e.target.value })} required />
                <span className="hidden self-center text-right text-sm font-medium tabular-nums sm:block">{formatMoney(amount, currency)}</span>
                <button type="button" className="btn-ghost px-2 text-slate-400 hover:text-red-600" aria-label={`Remove item ${idx + 1}`} onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} disabled={items.length === 1}>✕</button>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn-ghost mt-2 px-2 text-brand-700" onClick={() => setItems((p) => [...p, { description: "", quantity: "1", unit_price: "0" }])}>
          + Add line item
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="due_date">Due date</label>
          <input id="due_date" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="tax_rate">Tax %</label>
          <input id="tax_rate" className="input" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="currency">Currency</label>
          <select id="currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="notes">Note to client</label>
        <textarea id="notes" className="input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional, e.g. Thanks for your business!" />
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-end sm:justify-between">
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
          <dt className="text-slate-500">Subtotal</dt><dd className="text-right tabular-nums">{formatMoney(totals.subtotal_cents, currency)}</dd>
          <dt className="text-slate-500">Tax</dt><dd className="text-right tabular-nums">{formatMoney(totals.tax_cents, currency)}</dd>
          <dt className="font-semibold">Total</dt><dd className="text-right text-lg font-bold tabular-nums" data-testid="editor-total">{formatMoney(totals.total_cents, currency)}</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
          <button type="button" className="btn-secondary" onClick={() => save(false)} disabled={saving !== null}>
            {saving === "draft" ? "Saving…" : invoiceId ? "Save changes" : "Save as draft"}
          </button>
          <button type="submit" className="btn-primary" disabled={saving !== null} data-testid="save-and-send">
            {saving === "send" ? "Saving…" : invoiceId ? "Save & send" : "Create & get pay link"}
          </button>
        </div>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
    </form>
  );
}
