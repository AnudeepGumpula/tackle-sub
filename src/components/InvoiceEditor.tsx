"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computeTotals, CURRENCIES, formatMoney, toCents } from "@/lib/money";
import { BILLING_TYPE_LABELS, BILLING_TYPES, usesRate, type BillingType, type FieldFlag, type FlagField, type InvoiceDraft } from "@/lib/types";

interface ItemState { kind: BillingType; description: string; quantity: string; unit_price: string }

export interface EditorInitial extends Omit<InvoiceDraft, "assumptions" | "source"> {
  source_text?: string | null;
}

const QTY_LABEL: Partial<Record<BillingType, string>> = { hourly: "Hours", day_rate: "Days" };
const PRICE_LABEL: Record<BillingType, string> = {
  hourly: "Rate / hr",
  day_rate: "Day rate",
  flat_fee: "Amount",
  milestone: "Amount",
  deposit: "Amount",
  retainer: "Amount",
};
const DESCRIPTION_HINT: Record<BillingType, string> = {
  hourly: "e.g. Design",
  day_rate: "e.g. On-site workshop",
  flat_fee: "e.g. Logo refresh",
  milestone: "e.g. Milestone 1: wireframes approved",
  deposit: "e.g. 50% deposit, website project",
  retainer: "e.g. November retainer",
};

const num = (v: string) => Number(v) || 0;
const lineQty = (it: ItemState) => (usesRate(it.kind) ? num(it.quantity) : 1);

/** Text shown under a field: a guess to check (amber) or a missing required value (red). */
function FieldNote({ flags, missing, id }: { flags: FieldFlag[]; missing?: boolean; id: string }) {
  if (!missing && flags.length === 0) return null;
  return (
    <div id={id} className="mt-1 space-y-0.5">
      {missing && <p className="text-xs font-medium text-red-600" data-testid="required-note">Required</p>}
      {flags.map((f) => (
        <p key={f.message} className="text-xs text-amber-700" data-testid="field-flag">{f.message}</p>
      ))}
    </div>
  );
}

const invalid = (bad: boolean) => (bad ? " border-red-500 ring-1 ring-red-500" : "");

