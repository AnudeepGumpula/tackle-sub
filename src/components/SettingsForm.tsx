"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/money";
import type { Settings } from "@/lib/types";

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Saving…");
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    const data = await res.json();
    setStatus(res.ok ? "Saved" : data.error);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card grid gap-4 p-6 sm:grid-cols-2" data-testid="settings-form">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="business_name">Business name</label>
        <input id="business_name" className="input" value={s.business_name} onChange={(e) => set("business_name", e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="business_email">Business email</label>
        <input id="business_email" type="email" className="input" value={s.business_email} onChange={(e) => set("business_email", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="invoice_prefix">Invoice number prefix</label>
        <input id="invoice_prefix" className="input" value={s.invoice_prefix} onChange={(e) => set("invoice_prefix", e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="business_address">Address (printed on invoices)</label>
        <textarea id="business_address" className="input min-h-20" value={s.business_address} onChange={(e) => set("business_address", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="currency">Default currency</label>
        <select id="currency" className="input" value={s.currency} onChange={(e) => set("currency", e.target.value)}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="default_tax_rate">Default tax %</label>
          <input id="default_tax_rate" className="input" inputMode="decimal" value={s.default_tax_rate} onChange={(e) => set("default_tax_rate", Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label" htmlFor="payment_terms_days">Terms (days)</label>
          <input id="payment_terms_days" className="input" inputMode="numeric" value={s.payment_terms_days} onChange={(e) => set("payment_terms_days", parseInt(e.target.value, 10) || 0)} />
        </div>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" type="submit">Save settings</button>
        {status && <span className="text-sm text-slate-500" role="status">{status}</span>}
      </div>
    </form>
  );
}
