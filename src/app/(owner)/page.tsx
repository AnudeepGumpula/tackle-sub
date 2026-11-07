import Link from "next/link";
import { aiEnabled } from "@/lib/ai";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getSavings, TOOLS } from "@/lib/savings";
import { dashboardStats, getSettings, listInvoices } from "@/lib/store";
import { DemoControls } from "@/components/DemoControls";
import { MagicCreate } from "@/components/MagicCreate";
import { SavingsBanner } from "@/components/SavingsBanner";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "draft", label: "Drafts" },
] as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter = "all" } = await searchParams;
  const [settings, stats, invoices, savings] = await Promise.all([getSettings(), dashboardStats(), listInvoices(), getSavings()]);
  const cur = settings.currency;
  const shown = invoices.filter((i) => {
    if (filter === "unpaid") return i.display_status === "sent" || i.display_status === "overdue";
    if (filter === "overdue") return i.display_status === "overdue";
    if (filter === "paid") return i.status === "paid";
    if (filter === "draft") return i.status === "draft";
    return true;
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Who are you billing today?</h1>
        <p className="mt-1 text-slate-500">Describe the work in one sentence. We&apos;ll fill in the rest.</p>
        <div className="mt-5"><MagicCreate aiEnabled={aiEnabled()} /></div>
      </section>

      <SavingsBanner savings={savings} tools={TOOLS} currency={cur} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <Stat label="Outstanding" value={formatMoney(stats.outstanding_cents, cur)} testId="stat-outstanding" />
        <Stat label="Overdue" value={formatMoney(stats.overdue_cents, cur)} sub={`${stats.overdue_count} invoice${stats.overdue_count === 1 ? "" : "s"}`} tone={stats.overdue_count ? "red" : undefined} testId="stat-overdue" />
        <Stat label="Paid this month" value={formatMoney(stats.paid_this_month_cents, cur)} tone="green" testId="stat-paid" />
        <Stat label="Drafts" value={String(stats.draft_count)} testId="stat-drafts" />
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Invoices</h2>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter invoices">
            {FILTERS.map((f) => (
              <Link key={f.key} href={f.key === "all" ? "/" : `/?filter=${f.key}`} role="tab" aria-selected={filter === f.key}
                className={`rounded-lg px-3 py-1 text-sm ${filter === f.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <p className="font-medium">No invoices yet</p>
            <p className="max-w-sm text-sm text-slate-500">Type a sentence above to create your first one, import your invoices from FreshBooks, QuickBooks or Wave, or load sample data to look around.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/import" className="btn-primary">Import from another tool</Link>
              <DemoControls mode="seed" />
            </div>
          </div>
        ) : shown.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing here.</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="invoice-list">
            {shown.map((inv) => (
              <li key={inv.id}>
                <Link href={`/invoices/${inv.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-slate-50 sm:grid-cols-[110px_1fr_140px_130px_120px]" data-testid="invoice-row">
                  <span className="text-sm font-medium text-slate-500">{inv.number}</span>
                  <span className="order-first col-span-2 font-medium sm:order-none sm:col-span-1">{inv.client_name}</span>
                  <span className="text-sm text-slate-500">{inv.status === "paid" ? `Paid ${formatDate(inv.paid_at)}` : `Due ${formatDate(inv.due_date)}`}</span>
                  <span className="sm:justify-self-start"><StatusBadge status={inv.display_status} /></span>
                  <span className="text-right font-semibold tabular-nums">{formatMoney(inv.total_cents, inv.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone, testId }: { label: string; value: string; sub?: string; tone?: "red" | "green"; testId: string }) {
  const color = tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="card px-4 py-4" data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