export function InvoiceEditor({
  initial,
  invoiceId,
  assumptions = [],
  showMissing = false,
  onCancel,
}: {
  initial: EditorInitial;
  invoiceId?: string;
  assumptions?: FieldFlag[];
  /** Highlight missing required fields right away (used after the one-sentence parser fills the form). */
  showMissing?: boolean;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [clientName, setClientName] = useState(initial.client_name);
  const [clientEmail, setClientEmail] = useState(initial.client_email ?? "");
  const [items, setItems] = useState<ItemState[]>(
    initial.line_items.map((i) => ({ kind: i.kind, description: i.description, quantity: String(i.quantity), unit_price: i.unit_price ? String(i.unit_price) : "" })),
  );
  const [attempted, setAttempted] = useState(showMissing);
  const [dueDate, setDueDate] = useState(initial.due_date);
  const [taxRate, setTaxRate] = useState(String(initial.tax_rate ?? 0));
  const [currency, setCurrency] = useState(initial.currency);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [saving, setSaving] = useState<null | "draft" | "send">(null);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(
    () => computeTotals(items.map((i) => ({ quantity: lineQty(i), unit_price_cents: toCents(num(i.unit_price)) })), Number(taxRate) || 0),
    [items, taxRate],
  );

  const flagsFor = (field: FlagField) => assumptions.filter((a) => a.field === field);

  // Required: client name, due date, and for every line an amount (plus hours/days and a rate on rate-based lines).
  const missing = {
    client_name: !clientName.trim(),
    due_date: !dueDate,
    items: items.map((it) => ({ quantity: usesRate(it.kind) && num(it.quantity) <= 0, unit_price: num(it.unit_price) <= 0 })),
  };
  const anyMissing = missing.client_name || missing.due_date || missing.items.some((m) => m.quantity || m.unit_price);
  const show = (bad: boolean) => attempted && bad;

  const updateItem = (idx: number, patch: Partial<ItemState>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  // Switching type keeps the line's total: Hourly 10 x $120 -> Flat fee $1,200 (not $120).
  const changeKind = (idx: number, kind: BillingType) =>
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        if (usesRate(kind)) return { ...it, kind };
        const total = Math.round(lineQty(it) * num(it.unit_price) * 100) / 100;
        return { ...it, kind, quantity: "1", unit_price: it.unit_price === "" ? "" : String(total) };
      }),
    );

  async function save(send: boolean) {
    setErr(null);
    setAttempted(true);
    if (anyMissing) {
      setErr("Fill in the fields marked Required.");
      return;
    }
    setSaving(send ? "send" : "draft");
    try {
      const body = {
        client_name: clientName,
        client_email: clientEmail || null,
        line_items: items.map((i) => ({ kind: i.kind, description: i.description, quantity: lineQty(i), unit_price: num(i.unit_price) })),
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
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save(true);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="client_name">Client name</label>
          <input id="client_name" name="client_name" className={`input${invalid(show(missing.client_name))}`} value={clientName} onChange={(e) => setClientName(e.target.value)} aria-invalid={show(missing.client_name)} aria-describedby="client_name-note" />
          <FieldNote id="client_name-note" flags={flagsFor("client_name")} missing={show(missing.client_name)} />
        </div>
        <div>
          <label className="label" htmlFor="client_email">Client email <span className="font-normal normal-case text-slate-400">(optional)</span></label>
          <input id="client_email" name="client_email" type="email" className="input" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} aria-describedby="client_email-help" />
          <p id="client_email-help" className="mt-1 text-xs text-slate-500">Add an email to send the invoice from OneLine.</p>
          <FieldNote id="client_email-note" flags={flagsFor("client_email")} />
        </div>
      </div>

      <div className="mt-6">
        <p className="label mb-2">Line items</p>
        <div className="space-y-3">
          {items.map((it, idx) => {
            const amount = Math.round(lineQty(it) * toCents(num(it.unit_price)));
            const rate = usesRate(it.kind);
            const m = missing.items[idx];
            return (
              <div key={idx} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[130px_1fr_90px_120px_110px_36px] sm:items-start" data-testid="line-item">
                <div>
                  <span className="mb-1 block text-[11px] text-slate-500">Type</span>
                  <select aria-label={`Item ${idx + 1} type`} className="input" value={it.kind} onChange={(e) => changeKind(idx, e.target.value as BillingType)} data-testid="line-kind">
                    {BILLING_TYPES.map((k) => <option key={k} value={k}>{BILLING_TYPE_LABELS[k]}</option>)}
                  </select>
                </div>
                <div className={`col-span-2 ${rate ? "sm:col-span-1" : "sm:col-span-2"}`}>
                  <span className="mb-1 block text-[11px] text-slate-500">Description</span>
                  <input aria-label={`Item ${idx + 1} description`} className="input" value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder={DESCRIPTION_HINT[it.kind]} />
                </div>
                {rate && (
                  <div>
                    <>
                      <span className="mb-1 block text-[11px] text-slate-500">{QTY_LABEL[it.kind]}</span>
                      <input aria-label={`Item ${idx + 1} ${QTY_LABEL[it.kind]?.toLowerCase()}`} className={`input${invalid(show(m.quantity))}`} inputMode="decimal" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} data-testid="line-quantity" />
                      {show(m.quantity) && <p className="mt-1 text-xs font-medium text-red-600">Required</p>}
                    </>
                  </div>
                )}
                <div>
                  <span className="mb-1 block text-[11px] text-slate-500">{PRICE_LABEL[it.kind]}</span>
                  <input aria-label={`Item ${idx + 1} ${PRICE_LABEL[it.kind].toLowerCase()}`} className={`input${invalid(show(m.unit_price))}`} inputMode="decimal" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: e.target.value })} data-testid="line-price" />
                  {show(m.unit_price) && <p className="mt-1 text-xs font-medium text-red-600">Required</p>}
                </div>
                <div className="text-right">
                  <span className="mb-1 block text-[11px] text-slate-500">Total</span>
                  <span className="flex h-[38px] items-center justify-end text-sm font-medium tabular-nums">{formatMoney(amount, currency)}</span>
                </div>
                <button type="button" className="btn-ghost h-[38px] justify-self-end px-2 text-slate-400 hover:text-red-600 sm:mt-5" aria-label={`Remove item ${idx + 1}`} onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} disabled={items.length === 1}>✕</button>
              </div>
            );
          })}
        </div>
        <FieldNote id="line_items-note" flags={flagsFor("line_items")} />
        <button type="button" className="btn-ghost mt-2 px-2 text-brand-700" onClick={() => setItems((p) => [...p, { kind: "flat_fee", description: "", quantity: "1", unit_price: "" }])}>
          + Add line item
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="due_date">Due date</label>
          <input id="due_date" type="date" className={`input${invalid(show(missing.due_date))}`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-invalid={show(missing.due_date)} aria-describedby="due_date-note" />
          <FieldNote id="due_date-note" flags={flagsFor("due_date")} missing={show(missing.due_date)} />
        </div>
        <div>
          <label className="label" htmlFor="tax_rate">Tax %</label>
          <input id="tax_rate" className="input" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} aria-describedby="tax_rate-note" />
          <FieldNote id="tax_rate-note" flags={flagsFor("tax_rate")} />
        </div>
        <div>
          <label className="label" htmlFor="currency">Currency</label>
          <select id="currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-describedby="currency-note">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <FieldNote id="currency-note" flags={flagsFor("currency")} />
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
            {saving === "send" ? "Saving…" : invoiceId ? "Save & send" : "Create invoice"}
          </button>
        </div>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
    </form>
  );
}
