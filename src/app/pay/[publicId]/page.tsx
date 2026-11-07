import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { paypalClientId, testPaymentsEnabled } from "@/lib/paypal";
import { getInvoiceByPublicId, getSettings, recordView } from "@/lib/store";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PayPanel } from "@/components/PayPanel";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ publicId: string }> }): Promise<Metadata> {
  const invoice = await getInvoiceByPublicId((await params).publicId);
  const s = await getSettings();
  return { title: invoice ? `Invoice ${invoice.number} from ${s.business_name}` : "Invoice", robots: { index: false } };
}

export default async function PayPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const [invoice, settings] = await Promise.all([getInvoiceByPublicId(publicId), getSettings()]);
  if (!invoice) notFound();
  if (invoice.status !== "paid") await recordView(invoice.id);
  const amount = formatMoney(invoice.total_cents, invoice.currency);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <p className="no-print mb-6 text-center text-sm text-slate-500">
        <span className="font-semibold text-slate-700">{settings.business_name}</span> sent you an invoice
      </p>

      {invoice.status === "paid" && (
        <div className="mb-6 rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-800 ring-1 ring-emerald-200" role="status" data-testid="paid-banner">
          <p className="text-lg font-semibold">✓ Paid. Thank you!</p>
          <p className="text-sm">{amount} received on {formatDate(invoice.paid_at)}{invoice.paid_via === "paypal" ? " via PayPal" : ""}. This page is your receipt.</p>
        </div>
      )}
      {invoice.status === "void" && (
        <div className="mb-6 rounded-2xl bg-slate-100 px-5 py-4 text-slate-700" role="status">This invoice was cancelled by the sender. No payment is needed.</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <InvoiceDocument invoice={invoice} settings={settings} />
        <aside className="no-print order-first space-y-4 lg:order-none">
          {invoice.status !== "paid" && invoice.status !== "void" ? (
            <PayPanel publicId={invoice.public_id} currency={invoice.currency} amountLabel={amount} paypalClientId={paypalClientId()} testPayments={testPaymentsEnabled()} />
          ) : null}
          <PrintButton label={invoice.status === "paid" ? "Download receipt" : "Download PDF"} />
        </aside>
      </div>
      <p className="no-print mt-10 text-center text-xs text-slate-400">Sent with OneLine · invoicing without the subscription</p>
    </main>
  );
}
