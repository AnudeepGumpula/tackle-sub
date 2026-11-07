import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/dates";
import { baseUrlFrom } from "@/lib/http";
import { getInvoice, getSettings } from "@/lib/store";
import { InvoiceActions } from "@/components/InvoiceActions";
import { ShareLink } from "@/components/ShareLink";
import { InvoiceDocument } from "@/components/InvoiceDocument";

export const dynamic = "force-dynamic";

const EVENT_ICON: Record<string, string> = { created: "✦", sent: "➜", viewed: "👁", paid: "✓", reminder: "✉", edited: "✎", void: "⊘", draft: "↺" };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const [invoice, settings] = await Promise.all([getInvoice(id), getSettings()]);
  if (!invoice) notFound();
  const payUrl = `${baseUrlFrom(await headers())}/pay/${invoice.public_id}`;

  return (
    <div className="space-y-6">
      <div className="no-print flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← All invoices</Link>
      </div>
      <ShareLink invoice={invoice} payUrl={payUrl} justCreated={Boolean(created)} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <InvoiceDocument invoice={invoice} settings={settings} />
        <aside className="space-y-4">
          <InvoiceActions invoice={invoice} />
          <div className="card no-print p-5">
            <p className="label mb-3">Activity</p>
            <ol className="space-y-3" data-testid="activity">
              {invoice.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-0.5 w-4 text-center text-slate-400" aria-hidden>{EVENT_ICON[e.type] ?? "•"}</span>
                  <span>
                    <span className="block text-slate-700">{e.message}</span>
                    <span className="text-xs text-slate-400">{formatDate(e.created_at)} · {new Date(e.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
