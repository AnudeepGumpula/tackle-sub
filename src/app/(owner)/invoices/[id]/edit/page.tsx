import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getInvoice } from "@/lib/store";
import { InvoiceEditor } from "@/components/InvoiceEditor";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  if (invoice.status === "paid") redirect(`/invoices/${id}`);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/invoices/${id}`} className="text-sm text-slate-500 hover:text-slate-800">← Back to {invoice.number}</Link>
      <h1 className="text-2xl font-bold tracking-tight">Edit {invoice.number}</h1>
      <InvoiceEditor
        invoiceId={invoice.id}
        initial={{
          client_name: invoice.client.name,
          client_email: invoice.client.email,
          line_items: invoice.line_items.map((li) => ({ description: li.description, quantity: li.quantity, unit_price: li.unit_price_cents / 100 })),
          due_date: invoice.due_date,
          tax_rate: invoice.tax_rate,
          currency: invoice.currency,
          notes: invoice.notes,
          source_text: invoice.source_text,
        }}
      />
    </div>
  );
}
