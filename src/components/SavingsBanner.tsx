"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

interface Tool { key: string; label: string; monthly: number }
interface Savings { tool: Tool; monthly: number; since: string; months: number; saved: number; yearly: number }

export function SavingsBanner({ savings, tools, currency }: { savings: Savings; tools: Tool[]; currency: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [tool, setTool] = useState(savings.tool.key);
  const [monthly, setMonthly] = useState(String(savings.monthly));
  const [busy, setBusy] = useState(false);
  const money = (n: number) => formatMoney(Math.round(n * 100), currency);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/savings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool, monthly }) });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm" data-testid="savings-banner" aria-label="Subscription savings">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-50">No subscription. You&apos;ve saved</p>
          <p className="text-3xl font-bold tabular-nums" data-testid="savings-amount">
            {money(savings.saved)} <span className="text-base font-semibold text-emerald-50">vs {savings.tool.label}</span>
          </p>
          <p className="text-sm text-emerald-50">
            {money(savings.monthly)}/mo · {money(savings.yearly)} a year · since {formatDate(savings.since)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/import" className="btn bg-white text-emerald-700 hover:bg-emerald-50" data-testid="import-link">Import from {savings.tool.key === "other" ? "another tool" : savings.tool.label}</Link>
          <button type="button" className="btn border border-white/40 text-white hover:bg-white/10" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? "Close" : "Change"}
          </button>
        </div>
      </div>
      {editing && (
        <form onSubmit={save} className="flex flex-wrap items-end gap-3 border-t border-white/20 bg-black/10 px-5 py-4">
          <div>
            <label htmlFor="savings-tool" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-50">I used to pay for</label>
            <select id="savings-tool" className="input min-w-44 text-slate-900" value={tool} onChange={(e) => { setTool(e.target.value); setMonthly(String(tools.find((t) => t.key === e.target.value)?.monthly ?? monthly)); }}>
              {tools.map((t) => <option key={t.key} value={t.key}>{t.key === "other" ? "Something else" : t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="savings-monthly" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-50">Per month</label>
            <input id="savings-monthly" className="input w-28 text-slate-900" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </div>
          <button className="btn bg-white text-emerald-700 hover:bg-emerald-50" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          <p className="w-full text-xs text-emerald-50">Prices are typical entry-plan list prices. Set yours to match the plan you were on.</p>
        </form>
      )}
    </section>
  );
}
